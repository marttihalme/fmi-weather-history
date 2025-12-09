/**
 * main.js
 * Main application initialization and coordination
 * Orchestrates all modules to create the Finnish Weather Visualization
 */

const App = {
  // State
  currentData: null,
  currentMetric: "temp_mean", // Default metric matches our data
  baselineData: null,
  winterData: null,

  // Modules
  MapManager: null,
  DataProcessor: null,
  HeatmapRenderer: null,
  Interpolation: null,
  TimelineController: null,
  AnomalyOverlay: null,
  WinterProgressionLayer: null,
  DataTable: null,
  UIControls: null,
  DataFetcher: null,

  /**
   * Initialize the application
   */
  async initialize() {
    console.log("Initializing Finnish Weather Visualization...");

    try {
      // Initialize UI
      UIControls.initialize();
      UIControls.showLoading();

      // Initialize map (ID from index.html is 'map')
      MapManager.initializeMap("map");

      // Initialize data table (ID from index.html is 'data-table')
      DataTable.initialize("data-table");

      // Initialize Year Compare module
      if (typeof YearCompare !== "undefined") {
        YearCompare.initialize();
      }

      // Fetch available data
      await this.loadInitialData();

      // Initialize data management helpers (status, buttons)
      if (typeof DataFetcher !== "undefined") {
        DataFetcher.initialize("/api");
      }

      // Set up event listeners
      this.setupEventListeners();

      // Load and display initial data
      await this.loadAndDisplayData();

      UIControls.hideLoading();
      UIControls.showInfo("Application loaded successfully");

      console.log("Application initialized");
    } catch (error) {
      console.error("Error initializing application:", error);
      UIControls.hideLoading();
      UIControls.showError(`Failed to initialize: ${error.message}`);
    }
  },

  /**
   * Load initial data (dates, stations, metrics)
   */
  async loadInitialData() {
    try {
      // Load data from JSON files using DataLoader
      console.log("Loading data from JSON files...");
      const data = await DataLoader.loadAll();

      // Store loaded data
      this.currentData = data.zoneSummary;
      this.stations = data.stations;
      this.anomalies = data.anomalies;
      this.winterData = data.winterStarts;

      // Get date range from data
      const dateRange = DataLoader.getDateRange();
      console.log("Date range:", dateRange);

      // Generate dates array
      const dates = [];
      const startDate = new Date(dateRange.minDate);
      const endDate = new Date(dateRange.maxDate);

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        dates.push(d.toISOString().split("T")[0]);
      }

      // Initialize timeline
      TimelineController.initialize(dates);
      this.currentDate = TimelineController.getCurrentDate();

      console.log(`Loaded ${dates.length} available dates`);
      console.log(`Loaded ${this.stations.length} stations`);
      console.log(`Loaded ${this.anomalies.length} anomalies`);
    } catch (error) {
      console.error("Could not load data:", error);
      console.warn("Falling back to demo data");
      this.setupDemoData();
    }
  },

  /**
   * Set up demo data for testing
   */
  setupDemoData() {
    // Create sample dates for the past 30 days
    const today = new Date();
    const dates = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
    }

    TimelineController.initialize(dates);
    this.currentDate = TimelineController.getCurrentDate();

    // Demo metrics
    const metrics = [
      { name: "temperature", label: "Temperature (°C)" },
      { name: "humidity", label: "Humidity (%)" },
      { name: "pressure", label: "Pressure (hPa)" },
      { name: "precipitation", label: "Precipitation (mm)" },
    ];

    UIControls.updateMetricOptions(metrics);

    console.log("Using demo data with", dates.length, "dates");
  },

  /**
   * Load and display data for current date
   */
  async loadAndDisplayData() {
    try {
      const date = TimelineController.getCurrentDate();
      console.log("Loading data for date:", date);

      // Check if we have loaded data
      if (!this.currentData || this.currentData.length === 0) {
        console.warn("No data loaded, creating demo data");
        await this.createDemoData(date);
        return;
      }

      // Get station data for the current date (individual station measurements)
      const stationDataArray = DataLoader.getStationDataForDate(date);

      if (!stationDataArray || stationDataArray.length === 0) {
        console.warn("No station data found for date:", date);
        return;
      }

      console.log(
        "Found station data for date:",
        stationDataArray.length,
        "stations"
      );

      // Convert array to object keyed by fmisid, adding lat/lon from stations list
      const stationData = this.convertStationDataToObject(stationDataArray);
      console.log(
        "Converted to",
        Object.keys(stationData).length,
        "station records"
      );

      this.displayData(stationData);
    } catch (error) {
      console.error("Error loading data:", error);
      UIControls.showError(`Failed to load data: ${error.message}`);
    }
  },

  /**
   * Create synthetic demo data
   */
  async createDemoData(date) {
    // Finnish weather stations
    const stations = [
      { id: "100001", name: "Helsinki", lat: 60.1699, lon: 24.9384 },
      { id: "100002", name: "Espoo", lat: 60.2054, lon: 24.6542 },
      { id: "100003", name: "Tampere", lat: 61.4978, lon: 23.761 },
      { id: "100004", name: "Turku", lat: 60.4518, lon: 22.2666 },
      { id: "100005", name: "Oulu", lat: 64.1466, lon: 27.7209 },
      { id: "100006", name: "Jyväskylä", lat: 62.2411, lon: 25.7482 },
      { id: "100007", name: "Kuopio", lat: 62.8921, lon: 27.6758 },
      { id: "100008", name: "Lappeenranta", lat: 61.0582, lon: 28.1944 },
      { id: "100009", name: "Hämeenlinna", lat: 60.9933, lon: 24.4668 },
      { id: "100010", name: "Vaasa", lat: 63.0965, lon: 21.5987 },
    ];

    const demoData = {};

    // Generate random weather data for each station
    stations.forEach((station) => {
      const temp_mean = 15 + Math.sin(Math.random() * 10) * 10;
      const temp_min = temp_mean - 5 - Math.random() * 5;
      const temp_max = temp_mean + 5 + Math.random() * 5;
      const snow_depth = Math.max(0, 20 - station.lat + Math.random() * 30);
      const precipitation = Math.random() * 5;
      const ground_temp_min = temp_min - Math.random() * 3;

      demoData[station.id] = {
        station_id: station.id,
        station_name: station.name,
        name: station.name,
        lat: station.lat,
        lon: station.lon,
        date: date,
        // Add metrics directly (HeatmapRenderer expects these)
        temp_mean: temp_mean,
        temp_min: temp_min,
        temp_max: temp_max,
        snow_depth: snow_depth,
        precipitation: precipitation,
        ground_temp_min: ground_temp_min,
      };
    });

    this.currentData = demoData;
    // displayData expects object keyed by station ID (for HeatmapRenderer compatibility)
    this.displayData(demoData);
  },

  /**
   * Display data on map
   */
  displayData(data) {
    if (!data) {
      console.warn("No data to display");
      return;
    }

    // Data should already be in station object format (keyed by station ID)
    const stationData = data;
    console.log(
      "Displaying",
      Object.keys(stationData).length,
      "stations on map"
    );

    // Store for data table
    this.currentData = stationData;

    // Get current metric value
    const metricKey = this.currentMetric;

    // Create color scale wrapper
    const colorScale = this.getColorScale(metricKey);

    // Update visualization based on current mode
    HeatmapRenderer.updateVisualization(stationData, metricKey, colorScale);

    // Update color legend
    this.updateColorLegend(metricKey);

    // Update data table if enabled
    if (UIControls.isDataTableEnabled()) {
      this.showDataTable(stationData);
    }

    // Log stats
    const stats = HeatmapRenderer.getDataStatistics();
    if (stats) {
      console.log(`${metricKey} stats:`, stats);
    }
  },

  /**
   * Show data table with current data
   */
  showDataTable(stationData) {
    const container = document.getElementById("data-table-container");
    if (!container) return;

    // Show container
    container.classList.remove("hidden");

    // Convert station data to table rows
    const rows = [];
    Object.values(stationData).forEach((station) => {
      rows.push({
        Station: station.name || station.station_name,
        Zone: station.zone || "-",
        "Temp Mean":
          station.temp_mean !== null
            ? station.temp_mean.toFixed(1) + "°C"
            : "-",
        "Temp Min":
          station.temp_min !== null ? station.temp_min.toFixed(1) + "°C" : "-",
        "Temp Max":
          station.temp_max !== null ? station.temp_max.toFixed(1) + "°C" : "-",
        "Snow Depth":
          station.snow_depth !== null
            ? station.snow_depth.toFixed(1) + "cm"
            : "-",
        Precipitation:
          station.precipitation !== null
            ? station.precipitation.toFixed(1) + "mm"
            : "-",
      });
    });

    // Create simple HTML table
    const table = document.getElementById("data-table");
    if (!table) return;

    let html = '<table class="data-table-custom">';

    // Header
    html += "<thead><tr>";
    const headers = [
      "Station",
      "Zone",
      "Temp Mean",
      "Temp Min",
      "Temp Max",
      "Snow Depth",
      "Precipitation",
    ];
    headers.forEach((h) => {
      html += `<th>${h}</th>`;
    });
    html += "</tr></thead>";

    // Body
    html += "<tbody>";
    rows.forEach((row) => {
      html += "<tr>";
      headers.forEach((h) => {
        html += `<td>${row[h]}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";

    table.innerHTML = html;
  },

  /**
   * Hide data table
   */
  hideDataTable() {
    const container = document.getElementById("data-table-container");
    if (container) {
      container.classList.add("hidden");
    }
  },

  /**
   * Update color legend for current metric
   */
  updateColorLegend(metric) {
    const config = ColorScales.getMetricConfig(metric);
    if (!config) return;

    // Update legend title
    const titleEl = document.getElementById("legend-metric-title");
    if (titleEl) {
      titleEl.textContent = config.name;
    }

    // Update color scale canvas
    const canvas = document.getElementById("color-scale-canvas");
    if (canvas) {
      ColorScales.drawColorScale(canvas, metric);
    }

    // Update min/max labels
    const [min, max] = config.range;
    const minLabel = document.getElementById("scale-min");
    const maxLabel = document.getElementById("scale-max");
    if (minLabel) minLabel.textContent = `${min}${config.unit}`;
    if (maxLabel) maxLabel.textContent = `${max}${config.unit}`;
  },

  /**
   * Convert station data array to object keyed by fmisid
   * Adds lat/lon from the stations list
   */
  convertStationDataToObject(stationDataArray) {
    const stationData = {};

    // Create a lookup map for station locations
    const stationLocations = {};
    this.stations.forEach((s) => {
      stationLocations[s.fmisid] = {
        lat: s.latitude,
        lon: s.longitude,
      };
    });

    // Convert each station record
    stationDataArray.forEach((record) => {
      const location = stationLocations[record.fmisid];
      if (!location) {
        console.warn("No location found for station:", record.fmisid);
        return;
      }

      stationData[record.fmisid] = {
        id: record.fmisid,
        name: record.station_name,
        station_name: record.station_name,
        lat: location.lat,
        lon: location.lon,
        zone: record.zone,
        // Use actual station measurements (no averaging)
        temp_mean: record.temp_mean,
        temp_min: record.temp_min,
        temp_max: record.temp_max,
        snow_depth: record.snow_depth,
        precipitation: record.precipitation,
        ground_temp_min: record.ground_temp_min,
      };
    });

    return stationData;
  },

  /**
   * Get approximate center coordinates for each zone
   */
  getZoneCenter(zone) {
    const centers = {
      etela_suomi: { lat: 60.5, lon: 25.0 },
      keski_suomi: { lat: 62.5, lon: 26.0 },
      pohjois_suomi: { lat: 65.0, lon: 26.5 },
      lappi: { lat: 67.5, lon: 26.0 },
    };
    return centers[zone] || { lat: 64.0, lon: 26.0 };
  },

  /**
   * Get color scale for a metric
   */
  getColorScale(metric) {
    // Use ColorScales from global scope if available
    if (typeof ColorScales !== "undefined") {
      const config = ColorScales.getMetricConfig(metric);
      if (config) {
        return {
          getColor: (value) => ColorScales.getColor(metric, value),
          normalize: (value) => {
            const [min, max] = config.range;
            return Math.max(0, Math.min(1, (value - min) / (max - min)));
          },
        };
      }
    }

    // Default color scale (temperature)
    return {
      getColor: (value) => {
        if (value === null || value === undefined || isNaN(value))
          return "#ccc";
        if (value < 0) return "#0000FF";
        if (value < 10) return "#00FF00";
        if (value < 20) return "#FFFF00";
        if (value < 30) return "#FF6600";
        return "#FF0000";
      },
      normalize: (value) => {
        if (value === null || value === undefined || isNaN(value)) return 0.5;
        return (value + 50) / 80; // Assuming range -50 to 30
      },
    };
  },

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Timeline events
    TimelineController.onDateChange((date) => {
      console.log("Date changed to:", date);
      this.loadAndDisplayData();
    });

    // Metric selector
    UIControls.onMetricChange((metric) => {
      this.currentMetric = metric;
      console.log("Metric changed to:", metric);
      this.loadAndDisplayData();
    });

    // Winter progression
    UIControls.onWinterToggle((enabled) => {
      if (enabled) {
        WinterProgressionLayer.enable(this.winterData);
      } else {
        WinterProgressionLayer.disable();
      }
    });

    // Data table toggle
    UIControls.onDataTableToggle((enabled) => {
      if (enabled && this.currentData) {
        this.showDataTable(this.currentData);
      } else {
        this.hideDataTable();
      }
    });

    // Refresh 30 days
    UIControls.onRefresh30Click(async () => {
      console.log("Refreshing last 30 days...");
      UIControls.showLoading();
      try {
        await DataFetcher.refreshLast30Days();
        UIControls.showInfo("Data refreshed successfully");
        // Reload data
        await this.loadInitialData();
        await this.loadAndDisplayData();
      } catch (error) {
        console.error("Error refreshing data:", error);
        UIControls.showError(`Failed to refresh data: ${error.message}`);
      } finally {
        UIControls.hideLoading();
      }
    });
  },
};

/**
 * Start application when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  App.initialize();
});

// Export App for debugging in console
if (typeof window !== "undefined") {
  window.App = App;
}
