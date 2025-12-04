/**
 * heatmapRenderer.js
 * Renders weather data on map using colored circles (Mode A) or interpolated grid (Mode B)
 */

const HeatmapRenderer = {
  currentMode: 'stations', // 'stations' or 'interpolated'
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
    if (!MapManager.map) {
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

    // Add markers to map
    MapManager.addStationMarkers(stations, colorFunction, radiusFunction);

    // Create popups for markers
    MapManager.markers.forEach((marker, index) => {
      if (stations[index]) {
        const station = stations[index];
        const popupContent = `
          <div class="station-popup">
            <strong>${station.name}</strong><br>
            ${metric}: ${station.value.toFixed(2)}
          </div>
        `;
        marker.bindPopup(popupContent);
      }
    });
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
    if (!MapManager.map) {
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
    const values = [];

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
      values.push(value);
    });

    if (stations.length === 0) {
      console.warn('No valid data for interpolated mode');
      return;
    }

    // Create large, semi-transparent circles that overlap
    // This creates a smooth gradient effect
    stations.forEach(station => {
      const color = colorScale.getColor(station.value);
      const normalized = colorScale.normalize(station.value);

      // Larger radius for smooth overlap
      const radius = 80000; // 80km radius in meters

      // Create circle with gradient effect
      const circle = L.circle([station.lat, station.lon], {
        radius: radius,
        fillColor: color,
        fillOpacity: 0.3, // Semi-transparent for blending
        color: color,
        opacity: 0.2,
        weight: 1
      });

      circle.addTo(MapManager.map);
      MapManager.markers.push(circle);

      // Add tooltip
      circle.bindTooltip(`
        <strong>${station.name}</strong><br>
        ${metric}: ${station.value.toFixed(1)}
      `, { permanent: false, direction: 'top' });
    });

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

    // Strategy: Create VERY large, VERY transparent overlapping circles
    // This makes them blend into one continuous region
    const bufferRadius = 90000; // 90km - larger for better coverage

    // First pass: Create the base snow coverage with very transparent circles
    snowStations.forEach(station => {
      const circle = L.circle([station.lat, station.lon], {
        radius: bufferRadius,
        fillColor: snowColor,
        fillOpacity: 0.15, // Very transparent - will build up with overlaps
        color: 'transparent', // No border
        weight: 0,
        interactive: false // Don't block clicks
      });

      circle.addTo(MapManager.map);
      MapManager.markers.push(circle);
    });

    // Second pass: Add slightly smaller, slightly more opaque circles for density
    snowStations.forEach(station => {
      const circle = L.circle([station.lat, station.lon], {
        radius: bufferRadius * 0.7,
        fillColor: snowColor,
        fillOpacity: 0.2,
        color: 'transparent',
        weight: 0,
        interactive: false
      });

      circle.addTo(MapManager.map);
      MapManager.markers.push(circle);
    });

    // Third pass: Core areas get more color
    snowStations.forEach(station => {
      const circle = L.circle([station.lat, station.lon], {
        radius: bufferRadius * 0.4,
        fillColor: snowColor,
        fillOpacity: 0.25,
        color: 'transparent',
        weight: 0,
        interactive: false
      });

      circle.addTo(MapManager.map);
      MapManager.markers.push(circle);
    });

    // Add small markers at station locations for reference
    allStations.forEach(station => {
      const hasSnow = station.value >= 0.5;
      const marker = L.circleMarker([station.lat, station.lon], {
        radius: hasSnow ? 3 : 2,
        fillColor: hasSnow ? '#ffffff' : '#666666',
        fillOpacity: hasSnow ? 0.8 : 0.3,
        color: hasSnow ? '#ffffff' : '#999999',
        weight: 1,
        opacity: hasSnow ? 1 : 0.5
      });

      marker.addTo(MapManager.map);
      MapManager.markers.push(marker);

      marker.bindTooltip(`
        <strong>${station.name}</strong><br>
        ${hasSnow ? `Snow: ${station.value.toFixed(1)} cm` : 'No snow'}
      `, { permanent: false, direction: 'top' });
    });

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
