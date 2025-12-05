/**
 * anomalyOverlay.js
 * Display weather anomalies on D3 map and timeline
 */

const AnomalyOverlay = {
  isEnabled: false,
  currentDate: null,
  anomalyElements: [],

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
    if (!this.isEnabled || !this.currentDate || !MapManager.svg) {
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
      const [x, y] = MapManager.latLonToPixel(center.lat, center.lon);

      const color = anomalyColors[anomaly.type] || '#999';
      const icon = anomalyIcons[anomaly.type] || '⚠️';

      // Create semi-transparent zone overlay circle
      const scale = MapManager.getScaleFactor();
      const radius = 100 * scale; // 100km radius

      const circle = MapManager.g.append('circle')
        .attr('class', 'anomaly-zone')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', radius)
        .attr('fill', color)
        .attr('fill-opacity', 0.25)
        .attr('stroke', color)
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '10, 5');

      this.anomalyElements.push(circle);

      // Create icon text element
      const iconText = MapManager.g.append('text')
        .attr('class', 'anomaly-icon')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', '24px')
        .style('text-shadow', '0 0 3px white')
        .text(icon);

      this.anomalyElements.push(iconText);

      // Create tooltip on hover
      let tooltipText = `${anomaly.type}\n`;
      tooltipText += `Zone: ${anomaly.zone}\n`;
      tooltipText += `Date: ${anomaly.start_date}`;
      if (anomaly.duration_days > 1) {
        tooltipText += `\nDuration: ${anomaly.duration_days} days`;
      }
      if (anomaly.min_temperature !== null) {
        tooltipText += `\nMin temp: ${anomaly.min_temperature}°C`;
      }
      if (anomaly.max_temperature !== null) {
        tooltipText += `\nMax temp: ${anomaly.max_temperature}°C`;
      }

      // Add title for tooltip
      iconText.append('title').text(tooltipText);
      circle.append('title').text(tooltipText);
    });

    console.log(`Rendered ${this.anomalyElements.length / 2} anomaly markers`);
  },

  /**
   * Clear all anomaly markers
   */
  clear() {
    if (MapManager.g) {
      MapManager.g.selectAll('.anomaly-zone').remove();
      MapManager.g.selectAll('.anomaly-icon').remove();
    }
    this.anomalyElements = [];
  },

  /**
   * Toggle anomaly overlay on/off
   */
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else if (this.currentDate) {
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
