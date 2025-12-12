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
    // Date range fetch button
    const btnFetchRange = document.getElementById("btn-fetch-range");
    if (btnFetchRange) {
      btnFetchRange.addEventListener("click", () => this.handleFetchRange());
    }

    // Delete all data button
    const btnDeleteAll = document.getElementById("btn-delete-all");
    if (btnDeleteAll) {
      btnDeleteAll.addEventListener("click", () => this.handleDeleteAll());
    }

    // Run analysis button
    const btnRunAnalysis = document.getElementById("btn-run-analysis");
    if (btnRunAnalysis) {
      btnRunAnalysis.addEventListener("click", () => this.handleRunAnalysis());
    }

    // Initialize date inputs with defaults
    this.initializeDateInputs();

    // Update data status when tab is shown
    this.updateDataStatus();
  },

  /**
   * Format date to Finnish format (d.m.yyyy)
   */
  formatFinnishDate(date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  },

  /**
   * Parse Finnish date format (d.m.yyyy) to ISO format (yyyy-mm-dd)
   */
  parseFinnishDate(finnishDate) {
    if (!finnishDate) return null;
    const parts = finnishDate.split(".");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  },

  /**
   * Initialize date input fields with default values
   */
  initializeDateInputs() {
    const startInput = document.getElementById("fetch-start-date");
    const endInput = document.getElementById("fetch-end-date");

    if (startInput && endInput) {
      // Default: start of current year to yesterday
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Set values in Finnish format
      startInput.value = this.formatFinnishDate(startOfYear);
      endInput.value = this.formatFinnishDate(yesterday);

      // Initialize calendar buttons
      this.initializeCalendarButtons();
    }
  },

  /**
   * Initialize calendar button functionality
   */
  initializeCalendarButtons() {
    const calendarButtons = document.querySelectorAll(".calendar-btn");

    calendarButtons.forEach((btn) => {
      const targetId = btn.dataset.target;
      const textInput = document.getElementById(targetId);
      const datePicker = document.getElementById(`${targetId}-picker`);

      if (textInput && datePicker) {
        // When calendar button is clicked, open the date picker
        btn.addEventListener("click", () => {
          datePicker.showPicker();
        });

        // When date is selected from picker, update text input in Finnish format
        datePicker.addEventListener("change", () => {
          if (datePicker.value) {
            const date = new Date(datePicker.value);
            textInput.value = this.formatFinnishDate(date);
          }
        });

        // Sync text input to date picker when text is entered manually
        textInput.addEventListener("blur", () => {
          const parsed = this.parseFinnishDate(textInput.value);
          if (parsed) {
            datePicker.value = parsed;
          }
        });
      }
    });
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
   * Handle fetch date range button
   */
  async handleFetchRange() {
    const startInput = document.getElementById("fetch-start-date");
    const endInput = document.getElementById("fetch-end-date");

    if (!startInput || !endInput || !startInput.value || !endInput.value) {
      this.addLog("Valitse alku- ja loppupäivä", "error");
      return;
    }

    // Parse Finnish dates to ISO format
    const startDate = this.parseFinnishDate(startInput.value);
    const endDate = this.parseFinnishDate(endInput.value);

    if (!startDate || !endDate) {
      this.addLog("Virheellinen päivämäärä. Käytä muotoa pp.kk.vvvv", "error");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      this.addLog("Alkupäivä ei voi olla loppupäivän jälkeen", "error");
      return;
    }

    // Calculate days
    const days = Math.ceil(
      (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
    ) + 1;

    this.showOperationWithProgress(`Haetaan dataa ${days} päivälle...`, 0);
    this.addLog(`Aloitetaan haku: ${startDate} - ${endDate} (${days} päivää)`, "info");

    // Disable button during operation
    const btn = document.getElementById("btn-fetch-range");
    if (btn) btn.disabled = true;

    try {
      await this.streamFetchRange(startDate, endDate);
    } catch (error) {
      this.showOperationError(`Virhe: ${error.message}`);
      this.addLog(`Virhe: ${error.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Handle delete all data button
   */
  async handleDeleteAll() {
    if (!confirm("Haluatko varmasti poistaa kaiken säädatan ja analyysit? Tätä ei voi perua.")) {
      return;
    }

    this.showOperation("Poistetaan dataa...");
    this.addLog("Poistetaan kaikki data...", "warning");

    const btn = document.getElementById("btn-delete-all");
    if (btn) btn.disabled = true;

    try {
      const response = await fetch(`${this.baseURL}/delete-all-data`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      this.showOperationSuccess("Kaikki data poistettu!");
      this.addLog("Data poistettu onnistuneesti", "success");
      this.updateDataStatus();
    } catch (error) {
      this.showOperationError(`Virhe: ${error.message}`);
      this.addLog(`Virhe: ${error.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Handle run analysis button
   */
  async handleRunAnalysis() {
    this.showOperationWithProgress("Käynnistetään analyysit...", 0);
    this.addLog("Aloitetaan analyysien ajo", "info");

    const btn = document.getElementById("btn-run-analysis");
    if (btn) btn.disabled = true;

    try {
      await this.streamRunAnalysis();
    } catch (error) {
      this.showOperationError(`Virhe: ${error.message}`);
      this.addLog(`Virhe: ${error.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Stream run analysis using Server-Sent Events
   */
  streamRunAnalysis() {
    return new Promise((resolve, reject) => {
      fetch(`${this.baseURL}/run-analysis`, {
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

            const lines = buffer.split("\n");
            buffer = lines.pop();

            let eventType = null;

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                try {
                  const eventData = JSON.parse(line.slice(6));
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
   * Stream fetch date range using Server-Sent Events
   */
  streamFetchRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      fetch(`${this.baseURL}/fetch-range`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
        }),
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

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                try {
                  const eventData = JSON.parse(line.slice(6));
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
      if (data.step === "fetch" && data.current_quarter && data.current_quarter % 3 === 0) {
        this.addLog(data.message, "info");
      } else if (data.step === "preprocess" || data.step === "analyze") {
        this.addLog(data.message, "info");
      } else if (data.step === "done") {
        this.addLog(data.message, "success");
      }
    } else if (eventType === "complete") {
      const msg = data.rows
        ? `Valmis! Haettiin ${data.rows.toLocaleString()} havaintoa.`
        : "Data päivitetty!";
      this.showOperationSuccess(msg);
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
