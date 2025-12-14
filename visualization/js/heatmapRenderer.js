/**
 * heatmapRenderer.js
 * Renders weather data on D3 map using colored circles (Mode A) or interpolated grid (Mode B)
 */

const HeatmapRenderer = {
  currentMode: 'contour', // Use contour mode by default
  currentData: null,
  colorScale: null,
  metric: 'temperature',

  /**
   * Render data as station points with colored circles
   * @param {Object} data - Station data keyed by station ID
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderStationMode(data, metric, colorScale) {
    if (!MapManager.svg) {
      console.error('Map not initialized');
      return;
    }

    this.currentMode = 'stations';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    const stations = [];
    const values = [];

    // Prepare stations and values
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station.aggregated ? station.aggregated[metric] : station[metric];

      // Skip null/undefined values
      if (value === undefined || value === null) {
        return;
      }

      // For snow depth, only show stations with actual snow (> 0.5 cm threshold)
      if (metric === 'snow_depth' && value < 0.5) {
        return;
      }

      stations.push({
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value
      });
      values.push(value);
    });

    // Determine color and size for each station
    const colorFunction = (station) => {
      return colorScale.getColor(station.value);
    };

    const radiusFunction = (station) => {
      // Scale radius based on value
      const normValue = colorScale.normalize(station.value);
      return 4 + normValue * 8; // 4-12 pixels
    };

    // Add markers to map with tooltip info
    MapManager.addStationMarkersWithTooltip(stations, colorFunction, radiusFunction, metric);
  },

  /**
   * Render data as interpolated grid
   * Mode B: Creates larger, semi-transparent circles for smooth gradient effect
   * For snow depth, uses clear snow line visualization
   * @param {Object} data - Station data
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderInterpolatedMode(data, metric, colorScale) {
    if (!MapManager.svg) {
      console.error('Map not initialized');
      return;
    }

    // Use sharp snow line visualization for snow depth
    if (metric === 'snow_depth') {
      return this.renderSnowLineMode(data, metric, colorScale);
    }

    console.log('Interpolated mode - rendering smooth gradient');

    this.currentMode = 'interpolated';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    // Clear existing markers
    MapManager.clearMarkers();

    const stations = [];

    // Prepare stations and values
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station[metric];

      // Skip null/undefined/NaN values
      if (value === undefined || value === null || isNaN(value)) {
        return;
      }

      stations.push({
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value
      });
    });

    if (stations.length === 0) {
      console.warn('No valid data for interpolated mode');
      return;
    }

    // Create interpolation circles with radial gradient for smooth heatmap effect
    const circles = [];

    // Single circle per station - radial gradient handles smooth fading
    stations.forEach(station => {
      circles.push({
        lat: station.lat,
        lon: station.lon,
        radius: 70,
        color: colorScale.getColor(station.value),
        opacity: 0.6
      });
    });

    MapManager.addInterpolationCircles(circles);

    console.log(`Rendered ${stations.length} interpolated circles`);
  },

  /**
   * Render snow depth with clear snow line boundary
   * Shows one unified snow-covered region with clear boundary
   * @param {Object} data - Station data
   * @param {string} metric - snow_depth
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderSnowLineMode(data, metric, colorScale) {
    console.log('Snow line mode - rendering unified snow region');

    this.currentMode = 'interpolated';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    MapManager.clearMarkers();

    const snowStations = [];
    const allStations = [];

    // Collect all stations and separate by snow presence
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station[metric];

      if (value === undefined || value === null || isNaN(value)) {
        return;
      }

      const stationData = {
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value
      };

      allStations.push(stationData);
      if (value >= 0.5) {
        snowStations.push(stationData);
      }
    });

    console.log(`Snow stations: ${snowStations.length} / ${allStations.length}`);

    if (snowStations.length === 0) {
      console.warn('No snow coverage to render');
      return;
    }

    // Create interpolation circles with radial gradient for snow coverage
    const circles = [];

    // Single circle per station - radial gradient handles smooth fading
    snowStations.forEach(station => {
      circles.push({
        lat: station.lat,
        lon: station.lon,
        radius: 80,
        color: colorScale.getColor(station.value),
        opacity: 0.65
      });
    });

    MapManager.addInterpolationCircles(circles);

    console.log(`Rendered unified snow coverage area`);
  },

  /**
   * Render data as Voronoi cells (sharp boundaries between stations)
   * @param {Object} data - Station data
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderVoronoiMode(data, metric, colorScale) {
    if (!MapManager.svg) {
      console.error('Map not initialized');
      return;
    }

    console.log('Voronoi mode - rendering sharp boundary cells');

    this.currentMode = 'voronoi';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    MapManager.clearMarkers();

    const stations = [];

    // Prepare stations with valid values
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station[metric];

      // Skip null/undefined/NaN values
      if (value === undefined || value === null || isNaN(value)) {
        return;
      }

      // For snow depth, only include stations with actual snow
      if (metric === 'snow_depth' && value < 0.5) {
        return;
      }

      stations.push({
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value,
        color: colorScale.getColor(value)
      });
    });

    if (stations.length === 0) {
      console.warn('No valid data for Voronoi mode');
      return;
    }

    MapManager.addVoronoiCells(stations);

    console.log(`Rendered ${stations.length} Voronoi cells`);
  },

  /**
   * Render data as hexagonal grid
   * @param {Object} data - Station data
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderHexagonMode(data, metric, colorScale) {
    if (!MapManager.svg) {
      console.error('Map not initialized');
      return;
    }

    console.log('Hexagon mode - rendering hexagonal grid');

    this.currentMode = 'hexagon';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    MapManager.clearMarkers();

    const stations = [];

    // Prepare stations with valid values
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station[metric];

      if (value === undefined || value === null || isNaN(value)) {
        return;
      }

      if (metric === 'snow_depth' && value < 0.5) {
        return;
      }

      stations.push({
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value,
        color: colorScale.getColor(value)
      });
    });

    if (stations.length === 0) {
      console.warn('No valid data for Hexagon mode');
      return;
    }

    MapManager.addHexagonGrid(stations, 20);

    console.log(`Rendered hexagon grid from ${stations.length} stations`);
  },

  /**
   * Render data as contour lines (isobar-style)
   * @param {Object} data - Station data
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderContourMode(data, metric, colorScale) {
    if (!MapManager.svg) {
      console.error('Map not initialized');
      return;
    }

    console.log('Contour mode - rendering isobar-style visualization');

    this.currentMode = 'contour';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    MapManager.clearMarkers();

    const stations = [];

    // Prepare stations with valid values
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station[metric];

      if (value === undefined || value === null || isNaN(value)) {
        return;
      }

      if (metric === 'snow_depth' && value < 0.5) {
        return;
      }

      stations.push({
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value
      });
    });

    if (stations.length === 0) {
      console.warn('No valid data for Contour mode');
      return;
    }

    // Generate thresholds based on metric
    const thresholds = this._getContourThresholds(metric, stations);

    MapManager.addContourLines(stations, colorScale, thresholds);

    console.log(`Rendered contour lines from ${stations.length} stations`);
  },

  /**
   * Render data as rasterized IDW heatmap (canvas-based, smooth gradient)
   * @param {Object} data - Station data
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   * @returns {void}
   */
  renderRasterMode(data, metric, colorScale) {
    if (!MapManager.svg) {
      console.error('Map not initialized');
      return;
    }

    console.log('Raster mode - rendering pixel-level IDW heatmap');

    this.currentMode = 'raster';
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    MapManager.clearMarkers();

    const stations = [];

    // Prepare stations with valid values
    Object.keys(data).forEach(stationId => {
      const station = data[stationId];
      const value = station[metric];

      if (value === undefined || value === null || isNaN(value)) {
        return;
      }

      if (metric === 'snow_depth' && value < 0.5) {
        return;
      }

      stations.push({
        id: stationId,
        name: station.station_name || station.name,
        lat: station.lat,
        lon: station.lon,
        value: value
      });
    });

    if (stations.length === 0) {
      console.warn('No valid data for Raster mode');
      return;
    }

    MapManager.addRasterHeatmap(stations, colorScale, 150);

    console.log(`Rendered raster heatmap from ${stations.length} stations`);
  },

  /**
   * Get contour thresholds for a metric
   * @private
   */
  _getContourThresholds(metric, stations) {
    const values = stations.map(s => s.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Metric-specific thresholds
    const metricThresholds = {
      temp_mean: [-30, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30],
      temp_min: [-40, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20],
      temp_max: [-20, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35],
      snow_depth: [1, 5, 10, 20, 30, 50, 70, 100],
      precipitation: [0, 1, 2, 5, 10, 15, 20, 30, 40]
    };

    const predefined = metricThresholds[metric];
    if (predefined) {
      // Filter to only include thresholds within data range (with some margin)
      return predefined.filter(t => t >= min - 5 && t <= max + 5);
    }

    // Generate automatic thresholds
    const step = (max - min) / 10;
    const thresholds = [];
    for (let v = min; v <= max; v += step) {
      thresholds.push(Math.round(v));
    }
    return thresholds;
  },

  /**
   * Switch rendering mode
   * @param {string} mode - 'stations', 'interpolated', 'voronoi', 'hexagon', 'contour', or 'raster'
   */
  switchMode(mode) {
    const validModes = ['stations', 'interpolated', 'voronoi', 'hexagon', 'contour', 'raster'];
    if (validModes.includes(mode)) {
      this.currentMode = mode;
      const data = this.currentData;
      const metric = this.metric;
      const colorScale = this.colorScale;

      if (!data || !colorScale) return;

      switch (mode) {
        case 'stations':
          this.renderStationMode(data, metric, colorScale);
          break;
        case 'voronoi':
          this.renderVoronoiMode(data, metric, colorScale);
          break;
        case 'hexagon':
          this.renderHexagonMode(data, metric, colorScale);
          break;
        case 'contour':
          this.renderContourMode(data, metric, colorScale);
          break;
        case 'raster':
          this.renderRasterMode(data, metric, colorScale);
          break;
        default:
          this.renderInterpolatedMode(data, metric, colorScale);
      }
    }
  },

  /**
   * Update visualization with new data
   * @param {Object} data - New station data
   * @param {string} metric - Metric to visualize
   * @param {Object} colorScale - Color scale object
   */
  updateVisualization(data, metric, colorScale) {
    this.currentData = data;
    this.metric = metric;
    this.colorScale = colorScale;

    switch (this.currentMode) {
      case 'stations':
        this.renderStationMode(data, metric, colorScale);
        break;
      case 'voronoi':
        this.renderVoronoiMode(data, metric, colorScale);
        break;
      case 'hexagon':
        this.renderHexagonMode(data, metric, colorScale);
        break;
      case 'contour':
        this.renderContourMode(data, metric, colorScale);
        break;
      case 'raster':
        this.renderRasterMode(data, metric, colorScale);
        break;
      default:
        this.renderInterpolatedMode(data, metric, colorScale);
    }
  },

  /**
   * Clear all visualization layers
   */
  clear() {
    MapManager.clearMarkers();
    this.currentData = null;
  },

  /**
   * Get statistics for current data
   * @returns {Object} Stats object with min, max, mean, etc.
   */
  getDataStatistics() {
    if (!this.currentData || !this.metric) {
      return null;
    }

    const values = [];
    Object.keys(this.currentData).forEach(stationId => {
      const station = this.currentData[stationId];
      const value = station.aggregated ? station.aggregated[this.metric] : station[this.metric];
      if (value !== undefined && value !== null) {
        values.push(value);
      }
    });

    if (values.length === 0) {
      return null;
    }

    values.sort((a, b) => a - b);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: values[Math.floor(values.length / 2)],
      count: values.length
    };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeatmapRenderer;
}
