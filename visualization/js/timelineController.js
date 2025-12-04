/**
 * timelineController.js
 * Manages date slider, play/pause animation, and speed control
 */

const TimelineController = {
  currentDate: null,
  dates: [],
  isPlaying: false,
  animationSpeed: 500, // milliseconds between frames
  animationFrameId: null,
  anomalyCanvas: null,
  anomalyCtx: null,
  callbacks: {
    onDateChange: null,
    onPlayStatusChange: null
  },

  /**
   * Initialize timeline controller
   * @param {Array} dates - Array of date strings (YYYY-MM-DD format)
   * @param {string} initialDate - Initial date to display
   */
  initialize(dates, initialDate = null) {
    if (!Array.isArray(dates) || dates.length === 0) {
      console.warn('No dates provided for timeline');
      return;
    }

    this.dates = dates.sort();
    this.currentDate = initialDate || this.dates[0];
    this.initializeAnomalyTimeline();
    this.attachEventHandlers();
  },

  /**
   * Initialize anomaly timeline canvas
   */
  initializeAnomalyTimeline() {
    this.anomalyCanvas = document.getElementById('anomaly-canvas');
    if (!this.anomalyCanvas) {
      console.warn('Anomaly canvas not found');
      return;
    }

    this.anomalyCtx = this.anomalyCanvas.getContext('2d');

    // Make canvas responsive
    const container = this.anomalyCanvas.parentElement;
    this.anomalyCanvas.width = container.clientWidth - 40;
    this.anomalyCanvas.height = 150;

    // Add click handler for jumping to anomalies
    this.anomalyCanvas.addEventListener('click', (e) => {
      this.handleAnomalyTimelineClick(e);
    });

    // Add hover handler for showing active anomalies
    this.anomalyCanvas.addEventListener('mousemove', (e) => {
      this.handleAnomalyTimelineHover(e);
    });

    // Remove tooltip on mouse leave
    this.anomalyCanvas.addEventListener('mouseleave', () => {
      this.hideAnomalyTooltip();
    });

    // Redraw on window resize
    window.addEventListener('resize', () => {
      if (this.anomalyCanvas && container) {
        this.anomalyCanvas.width = container.clientWidth - 40;
        this.drawAnomalyTimeline();
      }
    });

    this.drawAnomalyTimeline();
  },

  /**
   * Draw anomaly timeline
   */
  drawAnomalyTimeline() {
    if (!this.anomalyCtx || !DataLoader.data.anomalies || this.dates.length === 0) {
      return;
    }

    const ctx = this.anomalyCtx;
    const width = this.anomalyCanvas.width;
    const height = this.anomalyCanvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    const minDate = this.dates[0];
    const maxDate = this.dates[this.dates.length - 1];
    const dateRange = new Date(maxDate) - new Date(minDate);

    // Anomaly colors
    const anomalyColors = {
      'Äärimmäinen kylmyys': '#2171b5',
      'Ankara pakkasjakso': '#6baed6',
      'Hellejakso': '#de2d26',
      'Takatalvi': '#756bb1',
      'Äkillinen lämpeneminen': '#fdae6b'
    };

    // Zone vertical positions
    const zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi'];
    const zoneHeight = height / zones.length;

    // Draw zone labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    zones.forEach((zone, i) => {
      ctx.fillText(zone, 5, i * zoneHeight + 15);
    });

    // Draw winter periods as background
    if (DataLoader.data.winterStarts) {
      DataLoader.data.winterStarts.forEach(winter => {
        if (!winter.winter_start) return;

        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const winterStart = new Date(winter.winter_start);
        const winterEnd = winter.winter_end ? new Date(winter.winter_end) : new Date(maxDate);

        const startTime = winterStart - new Date(minDate);
        const endTime = winterEnd - new Date(minDate);

        const x = (startTime / dateRange) * width;
        const barWidth = ((endTime - startTime) / dateRange) * width;
        const y = zoneIndex * zoneHeight + 20;

        // Draw winter period as light blue/gray background
        ctx.fillStyle = 'rgba(173, 216, 230, 0.2)'; // Light blue
        ctx.fillRect(x, y, barWidth, zoneHeight - 25);

        // Draw winter start line
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + zoneHeight - 25);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw winter end line if exists
        if (winter.winter_end) {
          const endX = (endTime / dateRange) * width;
          ctx.strokeStyle = '#e27d60';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(endX, y);
          ctx.lineTo(endX, y + zoneHeight - 25);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // Draw anomalies on top
    DataLoader.data.anomalies.forEach(anomaly => {
      const startDate = anomaly.start_date || anomaly.date;
      if (!startDate) return;

      const zoneIndex = zones.indexOf(anomaly.zone);
      if (zoneIndex === -1) return;

      const startTime = new Date(startDate) - new Date(minDate);
      const x = (startTime / dateRange) * width;
      const y = zoneIndex * zoneHeight + 20;

      const duration = anomaly.duration_days || 1;
      const durationTime = duration * 24 * 60 * 60 * 1000;
      const barWidth = Math.max(3, (durationTime / dateRange) * width);

      const color = anomalyColors[anomaly.type] || '#999';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, zoneHeight - 25);

      // Draw outline
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, zoneHeight - 25);
    });

    // Draw current date indicator
    if (this.currentDate) {
      const currentTime = new Date(this.currentDate) - new Date(minDate);
      const x = (currentTime / dateRange) * width;

      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  },

  /**
   * Handle hover on anomaly timeline - show tooltip with active anomalies
   * @param {MouseEvent} e - Mouse event
   */
  handleAnomalyTimelineHover(e) {
    if (!this.anomalyCanvas || this.dates.length === 0) return;

    const rect = this.anomalyCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Use actual canvas width, not CSS width
    const width = this.anomalyCanvas.width;
    const canvasDisplayWidth = rect.width;

    // Scale the mouse position to canvas coordinates
    const scaledX = (x / canvasDisplayWidth) * width;

    const minDate = new Date(this.dates[0]);
    const maxDate = new Date(this.dates[this.dates.length - 1]);
    const dateRange = maxDate - minDate;

    const hoveredTime = (scaledX / width) * dateRange;
    const hoveredDate = new Date(minDate.getTime() + hoveredTime);

    // Find closest date in our dates array
    let closestDate = this.dates[0];
    let minDiff = Math.abs(new Date(closestDate) - hoveredDate);

    for (const date of this.dates) {
      const diff = Math.abs(new Date(date) - hoveredDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = date;
      }
    }

    // Get anomalies for this date
    const anomalies = DataLoader.getAnomaliesForDate(closestDate);
    const winterStatus = this.getWinterStatusForDate(closestDate);

    // Show tooltip
    this.showAnomalyTooltip(e.clientX, e.clientY, closestDate, anomalies, winterStatus);
  },

  /**
   * Get winter status for all zones on a date
   * @param {string} date - Date string
   * @returns {Array} Array of winter statuses
   */
  getWinterStatusForDate(date) {
    if (!DataLoader.data.winterStarts) return [];

    const zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi'];
    const statuses = [];

    zones.forEach(zone => {
      const status = DataLoader.getWinterStatus(date, zone);
      if (status && status.inWinter) {
        statuses.push({
          zone: zone,
          daysSinceStart: status.daysSinceStart,
          season: status.season
        });
      }
    });

    return statuses;
  },

  /**
   * Show tooltip with active anomalies
   * @param {number} x - Mouse X position
   * @param {number} y - Mouse Y position
   * @param {string} date - Date string
   * @param {Array} anomalies - Array of anomalies
   * @param {Array} winterStatus - Array of winter statuses
   */
  showAnomalyTooltip(x, y, date, anomalies, winterStatus) {
    let tooltip = document.getElementById('anomaly-timeline-tooltip');

    // Create tooltip if it doesn't exist
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'anomaly-timeline-tooltip';
      tooltip.style.position = 'fixed';
      tooltip.style.background = 'rgba(0, 0, 0, 0.9)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '10px';
      tooltip.style.borderRadius = '6px';
      tooltip.style.fontSize = '12px';
      tooltip.style.zIndex = '10000';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.maxWidth = '300px';
      tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      document.body.appendChild(tooltip);
    }

    // Build tooltip content
    let html = `<strong>${date}</strong><br><br>`;

    // Add winter status
    if (winterStatus.length > 0) {
      html += '<div style="margin-bottom: 8px; color: #aed6f1;">';
      html += '❄️ <strong>Winter:</strong><br>';
      winterStatus.forEach(w => {
        html += `<span style="font-size: 11px; margin-left: 15px;">• ${w.zone}: Day ${w.daysSinceStart}</span><br>`;
      });
      html += '</div>';
    }

    // Add anomalies
    if (anomalies.length > 0) {
      const anomalyIcons = {
        'Äärimmäinen kylmyys': '❄️',
        'Ankara pakkasjakso': '🥶',
        'Hellejakso': '🔥',
        'Takatalvi': '⛄',
        'Äkillinen lämpeneminen': '⚡'
      };

      const anomalyColors = {
        'Äärimmäinen kylmyys': '#6baed6',
        'Ankara pakkasjakso': '#9ecae1',
        'Hellejakso': '#fc8d62',
        'Takatalvi': '#bc80bd',
        'Äkillinen lämpeneminen': '#fdb462'
      };

      html += '<div style="margin-top: 8px;">';
      html += '⚠️ <strong>Active Anomalies:</strong><br>';

      anomalies.forEach(a => {
        const icon = anomalyIcons[a.type] || '⚠️';
        const color = anomalyColors[a.type] || '#999';
        html += `<div style="margin-left: 15px; margin-top: 4px; color: ${color};">`;
        html += `${icon} <strong>${a.type}</strong><br>`;
        html += `<span style="font-size: 10px; margin-left: 20px; color: #ddd;">${a.zone}`;
        if (a.duration_days > 1) {
          html += ` • ${a.duration_days} days`;
        }
        if (a.min_temperature !== null && a.min_temperature !== undefined) {
          html += ` • ${a.min_temperature.toFixed(1)}°C`;
        }
        if (a.max_temperature !== null && a.max_temperature !== undefined) {
          html += ` • ${a.max_temperature.toFixed(1)}°C`;
        }
        html += '</span></div>';
      });
      html += '</div>';
    }

    // Show "No activity" if nothing is happening
    if (anomalies.length === 0 && winterStatus.length === 0) {
      html += '<span style="color: #999;">No anomalies or winter activity</span>';
    }

    tooltip.innerHTML = html;

    // Position tooltip (offset from cursor)
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
    tooltip.style.display = 'block';
  },

  /**
   * Hide anomaly tooltip
   */
  hideAnomalyTooltip() {
    const tooltip = document.getElementById('anomaly-timeline-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  },

  /**
   * Handle click on anomaly timeline
   * @param {MouseEvent} e - Click event
   */
  handleAnomalyTimelineClick(e) {
    if (!this.anomalyCanvas || this.dates.length === 0) return;

    const rect = this.anomalyCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = this.anomalyCanvas.width;

    const minDate = new Date(this.dates[0]);
    const maxDate = new Date(this.dates[this.dates.length - 1]);
    const dateRange = maxDate - minDate;

    const clickedTime = (x / width) * dateRange;
    const clickedDate = new Date(minDate.getTime() + clickedTime);

    // Find closest date in our dates array
    const clickedDateStr = clickedDate.toISOString().split('T')[0];
    let closestDate = this.dates[0];
    let minDiff = Math.abs(new Date(closestDate) - clickedDate);

    for (const date of this.dates) {
      const diff = Math.abs(new Date(date) - clickedDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = date;
      }
    }

    this.setDate(closestDate);
    this.stop();
  },

  /**
   * Attach event handlers to timeline UI elements
   */
  attachEventHandlers() {
    const slider = document.getElementById('date-slider');
    const playButton = document.getElementById('btn-play');
    const firstButton = document.getElementById('btn-first');
    const prevButton = document.getElementById('btn-prev');
    const nextButton = document.getElementById('btn-next');
    const lastButton = document.getElementById('btn-last');
    const speedControl = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-value');

    if (slider) {
      slider.min = 0;
      slider.max = this.dates.length - 1;
      slider.value = this.dates.indexOf(this.currentDate);

      slider.addEventListener('input', (e) => {
        const index = parseInt(e.target.value);
        this.setDate(this.dates[index]);
        this.stop(); // Stop animation when user drags slider
      });
      console.log('Date slider attached');
    } else {
      console.warn('Date slider not found');
    }

    if (playButton) {
      playButton.addEventListener('click', () => {
        console.log('Play button clicked');
        if (this.isPlaying) {
          this.stop();
        } else {
          this.play();
        }
      });
    } else {
      console.warn('Play button not found');
    }

    if (firstButton) {
      firstButton.addEventListener('click', () => {
        this.setDate(this.dates[0]);
        this.stop();
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        this.previousDate();
        this.stop();
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        this.nextDate();
        this.stop();
      });
    }

    if (lastButton) {
      lastButton.addEventListener('click', () => {
        this.setDate(this.dates[this.dates.length - 1]);
        this.stop();
      });
    }

    if (speedControl) {
      speedControl.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value);
        this.setSpeed(speed);
        if (speedDisplay) {
          speedDisplay.textContent = speed + 'ms';
        }
      });
    } else {
      console.warn('Speed control not found');
    }
  },

  /**
   * Set current date and update UI
   * @param {string} date - Date string (YYYY-MM-DD format)
   */
  setDate(date) {
    if (this.dates.includes(date)) {
      this.currentDate = date;
      this.updateUI();

      if (this.callbacks.onDateChange) {
        this.callbacks.onDateChange(date);
      }
    }
  },

  /**
   * Move to next date
   */
  nextDate() {
    const currentIndex = this.dates.indexOf(this.currentDate);
    if (currentIndex < this.dates.length - 1) {
      this.setDate(this.dates[currentIndex + 1]);
    }
  },

  /**
   * Move to previous date
   */
  previousDate() {
    const currentIndex = this.dates.indexOf(this.currentDate);
    if (currentIndex > 0) {
      this.setDate(this.dates[currentIndex - 1]);
    }
  },

  /**
   * Update slider and date display
   */
  updateUI() {
    const slider = document.getElementById('date-slider');
    const dateDisplayTimeline = document.getElementById('date-current');
    const dateDisplayLegend = document.getElementById('current-date-display');

    if (slider) {
      slider.value = this.dates.indexOf(this.currentDate);
    }

    // Update both date displays
    if (dateDisplayTimeline) {
      dateDisplayTimeline.textContent = this.currentDate;
    }

    if (dateDisplayLegend) {
      dateDisplayLegend.textContent = this.currentDate;
    }

    // Redraw anomaly timeline with new current date indicator
    this.drawAnomalyTimeline();

    // Update active anomalies list
    this.updateActiveAnomaliesList();
  },

  /**
   * Update the active anomalies list in the sidebar
   */
  updateActiveAnomaliesList() {
    const container = document.getElementById('active-anomalies-list');
    if (!container || !this.currentDate) return;

    const anomalies = DataLoader.getAnomaliesForDate(this.currentDate);

    if (!anomalies || anomalies.length === 0) {
      container.innerHTML = '<p style="color: #999; font-size: 12px;">No anomalies on this date</p>';
      return;
    }

    // Anomaly type CSS classes
    const anomalyClasses = {
      'Äärimmäinen kylmyys': 'extreme-cold',
      'Ankara pakkasjakso': 'cold-snap',
      'Hellejakso': 'heat-wave',
      'Takatalvi': 'return-winter',
      'Äkillinen lämpeneminen': 'temp-jump'
    };

    // Anomaly icons
    const anomalyIcons = {
      'Äärimmäinen kylmyys': '❄️',
      'Ankara pakkasjakso': '🥶',
      'Hellejakso': '🔥',
      'Takatalvi': '⛄',
      'Äkillinen lämpeneminen': '⚡'
    };

    let html = '';
    anomalies.forEach(anomaly => {
      const cssClass = anomalyClasses[anomaly.type] || '';
      const icon = anomalyIcons[anomaly.type] || '⚠️';

      let details = [];
      if (anomaly.duration_days > 1) {
        details.push(`Duration: ${anomaly.duration_days} days`);
      }
      if (anomaly.min_temperature !== null && anomaly.min_temperature !== undefined) {
        details.push(`Min: ${anomaly.min_temperature.toFixed(1)}°C`);
      }
      if (anomaly.max_temperature !== null && anomaly.max_temperature !== undefined) {
        details.push(`Max: ${anomaly.max_temperature.toFixed(1)}°C`);
      }

      html += `
        <div class="active-anomaly-item ${cssClass}">
          <span class="anomaly-type">${icon} ${anomaly.type}</span>
          <span class="anomaly-zone">${anomaly.zone}</span>
          ${details.length > 0 ? `<div class="anomaly-details">${details.join(' • ')}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  },

  /**
   * Format date for display
   * @param {string} date - Date string
   * @returns {string} Formatted date
   */
  formatDate(date) {
    const d = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  },

  /**
   * Start animation
   */
  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.updatePlayButtonUI();

    const animate = () => {
      const currentIndex = this.dates.indexOf(this.currentDate);

      if (currentIndex < this.dates.length - 1) {
        this.setDate(this.dates[currentIndex + 1]);
        this.animationFrameId = setTimeout(animate, this.animationSpeed);
      } else {
        // Loop back to start
        this.setDate(this.dates[0]);
        this.animationFrameId = setTimeout(animate, this.animationSpeed);
      }
    };

    this.animationFrameId = setTimeout(animate, this.animationSpeed);
  },

  /**
   * Stop animation
   */
  stop() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
    }

    this.updatePlayButtonUI();
  },

  /**
   * Set animation speed
   * @param {number} milliseconds - Milliseconds between frames
   */
  setSpeed(milliseconds) {
    this.animationSpeed = Math.max(100, milliseconds); // Minimum 100ms

    // Restart animation with new speed if playing
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  },

  /**
   * Update play button appearance
   */
  updatePlayButtonUI() {
    const playButton = document.getElementById('btn-play');
    if (playButton) {
      playButton.textContent = this.isPlaying ? '⏸' : '▶';
      playButton.classList.toggle('playing', this.isPlaying);
    }
  },

  /**
   * Go to next date
   */
  nextDate() {
    const currentIndex = this.dates.indexOf(this.currentDate);
    if (currentIndex < this.dates.length - 1) {
      this.setDate(this.dates[currentIndex + 1]);
    }
  },

  /**
   * Go to previous date
   */
  previousDate() {
    const currentIndex = this.dates.indexOf(this.currentDate);
    if (currentIndex > 0) {
      this.setDate(this.dates[currentIndex - 1]);
    }
  },

  /**
   * Go to first date
   */
  goToStart() {
    if (this.dates.length > 0) {
      this.setDate(this.dates[0]);
      this.stop();
    }
  },

  /**
   * Go to last date
   */
  goToEnd() {
    if (this.dates.length > 0) {
      this.setDate(this.dates[this.dates.length - 1]);
      this.stop();
    }
  },

  /**
   * Register callback for date changes
   * @param {Function} callback - Function to call when date changes
   */
  onDateChange(callback) {
    this.callbacks.onDateChange = callback;
  },

  /**
   * Register callback for play status changes
   * @param {Function} callback - Function to call when play status changes
   */
  onPlayStatusChange(callback) {
    this.callbacks.onPlayStatusChange = callback;
  },

  /**
   * Get current date
   * @returns {string} Current date string
   */
  getCurrentDate() {
    return this.currentDate;
  },

  /**
   * Get all available dates
   * @returns {Array} Array of date strings
   */
  getDates() {
    return [...this.dates];
  },

  /**
   * Get current date index
   * @returns {number} Index of current date
   */
  getCurrentIndex() {
    return this.dates.indexOf(this.currentDate);
  },

  /**
   * Get play status
   * @returns {boolean} True if animation is playing
   */
  getPlayStatus() {
    return this.isPlaying;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimelineController;
}
