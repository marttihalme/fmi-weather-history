/**
 * dataProcessor.js
 * Utilities for processing weather data - filtering, aggregation, transformations
 */

const DataProcessor = {
  /**
   * Filter data by date range
   * @param {Array} data - Array of data records
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Filtered data
   */
  filterByDateRange(data, startDate, endDate) {
    if (!data || !Array.isArray(data)) return [];

    return data.filter(record => {
      if (!record.date) return false;
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
  },

  /**
   * Filter data by metric value range
   * @param {Array} data - Array of data records
   * @param {string} metric - Metric name (e.g., 'temperature')
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Array} Filtered data
   */
  filterByMetricRange(data, metric, min, max) {
    if (!data || !Array.isArray(data)) return [];

    return data.filter(record => {
      const value = record[metric];
      return value !== undefined && value !== null && value >= min && value <= max;
    });
  },

  /**
   * Aggregate data by station
   * @param {Array} data - Array of data records
   * @param {string} aggregateMethod - 'mean', 'max', 'min', 'sum'
   * @returns {Object} Aggregated data by station
   */
  aggregateByStation(data, aggregateMethod = 'mean') {
    if (!data || !Array.isArray(data)) return {};

    const aggregated = {};

    data.forEach(record => {
      const stationId = record.station_id || record.id;
      if (!stationId) return;

      if (!aggregated[stationId]) {
        aggregated[stationId] = {
          station_id: stationId,
          station_name: record.station_name,
          lat: record.lat,
          lon: record.lon,
          values: []
        };
      }

      // Collect all metric values
      const metrics = {};
      Object.keys(record).forEach(key => {
        if (key !== 'station_id' && key !== 'id' && key !== 'station_name' &&
            key !== 'lat' && key !== 'lon' && key !== 'date' && typeof record[key] === 'number') {
          metrics[key] = record[key];
        }
      });

      aggregated[stationId].values.push(metrics);
    });

    // Apply aggregation method
    Object.keys(aggregated).forEach(stationId => {
      const station = aggregated[stationId];
      const aggregatedMetrics = {};

      if (station.values.length > 0) {
        const metricKeys = Object.keys(station.values[0]);

        metricKeys.forEach(metric => {
          const values = station.values.map(v => v[metric]).filter(v => v !== null && v !== undefined);

          if (values.length > 0) {
            switch (aggregateMethod) {
              case 'max':
                aggregatedMetrics[metric] = Math.max(...values);
                break;
              case 'min':
                aggregatedMetrics[metric] = Math.min(...values);
                break;
              case 'sum':
                aggregatedMetrics[metric] = values.reduce((a, b) => a + b, 0);
                break;
              case 'mean':
              default:
                aggregatedMetrics[metric] = values.reduce((a, b) => a + b, 0) / values.length;
                break;
            }
          }
        });
      }

      station.aggregated = aggregatedMetrics;
      delete station.values;
    });

    return aggregated;
  },

  /**
   * Get unique stations from data
   * @param {Array} data - Array of data records
   * @returns {Array} Array of unique stations with location info
   */
  getUniqueStations(data) {
    if (!data || !Array.isArray(data)) return [];

    const stationMap = {};
    data.forEach(record => {
      const stationId = record.station_id || record.id;
      if (stationId && !stationMap[stationId]) {
        stationMap[stationId] = {
          id: stationId,
          name: record.station_name || stationId,
          lat: record.lat,
          lon: record.lon
        };
      }
    });

    return Object.values(stationMap);
  },

  /**
   * Get unique dates from data
   * @param {Array} data - Array of data records
   * @returns {Array} Array of unique dates sorted
   */
  getUniqueDates(data) {
    if (!data || !Array.isArray(data)) return [];

    const dateSet = new Set();
    data.forEach(record => {
      if (record.date) {
        dateSet.add(new Date(record.date).toISOString().split('T')[0]);
      }
    });

    return Array.from(dateSet).sort();
  },

  /**
   * Get data for specific date
   * @param {Array} data - Array of data records
   * @param {Date|string} date - Target date
   * @returns {Array} Data for that date
   */
  getDataForDate(data, date) {
    if (!data || !Array.isArray(data)) return [];

    const targetDate = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];

    return data.filter(record => {
      if (!record.date) return false;
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      return recordDate === targetDate;
    });
  },

  /**
   * Calculate anomaly (difference from baseline)
   * @param {Array} currentData - Current period data
   * @param {Array} baselineData - Baseline period data
   * @returns {Object} Anomaly data keyed by station
   */
  calculateAnomalies(currentData, baselineData) {
    const currentAgg = this.aggregateByStation(currentData, 'mean');
    const baselineAgg = this.aggregateByStation(baselineData, 'mean');

    const anomalies = {};

    Object.keys(currentAgg).forEach(stationId => {
      if (!baselineAgg[stationId]) return;

      const current = currentAgg[stationId].aggregated;
      const baseline = baselineAgg[stationId].aggregated;

      anomalies[stationId] = {
        station_id: stationId,
        station_name: currentAgg[stationId].station_name,
        lat: currentAgg[stationId].lat,
        lon: currentAgg[stationId].lon,
        anomalies: {}
      };

      Object.keys(current).forEach(metric => {
        if (baseline[metric] !== undefined) {
          anomalies[stationId].anomalies[metric] = current[metric] - baseline[metric];
        }
      });
    });

    return anomalies;
  },

  /**
   * Normalize values to 0-1 range
   * @param {Array} values - Array of numeric values
   * @returns {Object} Object with normalized values and min/max info
   */
  normalizeValues(values) {
    const validValues = values.filter(v => v !== null && v !== undefined && typeof v === 'number');

    if (validValues.length === 0) {
      return { normalized: [], min: 0, max: 1 };
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const range = max - min || 1;

    const normalized = values.map(v => {
      if (v === null || v === undefined) return null;
      return (v - min) / range;
    });

    return { normalized, min, max };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataProcessor;
}
