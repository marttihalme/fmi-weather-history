/**
 * dataTable.js
 * Display weather data in interactive table using Plotly
 */

const DataTable = {
  currentData: null,
  selectedMetrics: ['temperature', 'humidity', 'pressure'],
  containerId: 'dataTableContainer',

  /**
   * Initialize data table
   * @param {string} containerId - ID of container element
   */
  initialize(containerId) {
    this.containerId = containerId;
  },

  /**
   * Render data table with Plotly
   * @param {Array} stationData - Array of station data objects
   * @param {Array} metrics - Metrics to display (optional)
   */
  render(stationData, metrics = null) {
    if (!stationData || !Array.isArray(stationData) || stationData.length === 0) {
      console.warn('No data provided for table');
      return;
    }

    this.currentData = stationData;

    if (metrics) {
      this.selectedMetrics = metrics;
    }

    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`Container '${this.containerId}' not found`);
      return;
    }

    // Prepare table data
    const tableData = this.prepareTableData(stationData);

    // Check if Plotly is available
    if (typeof Plotly === 'undefined') {
      console.warn('Plotly not available, rendering basic HTML table');
      this.renderHTMLTable(container, tableData);
      return;
    }

    // Render with Plotly
    this.renderPlotlyTable(container, tableData);
  },

  /**
   * Prepare table data from station data
   * @param {Array} stationData - Station data
   * @returns {Object} Formatted table data
   * @private
   */
  prepareTableData(stationData) {
    const headers = ['Station', ...this.selectedMetrics];
    const rows = [];

    if (typeof stationData === 'object' && !Array.isArray(stationData)) {
      // Data is keyed by station ID
      Object.keys(stationData).forEach(stationId => {
        const station = stationData[stationId];
        const row = [station.station_name || station.name || stationId];

        this.selectedMetrics.forEach(metric => {
          const value = station.aggregated ? station.aggregated[metric] : station[metric];
          row.push(value !== undefined ? value.toFixed(2) : '-');
        });

        rows.push(row);
      });
    } else if (Array.isArray(stationData)) {
      // Data is array format
      stationData.forEach(station => {
        const row = [station.station_name || station.name || station.id];

        this.selectedMetrics.forEach(metric => {
          const value = station.aggregated ? station.aggregated[metric] : station[metric];
          row.push(value !== undefined ? value.toFixed(2) : '-');
        });

        rows.push(row);
      });
    }

    return { headers, rows };
  },

  /**
   * Render table using Plotly
   * @param {HTMLElement} container - Container element
   * @param {Object} tableData - Table data
   * @private
   */
  renderPlotlyTable(container, tableData) {
    if (typeof Plotly === 'undefined') {
      this.renderHTMLTable(container, tableData);
      return;
    }

    const trace = {
      type: 'table',
      header: {
        values: tableData.headers,
        align: 'center',
        fill: { color: '#40466e' },
        font: { color: 'white', size: 12 }
      },
      cells: {
        values: this.transposeArray(tableData.rows),
        align: 'center',
        fill: { color: 'white' },
        font: { size: 11 }
      }
    };

    const layout = {
      title: 'Weather Station Data',
      margin: { l: 0, r: 0, t: 40, b: 0 }
    };

    Plotly.newPlot(this.containerId, [trace], layout, { responsive: true });
  },

  /**
   * Render basic HTML table
   * @param {HTMLElement} container - Container element
   * @param {Object} tableData - Table data
   * @private
   */
  renderHTMLTable(container, tableData) {
    let html = '<table class="data-table"><thead><tr>';

    // Headers
    tableData.headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Rows
    tableData.rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  /**
   * Transpose array (convert rows to columns)
   * @param {Array} arr - 2D array
   * @returns {Array} Transposed array
   * @private
   */
  transposeArray(arr) {
    if (!arr || arr.length === 0) return [];

    const cols = arr[0].length;
    const transposed = [];

    for (let j = 0; j < cols; j++) {
      const col = [];
      for (let i = 0; i < arr.length; i++) {
        col.push(arr[i][j]);
      }
      transposed.push(col);
    }

    return transposed;
  },

  /**
   * Update selected metrics
   * @param {Array} metrics - Metric names to display
   */
  setMetrics(metrics) {
    this.selectedMetrics = metrics;
    if (this.currentData) {
      this.render(this.currentData);
    }
  },

  /**
   * Sort table by column
   * @param {string} column - Column name
   * @param {string} order - 'asc' or 'desc'
   */
  sortBy(column, order = 'asc') {
    if (!this.currentData) return;

    const data = Array.isArray(this.currentData)
      ? [...this.currentData]
      : Object.values(this.currentData);

    const metricIndex = this.selectedMetrics.indexOf(column);

    data.sort((a, b) => {
      const aVal = a.aggregated ? a.aggregated[column] : a[column];
      const bVal = b.aggregated ? b.aggregated[column] : b[column];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      const comparison = aVal - bVal;
      return order === 'asc' ? comparison : -comparison;
    });

    this.render(data);
  },

  /**
   * Filter table by metric range
   * @param {string} metric - Metric to filter
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   */
  filterByRange(metric, min, max) {
    if (!this.currentData) return;

    const data = Array.isArray(this.currentData)
      ? [...this.currentData]
      : Object.values(this.currentData);

    const filtered = data.filter(station => {
      const value = station.aggregated ? station.aggregated[metric] : station[metric];
      return value !== undefined && value >= min && value <= max;
    });

    this.render(filtered);
  },

  /**
   * Export table data to CSV
   * @returns {string} CSV content
   */
  exportToCSV() {
    const tableData = this.prepareTableData(this.currentData);

    let csv = tableData.headers.join(',') + '\n';
    tableData.rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    return csv;
  },

  /**
   * Download table as CSV file
   * @param {string} filename - Output filename
   */
  downloadCSV(filename = 'weather-data.csv') {
    const csv = this.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Clear table
   */
  clear() {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = '';
    }
    this.currentData = null;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataTable;
}
