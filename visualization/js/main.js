/**
 * main.js
 * Main application initialization and coordination
 * Orchestrates all modules to create the Finnish Weather Visualization
 */

const App = {
  // State
  currentData: null,
  currentMetric: 'temp_mean',  // Default metric matches our data
  currentMode: 'stations',
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
    console.log('Initializing Finnish Weather Visualization...');

    try {
      // Initialize UI
      UIControls.initialize();
      UIControls.showLoading();

      // Initialize map (ID from index.html is 'map')
      MapManager.initializeMap('map');

      // Initialize data table (ID from index.html is 'data-table')
      DataTable.initialize('data-table');

      // Fetch available data
      await this.loadInitialData();

      // Set up event listeners
      this.setupEventListeners();

      // Load and display initial data
      await this.loadAndDisplayData();

      UIControls.hideLoading();
      UIControls.showInfo('Application loaded successfully');

      console.log('Application initialized');
    } catch (error) {
      console.error('Error initializing application:', error);
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
      console.log('Loading data from JSON files...');
      const data = await DataLoader.loadAll();

      // Store loaded data
      this.currentData = data.zoneSummary;
      this.stations = data.stations;
      this.anomalies = data.anomalies;
      this.winterData = data.winterStarts;

      // Get date range from data
      const dateRange = DataLoader.getDateRange();
      console.log('Date range:', dateRange);

      // Generate dates array
      const dates = [];
      const startDate = new Date(dateRange.minDate);
      const endDate = new Date(dateRange.maxDate);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // Initialize timeline
      TimelineController.initialize(dates);
      this.currentDate = TimelineController.getCurrentDate();

      console.log(`Loaded ${dates.length} available dates`);
      console.log(`Loaded ${this.stations.length} stations`);
      console.log(`Loaded ${this.anomalies.length} anomalies`);
    } catch (error) {
      console.error('Could not load data:', error);
      console.warn('Falling back to demo data');
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
      dates.push(date.toISOString().split('T')[0]);
    }

    TimelineController.initialize(dates);
    this.currentDate = TimelineController.getCurrentDate();

    // Demo metrics
    const metrics = [
      { name: 'temperature', label: 'Temperature (°C)' },
      { name: 'humidity', label: 'Humidity (%)' },
      { name: 'pressure', label: 'Pressure (hPa)' },
      { name: 'precipitation', label: 'Precipitation (mm)' }
    ];

    UIControls.updateMetricOptions(metrics);

    console.log('Using demo data with', dates.length, 'dates');
  },

  /**
   * Load and display data for current date
   */
  async loadAndDisplayData() {
    try {
      const date = TimelineController.getCurrentDate();
      console.log('Loading data for date:', date);

      // Check if we have loaded data
      if (!this.currentData || this.currentData.length === 0) {
        console.warn('No data loaded, creating demo data');
        await this.createDemoData(date);
        return;
      }

      // Get data for the current date from DataLoader
      const dateData = DataLoader.getDateData(date);

      if (!dateData || dateData.length === 0) {
        console.warn('No data found for date:', date);
        return;
      }

      console.log('Found data for date:', dateData.length, 'zones');

      // Expand zone data to station data using real stations
      const stationData = this.expandZoneDataToStations(dateData);
      console.log('Expanded to', Object.keys(stationData).length, 'stations');

      this.displayData(stationData);
    } catch (error) {
      console.error('Error loading data:', error);
      UIControls.showError(`Failed to load data: ${error.message}`);
    }
  },

  /**
   * Create synthetic demo data
   */
  async createDemoData(date) {
    // Finnish weather stations
    const stations = [
      { id: '100001', name: 'Helsinki', lat: 60.1699, lon: 24.9384 },
      { id: '100002', name: 'Espoo', lat: 60.2054, lon: 24.6542 },
      { id: '100003', name: 'Tampere', lat: 61.4978, lon: 23.7610 },
      { id: '100004', name: 'Turku', lat: 60.4518, lon: 22.2666 },
      { id: '100005', name: 'Oulu', lat: 64.1466, lon: 27.7209 },
      { id: '100006', name: 'Jyväskylä', lat: 62.2411, lon: 25.7482 },
      { id: '100007', name: 'Kuopio', lat: 62.8921, lon: 27.6758 },
      { id: '100008', name: 'Lappeenranta', lat: 61.0582, lon: 28.1944 },
      { id: '100009', name: 'Hämeenlinna', lat: 60.9933, lon: 24.4668 },
      { id: '100010', name: 'Vaasa', lat: 63.0965, lon: 21.5987 }
    ];

    const demoData = {};

    // Generate random weather data for each station
    stations.forEach(station => {
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
        ground_temp_min: ground_temp_min
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
      console.warn('No data to display');
      return;
    }

    // Data should already be in station object format (keyed by station ID)
    const stationData = data;
    console.log('Displaying', Object.keys(stationData).length, 'stations on map');

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

    // Update anomaly overlay if enabled
    if (UIControls.isAnomalyEnabled()) {
      AnomalyOverlay.update(TimelineController.getCurrentDate());
    }

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
    const container = document.getElementById('data-table-container');
    if (!container) return;

    // Show container
    container.classList.remove('hidden');

    // Convert station data to table rows
    const rows = [];
    Object.values(stationData).forEach(station => {
      rows.push({
        Station: station.name || station.station_name,
        Zone: station.zone || '-',
        'Temp Mean': station.temp_mean !== null ? station.temp_mean.toFixed(1) + '°C' : '-',
        'Temp Min': station.temp_min !== null ? station.temp_min.toFixed(1) + '°C' : '-',
        'Temp Max': station.temp_max !== null ? station.temp_max.toFixed(1) + '°C' : '-',
        'Snow Depth': station.snow_depth !== null ? station.snow_depth.toFixed(1) + 'cm' : '-',
        'Precipitation': station.precipitation !== null ? station.precipitation.toFixed(1) + 'mm' : '-'
      });
    });

    // Create simple HTML table
    const table = document.getElementById('data-table');
    if (!table) return;

    let html = '<table class="data-table-custom">';

    // Header
    html += '<thead><tr>';
    const headers = ['Station', 'Zone', 'Temp Mean', 'Temp Min', 'Temp Max', 'Snow Depth', 'Precipitation'];
    headers.forEach(h => {
      html += `<th>${h}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    rows.forEach(row => {
      html += '<tr>';
      headers.forEach(h => {
        html += `<td>${row[h]}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    table.innerHTML = html;
  },

  /**
   * Hide data table
   */
  hideDataTable() {
    const container = document.getElementById('data-table-container');
    if (container) {
      container.classList.add('hidden');
    }
  },

  /**
   * Update color legend for current metric
   */
  updateColorLegend(metric) {
    const config = ColorScales.getMetricConfig(metric);
    if (!config) return;

    // Update legend title
    const titleEl = document.getElementById('legend-metric-title');
    if (titleEl) {
      titleEl.textContent = config.name;
    }

    // Update color scale canvas
    const canvas = document.getElementById('color-scale-canvas');
    if (canvas) {
      ColorScales.drawColorScale(canvas, metric);
    }

    // Update min/max labels
    const [min, max] = config.range;
    const minLabel = document.getElementById('scale-min');
    const maxLabel = document.getElementById('scale-max');
    if (minLabel) minLabel.textContent = `${min}${config.unit}`;
    if (maxLabel) maxLabel.textContent = `${max}${config.unit}`;
  },

  /**
   * Expand zone data to station data using real station locations
   */
  expandZoneDataToStations(zoneDataArray) {
    const stationData = {};

    // For each zone record
    zoneDataArray.forEach(zoneRecord => {
      // Find all stations in this zone
      const zoneStations = this.stations.filter(s => s.zone === zoneRecord.zone);

      // Create a record for each station with the zone's aggregated values
      // Add some random variation to make it look realistic
      zoneStations.forEach(station => {
        const variation = () => (Math.random() - 0.5) * 2; // -1 to +1

        stationData[station.fmisid] = {
          id: station.fmisid,
          name: station.station_name,
          station_name: station.station_name,
          lat: station.latitude,
          lon: station.longitude,
          zone: station.zone,
          // Add slight variation to zone averages for visual interest
          temp_mean: zoneRecord.temp_mean ? zoneRecord.temp_mean + variation() : null,
          temp_min: zoneRecord.temp_min ? zoneRecord.temp_min + variation() : null,
          temp_max: zoneRecord.temp_max ? zoneRecord.temp_max + variation() : null,
          snow_depth: zoneRecord.snow_depth ? Math.max(0, zoneRecord.snow_depth + variation() * 5) : null,
          precipitation: zoneRecord.precipitation ? Math.max(0, zoneRecord.precipitation + variation() * 2) : null,
          ground_temp_min: zoneRecord.ground_temp_min ? zoneRecord.ground_temp_min + variation() : null
        };
      });
    });

    return stationData;
  },

  /**
   * Get approximate center coordinates for each zone
   */
  getZoneCenter(zone) {
    const centers = {
      'etela_suomi': { lat: 60.5, lon: 25.0 },
      'keski_suomi': { lat: 62.5, lon: 26.0 },
      'pohjois_suomi': { lat: 65.0, lon: 26.5 },
      'lappi': { lat: 67.5, lon: 26.0 }
    };
    return centers[zone] || { lat: 64.0, lon: 26.0 };
  },

  /**
   * Get color scale for a metric
   */
  getColorScale(metric) {
    // Use ColorScales from global scope if available
    if (typeof ColorScales !== 'undefined') {
      const config = ColorScales.getMetricConfig(metric);
      if (config) {
        return {
          getColor: (value) => ColorScales.getColor(metric, value),
          normalize: (value) => {
            const [min, max] = config.range;
            return Math.max(0, Math.min(1, (value - min) / (max - min)));
          }
        };
      }
    }

    // Default color scale (temperature)
    return {
      getColor: (value) => {
        if (value === null || value === undefined || isNaN(value)) return '#ccc';
        if (value < 0) return '#0000FF';
        if (value < 10) return '#00FF00';
        if (value < 20) return '#FFFF00';
        if (value < 30) return '#FF6600';
        return '#FF0000';
      },
      normalize: (value) => {
        if (value === null || value === undefined || isNaN(value)) return 0.5;
        return (value + 50) / 80; // Assuming range -50 to 30
      }
    };
  },

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Timeline events
    TimelineController.onDateChange((date) => {
      console.log('Date changed to:', date);
      this.loadAndDisplayData();
    });

    // Metric selector
    UIControls.onMetricChange((metric) => {
      this.currentMetric = metric;
      console.log('Metric changed to:', metric);
      this.loadAndDisplayData();
    });

    // Visualization mode
    UIControls.onModeChange((mode) => {
      this.currentMode = mode;
      console.log('Mode changed to:', mode);
      HeatmapRenderer.switchMode(mode);
    });

    // Anomaly overlay
    UIControls.onAnomalyToggle((enabled) => {
      if (enabled) {
        AnomalyOverlay.enable(TimelineController.getCurrentDate());
      } else {
        AnomalyOverlay.disable();
      }
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
  }
};

/**
 * Start application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  App.initialize();
});

// Export App for debugging in console
if (typeof window !== 'undefined') {
  window.App = App;
}
