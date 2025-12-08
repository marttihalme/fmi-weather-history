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
