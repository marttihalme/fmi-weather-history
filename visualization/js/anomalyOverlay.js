/**
 * anomalyOverlay.js
 * Display weather anomalies on map and timeline
 */

const AnomalyOverlay = {
  isEnabled: false,
  currentDate: null,
  anomalyMarkers: [],
  anomalyLayers: [],

  /**
   * Enable anomaly overlay visualization
   * @param {string} date - Current date to check for anomalies
   */
  enable(date) {
    this.isEnabled = true;
    this.currentDate = date;
    this.render();
  },

  /**
   * Disable anomaly overlay
   */
  disable() {
    this.isEnabled = false;
    this.clear();
  },

  /**
   * Update anomaly overlay for new date
   * @param {string} date - Date to show anomalies for
   */
  update(date) {
    this.currentDate = date;
    if (this.isEnabled) {
      this.render();
    }
  },

  /**
   * Render anomalies on map
   */
  render() {
    if (!this.isEnabled || !this.currentDate || !MapManager.map) {
      return;
    }

    this.clear();

    // Get anomalies for current date from DataLoader
    const anomalies = DataLoader.getAnomaliesForDate(this.currentDate);

    if (!anomalies || anomalies.length === 0) {
      return;
    }

    console.log(`Found ${anomalies.length} anomalies for ${this.currentDate}`);

    // Zone center coordinates (approximate)
    const zoneCenters = {
      'Etelä-Suomi': { lat: 60.5, lon: 25.0 },
      'Keski-Suomi': { lat: 62.5, lon: 26.0 },
      'Pohjois-Suomi': { lat: 65.0, lon: 26.5 },
      'Lappi': { lat: 67.5, lon: 26.0 }
    };

    // Anomaly type colors (from plan)
    const anomalyColors = {
      'Äärimmäinen kylmyys': '#2171b5',     // Extreme cold - dark blue
      'Ankara pakkasjakso': '#6baed6',      // Cold snap - light blue
      'Hellejakso': '#de2d26',              // Heat wave - red
      'Takatalvi': '#756bb1',               // Return winter - purple
      'Äkillinen lämpeneminen': '#fdae6b'   // Temperature jump - orange
    };

    // Anomaly type icons
    const anomalyIcons = {
      'Äärimmäinen kylmyys': '❄️',
      'Ankara pakkasjakso': '🥶',
      'Hellejakso': '🔥',
      'Takatalvi': '❄️',
      'Äkillinen lämpeneminen': '⚡'
    };

    // Render each anomaly
    anomalies.forEach(anomaly => {
      // Skip anomalies without zone or invalid zone
      if (!anomaly.zone || !zoneCenters[anomaly.zone]) {
        console.warn('Skipping anomaly with invalid zone:', anomaly);
        return;
      }

      const center = zoneCenters[anomaly.zone];

      const color = anomalyColors[anomaly.type] || '#999';
      const icon = anomalyIcons[anomaly.type] || '⚠️';

      // Create semi-transparent zone overlay
      const circle = L.circle([center.lat, center.lon], {
        radius: 100000, // 100km radius
        fillColor: color,
        fillOpacity: 0.25,
        color: color,
        opacity: 0.6,
        weight: 3,
        dashArray: '10, 5'
      });

      circle.addTo(MapManager.map);
      this.anomalyLayers.push(circle);

      // Create icon marker
      const divIcon = L.divIcon({
        html: `<div style="font-size: 32px; text-shadow: 0 0 3px white;">${icon}</div>`,
        className: 'anomaly-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([center.lat, center.lon], { icon: divIcon });

      // Tooltip with anomaly details
      let tooltipText = `<strong>${anomaly.type}</strong><br>`;
      tooltipText += `Zone: ${anomaly.zone}<br>`;
      tooltipText += `Date: ${anomaly.start_date}<br>`;
      if (anomaly.duration_days > 1) {
        tooltipText += `Duration: ${anomaly.duration_days} days<br>`;
      }
      if (anomaly.min_temperature !== null) {
        tooltipText += `Min temp: ${anomaly.min_temperature}°C<br>`;
      }
      if (anomaly.max_temperature !== null) {
        tooltipText += `Max temp: ${anomaly.max_temperature}°C`;
      }

      marker.bindTooltip(tooltipText, { permanent: false, direction: 'top' });
      marker.addTo(MapManager.map);

      this.anomalyMarkers.push(marker);
    });

    console.log(`Rendered ${this.anomalyMarkers.length} anomaly markers`);
  },

  /**
   * Clear all anomaly markers
   */
  clear() {
    this.anomalyMarkers.forEach(marker => {
      if (MapManager.map) {
        MapManager.map.removeLayer(marker);
      }
    });
    this.anomalyMarkers = [];

    this.anomalyLayers.forEach(layer => {
      if (MapManager.map) {
        MapManager.map.removeLayer(layer);
      }
    });
    this.anomalyLayers = [];
  },

  /**
   * Toggle anomaly overlay on/off
   */
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else if (this.currentAnomalies) {
      this.render();
      this.isEnabled = true;
    }
  },

  /**
   * Get anomaly statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    if (!this.currentAnomalies || !this.metric) {
      return null;
    }

    const anomalies = [];
    Object.keys(this.currentAnomalies).forEach(stationId => {
      const station = this.currentAnomalies[stationId];
      const anomalyValue = station.anomalies[this.metric];
      if (anomalyValue !== undefined) {
        anomalies.push(anomalyValue);
      }
    });

    if (anomalies.length === 0) return null;

    const sorted = anomalies.sort((a, b) => a - b);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: anomalies.reduce((a, b) => a + b, 0) / anomalies.length,
      median: sorted[Math.floor(sorted.length / 2)],
      positiveCount: anomalies.filter(a => a > 0).length,
      negativeCount: anomalies.filter(a => a < 0).length,
      count: anomalies.length
    };
  },

  /**
   * Create anomaly legend
   * @returns {string} HTML string for legend
   */
  createLegend() {
    const stats = this.getStatistics();
    if (!stats) return '';

    return `
      <div class="anomaly-legend">
        <h4>Anomaly Statistics</h4>
        <p>Min: ${stats.min.toFixed(2)}</p>
        <p>Max: ${stats.max.toFixed(2)}</p>
        <p>Mean: ${stats.mean.toFixed(2)}</p>
        <p>Positive: ${stats.positiveCount} stations</p>
        <p>Negative: ${stats.negativeCount} stations</p>
      </div>
    `;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnomalyOverlay;
}
