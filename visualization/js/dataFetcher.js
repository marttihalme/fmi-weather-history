/**
 * dataFetcher.js
 * Fetch and load historical weather data from backend
 */

const DataFetcher = {
  baseURL: "/api",
  data: null,
  isLoading: false,

  /**
   * Initialize data fetcher
   * @param {string} baseURL - API base URL
   */
  initialize(baseURL = "/api") {
    this.baseURL = baseURL;
    this.initializeDataManagementUI();
  },

  /**
   * Initialize Data Management UI
   */
  initializeDataManagementUI() {
    // Refresh 30 days button
    const btnRefresh30 = document.getElementById("btn-refresh-30");
    if (btnRefresh30) {
      btnRefresh30.addEventListener("click", () => this.handleRefresh30());
    }

    // Refresh 5 years button
    const btnRefresh5Years = document.getElementById("btn-refresh-5years");
    if (btnRefresh5Years) {
      btnRefresh5Years.addEventListener("click", () =>
        this.handleRefresh5Years()
      );
    }

    // Update data status when tab is shown
    this.updateDataStatus();
  },

  /**
   * Update data status display
   */
  async updateDataStatus() {
    const statusIcon = document.getElementById("data-status-icon");
    const dateRange = document.getElementById("data-date-range");
    const stationCount = document.getElementById("data-station-count");
    const observationCount = document.getElementById("data-observation-count");
    const lastUpdated = document.getElementById("data-last-updated");
    const zoneCoverageList = document.getElementById("zone-coverage-list");

    try {
      // Get data from DataLoader if available
      if (typeof DataLoader !== "undefined") {
        const range = DataLoader.getDateRange();
        const stations = DataLoader.getStations();
        const zoneSummary = DataLoader.getZoneSummary();
        const stationData = DataLoader.getStationData();

        if (dateRange && range) {
          const formatFinnishDate = (dateStr) => {
            const d = new Date(dateStr);
            return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
          };
          dateRange.textContent = `${formatFinnishDate(range.minDate)} \u2192 ${formatFinnishDate(range.maxDate)}`;
        }
        if (stationCount && stations) {
          stationCount.textContent = stations.length;
        }
        if (observationCount) {
          const count = stationData ? stationData.length : 0;
          observationCount.textContent = count ? count.toLocaleString() : "0";
        }
        if (lastUpdated) {
          // Try to get file modification time from data
          lastUpdated.textContent = new Date().toLocaleDateString("fi-FI");
        }
        if (statusIcon) {
          statusIcon.classList.remove("loading", "offline");
          statusIcon.classList.add("online");
        }

        // Update zone coverage
        if (zoneCoverageList && zoneSummary) {
          this.updateZoneCoverage(zoneSummary);
        }
      }
    } catch (error) {
      console.error("Error updating data status:", error);
      if (statusIcon) {
        statusIcon.classList.remove("loading", "online");
        statusIcon.classList.add("offline");
      }
    }
  },

  /**
   * Update zone coverage display
   */
  updateZoneCoverage(zoneSummary) {
    const container = document.getElementById("zone-coverage-list");
    if (!container) return;

    // Group by zone and count
    const zoneCounts = {};
    const zones = ["Etelä-Suomi", "Keski-Suomi", "Pohjois-Suomi", "Lappi"];

    zones.forEach((zone) => {
      zoneCounts[zone] = zoneSummary.filter(
        (d) => (d.zone_name || d.zone) === zone
      ).length;
    });

    const maxCount = Math.max(...Object.values(zoneCounts));

    container.innerHTML = zones
      .map((zone) => {
        const count = zoneCounts[zone] || 0;
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return `
        <div class="zone-coverage-item">
          <span class="zone-coverage-name">${zone}</span>
          <div class="zone-coverage-bar">
            <div class="zone-coverage-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="zone-coverage-text">${count.toLocaleString()} days</span>
        </div>
      `;
      })
      .join("");
  },

  /**
   * Handle refresh 30 days button
   */
  async handleRefresh30() {
    this.showOperation("Refreshing last 30 days...");
    this.addLog("Starting refresh of last 30 days", "info");

    try {
      const result = await this.refreshLast30Days();
      this.hideOperation();
      this.showOperationSuccess("Data refreshed successfully!");
      this.addLog("Refresh completed successfully", "success");

      // Reload the data
      if (typeof DataLoader !== "undefined") {
        await DataLoader.loadAll();
        this.updateDataStatus();
      }
    } catch (error) {
      this.showOperationError(`Failed: ${error.message}`);
      this.addLog(`Error: ${error.message}`, "error");
    }
  },

  /**
   * Handle refresh 5 years button - uses SSE for progress streaming
   */
  async handleRefresh5Years() {
    this.showOperationWithProgress("Aloitetaan 5 vuoden datan hakua...", 0);
    this.addLog("Aloitetaan 5 vuoden datan haku", "info");

    // Disable button during operation
    const btn = document.getElementById("btn-refresh-5years");
    if (btn) btn.disabled = true;

    try {
      await this.streamRefresh5Years();
    } catch (error) {
      this.showOperationError(`Virhe: ${error.message}`);
      this.addLog(`Virhe: ${error.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Stream refresh 5 years using Server-Sent Events
   */
  streamRefresh5Years() {
    return new Promise((resolve, reject) => {
      // Use EventSource for SSE (requires GET, so we use POST via fetch with streaming)
      fetch(`${this.baseURL}/refresh-5years`, {
        method: "POST",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const processStream = ({ done, value }) => {
            if (done) {
              resolve();
              return;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split("\n");
            buffer = lines.pop(); // Keep incomplete line in buffer

            let eventType = null;
            let eventData = null;

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                try {
                  eventData = JSON.parse(line.slice(6));
                  this.handleSSEEvent(eventType, eventData);
                } catch (e) {
                  console.warn("Failed to parse SSE data:", line);
                }
              }
            }

            reader.read().then(processStream).catch(reject);
          };

          reader.read().then(processStream).catch(reject);
        })
        .catch(reject);
    });
  },

  /**
   * Handle SSE event from server
   */
  handleSSEEvent(eventType, data) {
    if (eventType === "progress") {
      this.showOperationWithProgress(data.message, data.percent);

      // Log important milestones
      if (data.step === "fetch" && data.current_quarter) {
        this.addLog(
          `Jakso ${data.current_quarter}/${data.total_quarters}`,
          "info"
        );
      } else if (data.step === "preprocess") {
        this.addLog(data.message, "info");
      }
    } else if (eventType === "complete") {
      this.showOperationSuccess("5 vuoden data päivitetty!");
      this.addLog("Päivitys valmis", "success");

      // Reload the data
      if (typeof DataLoader !== "undefined") {
        DataLoader.loadAll().then(() => {
          this.updateDataStatus();
        });
      }
    } else if (eventType === "error") {
      this.showOperationError(`Virhe: ${data.message}`);
      this.addLog(`Virhe: ${data.message}`, "error");
    }
  },

  /**
   * Show operation with specific progress percentage
   */
  showOperationWithProgress(message, percent) {
    const container = document.getElementById("operation-status");
    const textEl = document.getElementById("operation-text");
    const iconEl = container?.querySelector(".operation-icon");
    const fill = document.getElementById("operation-progress-fill");
    const progressText = document.getElementById("operation-progress-text");

    // Clear any fake progress animation
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }

    if (container) {
      container.classList.remove("hidden", "success", "error");
      if (iconEl) {
        iconEl.classList.add("spinning");
        iconEl.textContent = "⟳";
      }
    }
    if (textEl) {
      textEl.textContent = message;
    }
    if (fill) {
      fill.style.width = `${percent}%`;
    }
    if (progressText) {
      progressText.textContent = `${Math.round(percent)}%`;
    }
  },

  /**
   * Show operation status
   */
  showOperation(message) {
    const container = document.getElementById("operation-status");
    const textEl = document.getElementById("operation-text");
    const iconEl = container?.querySelector(".operation-icon");

    if (container) {
      container.classList.remove("hidden", "success", "error");
      if (iconEl) {
        iconEl.classList.add("spinning");
        iconEl.textContent = "⟳";
      }
    }
    if (textEl) {
      textEl.textContent = message;
    }

    // Animate progress
    this.animateProgress();
  },

  /**
   * Animate progress bar
   */
  animateProgress() {
    const fill = document.getElementById("operation-progress-fill");
    const text = document.getElementById("operation-progress-text");

    if (!fill) return;

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      fill.style.width = `${progress}%`;
      if (text) text.textContent = `${Math.round(progress)}%`;
    }, 500);

    this._progressInterval = interval;
  },

  /**
   * Hide operation status
   */
  hideOperation() {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
    }
    const container = document.getElementById("operation-status");
    if (container) {
      container.classList.add("hidden");
    }
  },

  /**
   * Show operation success
   */
  showOperationSuccess(message) {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
    }
    const container = document.getElementById("operation-status");
    const textEl = document.getElementById("operation-text");
    const iconEl = container?.querySelector(".operation-icon");
    const fill = document.getElementById("operation-progress-fill");
    const progressText = document.getElementById("operation-progress-text");

    if (container) {
      container.classList.remove("hidden", "error");
      container.classList.add("success");
    }
    if (iconEl) {
      iconEl.classList.remove("spinning");
      iconEl.textContent = "✓";
    }
    if (textEl) textEl.textContent = message;
    if (fill) fill.style.width = "100%";
    if (progressText) progressText.textContent = "100%";

    // Auto-hide after 3 seconds
    setTimeout(() => this.hideOperation(), 3000);
  },

  /**
   * Show operation error
   */
  showOperationError(message) {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
    }
    const container = document.getElementById("operation-status");
    const textEl = document.getElementById("operation-text");
    const iconEl = container?.querySelector(".operation-icon");

    if (container) {
      container.classList.remove("hidden", "success");
      container.classList.add("error");
    }
    if (iconEl) {
      iconEl.classList.remove("spinning");
      iconEl.textContent = "✗";
    }
    if (textEl) textEl.textContent = message;
  },

  /**
   * Add log entry
   */
  addLog(message, type = "info") {
    const container = document.getElementById("log-container");
    if (!container) return;

    const time = new Date().toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">${time}</span>${message}`;

    container.insertBefore(entry, container.firstChild);

    // Keep only last 50 entries
    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  },

  /**
   * Fetch data for date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Array} stations - Optional array of station IDs to fetch
   * @returns {Promise} Promise resolving to data
   */
  async fetchDataByDateRange(startDate, endDate, stations = null) {
    this.isLoading = true;

    try {
      let url = `${this.baseURL}/weather?start=${startDate}&end=${endDate}`;

      if (stations && Array.isArray(stations) && stations.length > 0) {
        url += `&stations=${stations.join(",")}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      this.data = await response.json();
      this.isLoading = false;

      return this.data;
    } catch (error) {
      console.error("Error fetching data:", error);
      this.isLoading = false;
      throw error;
    }
  },

  /**
   * Fetch available stations
   * @returns {Promise} Promise resolving to stations array
   */
  async fetchStations() {
    try {
      const response = await fetch(`${this.baseURL}/stations`);

      if (!response.ok) {
        throw new Error(`Failed to fetch stations: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching stations:", error);
      throw error;
    }
  },

  /**
   * Fetch available dates
   * @returns {Promise} Promise resolving to dates array
   */
  async fetchAvailableDates() {
    try {
      const response = await fetch(`${this.baseURL}/dates`);

      if (!response.ok) {
        throw new Error(`Failed to fetch dates: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching available dates:", error);
      throw error;
    }
  },

  /**
   * Fetch metadata about available metrics
   * @returns {Promise} Promise resolving to metrics array
   */
  async fetchMetrics() {
    try {
      const response = await fetch(`${this.baseURL}/metrics`);

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching metrics:", error);
      throw error;
    }
  },

  /**
   * Fetch baseline data for anomaly calculation
   * @param {string} startDate - Start date of baseline period
   * @param {string} endDate - End date of baseline period
   * @returns {Promise} Promise resolving to baseline data
   */
  async fetchBaselineData(startDate, endDate) {
    try {
      const response = await fetch(
        `${this.baseURL}/weather?start=${startDate}&end=${endDate}&baseline=true`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch baseline: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching baseline data:", error);
      throw error;
    }
  },

  /**
   * Fetch winter-specific data
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise} Promise resolving to winter data
   */
  async fetchWinterData(startDate, endDate) {
    try {
      const response = await fetch(
        `${this.baseURL}/winter?start=${startDate}&end=${endDate}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch winter data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching winter data:", error);
      throw error;
    }
  },

  /**
   * Refresh data for the last 30 days
   * @returns {Promise} Promise resolving to success
   */
  async refreshLast30Days() {
    this.isLoading = true;
    try {
      const response = await fetch(`${this.baseURL}/refresh-30`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh data: ${response.statusText}`);
      }

      const result = await response.json();
      this.isLoading = false;
      return result;
    } catch (error) {
      console.error("Error refreshing data:", error);
      this.isLoading = false;
      throw error;
    }
  },

  /**
   * Get cached data
   * @returns {Object} Previously fetched data
   */
  getCachedData() {
    return this.data;
  },

  /**
   * Check if data is currently loading
   * @returns {boolean}
   */
  getLoadingStatus() {
    return this.isLoading;
  },

  /**
   * Clear cached data
   */
  clearCache() {
    this.data = null;
  },

  /**
   * Upload local CSV file
   * @param {File} file - CSV file to upload
   * @returns {Promise} Promise resolving to parsed data
   */
  async uploadFile(file) {
    if (!file) {
      throw new Error("No file provided");
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${this.baseURL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.statusText}`);
      }

      const data = await response.json();
      this.data = data;
      return data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  /**
   * Parse local CSV data (without server)
   * @param {string} csvContent - CSV content string
   * @returns {Array} Parsed data
   */
  parseCSV(csvContent) {
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV file must have header and data rows");
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const record = {};

      headers.forEach((header, index) => {
        const value = values[index] ? values[index].trim() : "";
        // Try to parse as number
        record[header] = isNaN(value) ? value : parseFloat(value);
      });

      data.push(record);
    }

    this.data = data;
    return data;
  },
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = DataFetcher;
}
