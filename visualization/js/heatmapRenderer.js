/**
 * heatmapRenderer.js
 * Renders weather data on D3 map using colored circles (Mode A) or interpolated grid (Mode B)
 */

const HeatmapRenderer = {
  currentMode: 'interpolated', // Always use interpolated mode
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

    // Create interpolation circles for smooth heatmap effect
    const circles = [];

    // Multiple passes for smooth blending
    [80, 56, 32].forEach((radius, passIndex) => {
      const opacity = 0.15 + passIndex * 0.05;

      stations.forEach(station => {
        circles.push({
          lat: station.lat,
          lon: station.lon,
          radius: radius,
          color: colorScale.getColor(station.value),
          opacity: opacity
        });
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

    // Calculate average snow depth and dominant color
    const avgSnow = snowStations.reduce((sum, s) => sum + s.value, 0) / snowStations.length;
    const snowColor = colorScale.getColor(avgSnow);

    // Create interpolation circles for snow coverage
    const circles = [];

    // Multiple passes for smooth blending
    [90, 63, 36].forEach((radius, passIndex) => {
      const opacity = 0.15 + passIndex * 0.1;

      snowStations.forEach(station => {
        circles.push({
          lat: station.lat,
          lon: station.lon,
          radius: radius,
          color: snowColor,
          opacity: opacity
        });
      });
    });

    MapManager.addInterpolationCircles(circles);

    console.log(`Rendered unified snow coverage area`);
  },

  /**
   * Switch rendering mode
   * @param {string} mode - 'stations' or 'interpolated'
   */
  switchMode(mode) {
    if (mode === 'stations' || mode === 'interpolated') {
      const data = this.currentData;
      const metric = this.metric;
      const colorScale = this.colorScale;

      if (mode === 'stations') {
        this.renderStationMode(data, metric, colorScale);
      } else {
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

    if (this.currentMode === 'stations') {
      this.renderStationMode(data, metric, colorScale);
    } else {
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
