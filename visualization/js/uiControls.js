/**
 * uiControls.js
 * Handle UI interactions - metric selector, mode toggle, checkboxes, tabs
 */

const UIControls = {
  callbacks: {
    onMetricChange: null,
    onModeChange: null,
    onAnomalyToggle: null,
    onAnomalyTimelineToggle: null,
    onWinterToggle: null,
    onDataTableToggle: null
  },

  /**
   * Initialize UI controls
   */
  initialize() {
    this.attachMetricSelector();
    this.attachModeToggle();
    this.attachCheckboxes();
    this.attachTabNavigation();
  },

  /**
   * Attach metric selector event handler
   */
  attachMetricSelector() {
    const metricSelect = document.getElementById('metric-selector');
    if (metricSelect) {
      metricSelect.addEventListener('change', (e) => {
        const metric = e.target.value;
        console.log('Metric changed to:', metric);
        if (this.callbacks.onMetricChange) {
          this.callbacks.onMetricChange(metric);
        }
      });
    } else {
      console.warn('Metric selector not found');
    }
  },

  /**
   * Attach mode toggle (stations vs interpolated)
   */
  attachModeToggle() {
    const modeToggle = document.getElementById('heatmap-mode');
    if (modeToggle) {
      modeToggle.addEventListener('change', (e) => {
        const mode = e.target.value; // select value, not checkbox
        console.log('Mode changed to:', mode);
        if (this.callbacks.onModeChange) {
          this.callbacks.onModeChange(mode);
        }
      });
    } else {
      console.warn('Mode toggle not found');
    }
  },

  /**
   * Attach checkbox event handlers
   */
  attachCheckboxes() {
    const anomalyCheckbox = document.getElementById('toggle-anomalies');
    if (anomalyCheckbox) {
      anomalyCheckbox.addEventListener('change', (e) => {
        console.log('Anomalies toggled:', e.target.checked);
        if (this.callbacks.onAnomalyToggle) {
          this.callbacks.onAnomalyToggle(e.target.checked);
        }
      });
    } else {
      console.warn('Anomaly checkbox not found');
    }

    const anomalyTimelineCheckbox = document.getElementById('toggle-anomaly-timeline');
    if (anomalyTimelineCheckbox) {
      anomalyTimelineCheckbox.addEventListener('change', (e) => {
        console.log('Anomaly timeline toggled:', e.target.checked);
        const timeline = document.getElementById('anomaly-timeline');
        if (timeline) {
          if (e.target.checked) {
            timeline.classList.remove('anomaly-timeline-hidden');
            timeline.classList.add('anomaly-timeline-visible');
          } else {
            timeline.classList.remove('anomaly-timeline-visible');
            timeline.classList.add('anomaly-timeline-hidden');
          }
        }
        if (this.callbacks.onAnomalyTimelineToggle) {
          this.callbacks.onAnomalyTimelineToggle(e.target.checked);
        }
      });
    } else {
      console.warn('Anomaly timeline checkbox not found');
    }

    const winterCheckbox = document.getElementById('toggle-winter');
    if (winterCheckbox) {
      winterCheckbox.addEventListener('change', (e) => {
        console.log('Winter toggled:', e.target.checked);
        if (this.callbacks.onWinterToggle) {
          this.callbacks.onWinterToggle(e.target.checked);
        }
      });
    } else {
      console.warn('Winter checkbox not found');
    }

    const dataTableCheckbox = document.getElementById('toggle-table');
    if (dataTableCheckbox) {
      dataTableCheckbox.addEventListener('change', (e) => {
        console.log('Table toggled:', e.target.checked);
        if (this.callbacks.onDataTableToggle) {
          this.callbacks.onDataTableToggle(e.target.checked);
        }
      });
    } else {
      console.warn('Table checkbox not found');
    }
  },

  /**
   * Attach tab navigation
   */
  attachTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log('Found', tabButtons.length, 'tab buttons');

    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = button.getAttribute('data-tab');
        console.log('Tab clicked:', tabName);
        this.switchTab(tabName);
      });
    });
  },

  /**
   * Switch active tab
   * @param {string} tabName - Name of tab to activate
   */
  switchTab(tabName) {
    console.log('Switching to tab:', tabName);

    // Hide all tab contents
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => {
      tab.classList.remove('active');
    });

    // Deactivate all tab buttons
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => {
      button.classList.remove('active');
    });

    // Show selected tab content
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
      selectedTab.classList.add('active');
      console.log('Activated tab:', tabName);
    } else {
      console.warn('Tab not found:', tabName + '-tab');
    }

    // Activate selected button
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active');
    }
  },

  /**
   * Get current metric selection
   * @returns {string} Selected metric
   */
  getSelectedMetric() {
    const metricSelect = document.getElementById('metricSelector');
    return metricSelect ? metricSelect.value : 'temperature';
  },

  /**
   * Get current mode
   * @returns {string} 'stations' or 'interpolated'
   */
  getCurrentMode() {
    const modeSelect = document.getElementById('heatmap-mode');
    return modeSelect ? modeSelect.value : 'stations';
  },

  /**
   * Check if anomaly overlay is enabled
   * @returns {boolean}
   */
  isAnomalyEnabled() {
    const anomalyCheckbox = document.getElementById('toggle-anomalies');
    return anomalyCheckbox ? anomalyCheckbox.checked : false;
  },

  /**
   * Check if winter progression is enabled
   * @returns {boolean}
   */
  isWinterEnabled() {
    const winterCheckbox = document.getElementById('toggle-winter');
    return winterCheckbox ? winterCheckbox.checked : false;
  },

  /**
   * Check if data table is enabled
   * @returns {boolean}
   */
  isDataTableEnabled() {
    const dataTableCheckbox = document.getElementById('toggle-table');
    return dataTableCheckbox ? dataTableCheckbox.checked : false;
  },

  /**
   * Register callback for metric changes
   * @param {Function} callback
   */
  onMetricChange(callback) {
    this.callbacks.onMetricChange = callback;
  },

  /**
   * Register callback for mode changes
   * @param {Function} callback
   */
  onModeChange(callback) {
    this.callbacks.onModeChange = callback;
  },

  /**
   * Register callback for anomaly toggle
   * @param {Function} callback
   */
  onAnomalyToggle(callback) {
    this.callbacks.onAnomalyToggle = callback;
  },

  /**
   * Register callback for winter toggle
   * @param {Function} callback
   */
  onWinterToggle(callback) {
    this.callbacks.onWinterToggle = callback;
  },

  /**
   * Register callback for data table toggle
   * @param {Function} callback
   */
  onDataTableToggle(callback) {
    this.callbacks.onDataTableToggle = callback;
  },

  /**
   * Update metric selector options
   * @param {Array} metrics - Array of metric objects {name, label}
   */
  updateMetricOptions(metrics) {
    const metricSelect = document.getElementById('metricSelector');
    if (!metricSelect) return;

    metricSelect.innerHTML = '';
    metrics.forEach(metric => {
      const option = document.createElement('option');
      option.value = metric.name;
      option.textContent = metric.label;
      metricSelect.appendChild(option);
    });
  },

  /**
   * Enable/disable controls
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    const controls = [
      'metricSelector',
      'modeToggle',
      'anomalyCheckbox',
      'winterCheckbox',
      'dataTableCheckbox',
      'dateSlider',
      'playButton'
    ];

    controls.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.disabled = !enabled;
      }
    });
  },

  /**
   * Show loading indicator
   */
  showLoading() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
      loader.style.display = 'block';
    }
    this.setEnabled(false);
  },

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
      loader.style.display = 'none';
    }
    this.setEnabled(true);
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
      errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
      errorContainer.style.display = 'block';
    }
  },

  /**
   * Hide error message
   */
  hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  },

  /**
   * Show information message
   * @param {string} message - Info message
   */
  showInfo(message) {
    const infoContainer = document.getElementById('infoContainer');
    if (infoContainer) {
      infoContainer.innerHTML = `<div class="info-message">${message}</div>`;
      infoContainer.style.display = 'block';

      // Auto-hide after 5 seconds
      setTimeout(() => {
        infoContainer.style.display = 'none';
      }, 5000);
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIControls;
}
