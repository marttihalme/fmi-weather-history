/**
 * uiControls.js
 * Handle UI interactions - metric selector, mode toggle, checkboxes, tabs
 */

const UIControls = {
  callbacks: {
    onMetricChange: null,
    onAnomalyTimelineToggle: null,
    onWinterToggle: null,
    onStationsToggle: null,
    onRefresh30Click: null,
    onRenderModeChange: null,
  },

  // Base path for GitHub Pages (auto-detected)
  basePath: '',

  // Route mapping: URL path -> tab name (relative to basePath)
  routes: {
    '/explore': 'exploration',
    '/compare-years': 'compare-years',
    '/data-management': 'data-management',
    '': 'exploration',
    '/': 'exploration',
  },

  // Reverse mapping: tab name -> URL path (relative to basePath)
  tabToRoute: {
    'exploration': '/explore',
    'compare-years': '/compare-years',
    'data-management': '/data-management',
  },

  /**
   * Detect base path from current URL (for GitHub Pages subdirectory hosting)
   */
  detectBasePath() {
    const path = window.location.pathname;
    // Check if we're on GitHub Pages with a repo subdirectory
    // e.g., /fmi-weather-history/explore -> basePath = /fmi-weather-history
    const match = path.match(/^(\/[^/]+)(?:\/|$)/);
    if (match && match[1] !== '/explore' && match[1] !== '/compare-years' && match[1] !== '/data-management') {
      this.basePath = match[1];
    }
    console.log('Detected base path:', this.basePath || '(root)');
  },

  /**
   * Initialize UI controls
   */
  initialize() {
    this.detectBasePath();
    this.attachMetricSelector();
    this.attachRenderModeSelector();
    this.attachCheckboxes();
    this.attachTabNavigation();
    this.attachRefresh30Button();
    this.initializeRouter();
    this.checkBackendAvailability();
  },

  /**
   * Check if backend API is available, hide Data Management tab if not
   */
  async checkBackendAvailability() {
    try {
      const response = await fetch('/api/status', { method: 'HEAD' });
      if (!response.ok) throw new Error('API not available');
      // Backend available, keep Data Management tab visible
    } catch (e) {
      // No backend - hide Data Management tab (static hosting mode)
      const dataManagementButton = document.querySelector('[data-tab="data-management"]');
      if (dataManagementButton) {
        dataManagementButton.style.display = 'none';
      }
      console.log('Static hosting mode: Data Management tab hidden');
    }
  },

  /**
   * Attach metric selector event handler
   */
  attachMetricSelector() {
    const metricSelect = document.getElementById("metric-selector");
    if (metricSelect) {
      metricSelect.addEventListener("change", (e) => {
        const metric = e.target.value;
        console.log("Metric changed to:", metric);
        if (this.callbacks.onMetricChange) {
          this.callbacks.onMetricChange(metric);
        }
      });
    } else {
      console.warn("Metric selector not found");
    }
  },

  /**
   * Attach render mode selector event handler
   */
  attachRenderModeSelector() {
    const renderModeSelect = document.getElementById("render-mode-selector");
    if (renderModeSelect) {
      renderModeSelect.addEventListener("change", (e) => {
        const mode = e.target.value;
        console.log("Render mode changed to:", mode);
        if (this.callbacks.onRenderModeChange) {
          this.callbacks.onRenderModeChange(mode);
        }
      });
    } else {
      console.warn("Render mode selector not found");
    }
  },

  /**
   * Attach checkbox event handlers
   */
  attachCheckboxes() {
    const anomalyTimelineCheckbox = document.getElementById(
      "toggle-anomaly-timeline"
    );
    if (anomalyTimelineCheckbox) {
      anomalyTimelineCheckbox.addEventListener("change", (e) => {
        console.log("Anomaly timeline toggled:", e.target.checked);
        const timeline = document.getElementById("anomaly-timeline");
        if (timeline) {
          if (e.target.checked) {
            timeline.classList.remove("anomaly-timeline-hidden");
            timeline.classList.add("anomaly-timeline-visible");
          } else {
            timeline.classList.remove("anomaly-timeline-visible");
            timeline.classList.add("anomaly-timeline-hidden");
          }
        }
        if (this.callbacks.onAnomalyTimelineToggle) {
          this.callbacks.onAnomalyTimelineToggle(e.target.checked);
        }
      });
    } else {
      console.warn("Anomaly timeline checkbox not found");
    }

    const winterCheckbox = document.getElementById("toggle-winter");
    if (winterCheckbox) {
      winterCheckbox.addEventListener("change", (e) => {
        console.log("Winter toggled:", e.target.checked);
        if (this.callbacks.onWinterToggle) {
          this.callbacks.onWinterToggle(e.target.checked);
        }
      });
    } else {
      console.warn("Winter checkbox not found");
    }

    const stationsCheckbox = document.getElementById("toggle-stations");
    if (stationsCheckbox) {
      stationsCheckbox.addEventListener("change", (e) => {
        console.log("Stations toggled:", e.target.checked);
        if (this.callbacks.onStationsToggle) {
          this.callbacks.onStationsToggle(e.target.checked);
        }
      });
    } else {
      console.warn("Stations checkbox not found");
    }
  },

  /**
   * Attach refresh 30 days button
   */
  attachRefresh30Button() {
    const btn = document.getElementById("btn-refresh-30");
    console.log("Attaching refresh button, element found:", !!btn);
    if (btn) {
      btn.addEventListener("click", () => {
        console.log("Refresh 30 days clicked");
        if (this.callbacks.onRefresh30Click) {
          this.callbacks.onRefresh30Click();
        } else {
          console.warn("No callback registered for refresh 30 days");
        }
      });
    } else {
      console.error("Refresh 30 days button not found in DOM");
    }
  },

  /**
   * Initialize router - handle URL changes and browser navigation
   */
  initializeRouter() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', (e) => {
      const tabName = this.getTabFromPath(window.location.pathname);
      this.switchTab(tabName, false); // Don't push state on popstate
    });

    // Check for SPA redirect from 404.html (GitHub Pages workaround)
    const params = new URLSearchParams(window.location.search);
    const redirectRoute = params.get('route');
    if (redirectRoute) {
      // Clean up URL and navigate to the route
      const basePath = window.location.pathname.replace(/\/$/, '');
      window.history.replaceState(null, '', basePath + redirectRoute);
    }

    // Navigate to initial route based on URL
    const initialTab = this.getTabFromPath(window.location.pathname);
    this.switchTab(initialTab, true); // Replace state for initial load
  },

  /**
   * Get tab name from URL path
   * @param {string} path - URL pathname
   * @returns {string} Tab name
   */
  getTabFromPath(path) {
    // Remove base path prefix and trailing slash
    let cleanPath = path;
    if (this.basePath && cleanPath.startsWith(this.basePath)) {
      cleanPath = cleanPath.slice(this.basePath.length);
    }
    cleanPath = cleanPath.replace(/\/$/, '') || '';

    // Check direct route match
    if (this.routes[cleanPath]) {
      return this.routes[cleanPath];
    }

    // Default to exploration tab for root or unknown paths
    return 'exploration';
  },

  /**
   * Attach tab navigation
   */
  attachTabNavigation() {
    const tabButtons = document.querySelectorAll(".tab-button");
    console.log("Found", tabButtons.length, "tab buttons");

    tabButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const tabName = button.getAttribute("data-tab");
        console.log("Tab clicked:", tabName);
        this.switchTab(tabName, true); // Push state on click
      });
    });
  },

  /**
   * Switch active tab
   * @param {string} tabName - Name of tab to activate
   * @param {boolean} updateUrl - Whether to update the URL (default: true)
   */
  switchTab(tabName, updateUrl = true) {
    console.log("Switching to tab:", tabName);

    // Hide all tab contents
    const allTabs = document.querySelectorAll(".tab-content");
    allTabs.forEach((tab) => {
      tab.classList.remove("active");
    });

    // Deactivate all tab buttons
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach((button) => {
      button.classList.remove("active");
    });

    // Show selected tab content
    const selectedTab = document.getElementById(tabName + "-tab");
    if (selectedTab) {
      selectedTab.classList.add("active");
      console.log("Activated tab:", tabName);
    } else {
      console.warn("Tab not found:", tabName + "-tab");
    }

    // Activate selected button
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedButton) {
      selectedButton.classList.add("active");
    }

    // Update URL
    if (updateUrl) {
      const routePath = this.tabToRoute[tabName] || '/explore';
      const newPath = this.basePath + routePath;
      const currentPath = window.location.pathname;

      if (currentPath !== newPath) {
        // Get current route without base path for comparison
        const currentRoute = this.basePath && currentPath.startsWith(this.basePath)
          ? currentPath.slice(this.basePath.length)
          : currentPath;

        // Use replaceState for initial load, pushState for navigation
        if (currentRoute === '/' || currentRoute === '' || !this.routes[currentRoute]) {
          history.replaceState({ tab: tabName }, '', newPath);
        } else {
          history.pushState({ tab: tabName }, '', newPath);
        }
      }
    }

    // Initialize tab-specific content (only if data is loaded)
    if (DataLoader.isReady()) {
      if (tabName === 'compare-years' && typeof YearCompare !== 'undefined') {
        YearCompare.render();
      } else if (tabName === 'exploration' && typeof TimelineController !== 'undefined') {
        // Re-initialize timeline when switching to explore tab
        // Timeline may not have rendered if tab was hidden during initial load
        TimelineController.initializeAnomalyTimeline();
      }
    }
    // If data not ready, render will be triggered by App after data loads
  },

  /**
   * Get current metric selection
   * @returns {string} Selected metric
   */
  getSelectedMetric() {
    const metricSelect = document.getElementById("metricSelector");
    return metricSelect ? metricSelect.value : "temperature";
  },

  /**
   * Check if winter progression is enabled
   * @returns {boolean}
   */
  isWinterEnabled() {
    const winterCheckbox = document.getElementById("toggle-winter");
    return winterCheckbox ? winterCheckbox.checked : false;
  },

  /**
   * Register callback for metric changes
   * @param {Function} callback
   */
  onMetricChange(callback) {
    this.callbacks.onMetricChange = callback;
  },

  /**
   * Register callback for anomaly timeline toggle
   * @param {Function} callback
   */
  onAnomalyTimelineToggle(callback) {
    this.callbacks.onAnomalyTimelineToggle = callback;
  },

  /**
   * Register callback for winter toggle
   * @param {Function} callback
   */
  onWinterToggle(callback) {
    this.callbacks.onWinterToggle = callback;
  },

  /**
   * Register callback for stations toggle
   * @param {Function} callback
   */
  onStationsToggle(callback) {
    this.callbacks.onStationsToggle = callback;
  },

  /**
   * Register callback for render mode change
   * @param {Function} callback
   */
  onRenderModeChange(callback) {
    this.callbacks.onRenderModeChange = callback;
  },

  /**
   * Register callback for refresh 30 days click
   * @param {Function} callback
   */
  onRefresh30Click(callback) {
    this.callbacks.onRefresh30Click = callback;
  },

  /**
   * Update metric selector options
   * @param {Array} metrics - Array of metric objects {name, label}
   */
  updateMetricOptions(metrics) {
    const metricSelect = document.getElementById("metricSelector");
    if (!metricSelect) return;

    metricSelect.innerHTML = "";
    metrics.forEach((metric) => {
      const option = document.createElement("option");
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
      "metricSelector",
      "modeToggle",
      "anomalyCheckbox",
      "winterCheckbox",
      "dateSlider",
      "playButton",
    ];

    controls.forEach((id) => {
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
    const loader = document.getElementById("loadingIndicator");
    if (loader) {
      loader.style.display = "block";
    }
    this.setEnabled(false);
  },

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loader = document.getElementById("loadingIndicator");
    if (loader) {
      loader.style.display = "none";
    }
    this.setEnabled(true);
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorContainer = document.getElementById("errorContainer");
    if (errorContainer) {
      errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
      errorContainer.style.display = "block";
    }
  },

  /**
   * Hide error message
   */
  hideError() {
    const errorContainer = document.getElementById("errorContainer");
    if (errorContainer) {
      errorContainer.style.display = "none";
    }
  },

  /**
   * Show information message
   * @param {string} message - Info message
   */
  showInfo(message) {
    const infoContainer = document.getElementById("infoContainer");
    if (infoContainer) {
      infoContainer.innerHTML = `<div class="info-message">${message}</div>`;
      infoContainer.style.display = "block";

      // Auto-hide after 5 seconds
      setTimeout(() => {
        infoContainer.style.display = "none";
      }, 5000);
    }
  },
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = UIControls;
}
