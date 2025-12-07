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

  // Brush & Zoom state
  focusSvg: null,
  contextSvg: null,
  xScaleFocus: null,
  xScaleContext: null,
  brush: null,
  brushSelection: null,  // Current brush extent [startDate, endDate]

  // Dimensions
  margin: { top: 5, right: 20, bottom: 25, left: 80 },
  focusHeight: 130,
  contextHeight: 70,

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
   * Initialize anomaly timeline with D3 brush & zoom
   */
  initializeAnomalyTimeline() {
    const focusContainer = document.getElementById('anomaly-focus');
    const contextContainer = document.getElementById('anomaly-context');

    if (!focusContainer || !contextContainer) {
      console.warn('Anomaly timeline containers not found');
      return;
    }

    // Clear any existing content
    focusContainer.innerHTML = '';
    contextContainer.innerHTML = '';

    // Get dimensions
    const containerWidth = focusContainer.clientWidth;
    const width = containerWidth - this.margin.left - this.margin.right;
    const focusHeight = this.focusHeight - this.margin.top - this.margin.bottom;
    const contextHeight = this.contextHeight - this.margin.top - this.margin.bottom;

    // Create SVGs
    this.focusSvg = d3.select('#anomaly-focus')
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', this.focusHeight)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.contextSvg = d3.select('#anomaly-context')
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', this.contextHeight)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Parse dates
    const minDate = new Date(this.dates[0]);
    const maxDate = new Date(this.dates[this.dates.length - 1]);

    // Create scales
    this.xScaleContext = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);

    // Default brush selection: last 90 days or full range if less
    const defaultDays = 90;
    const rangeMs = maxDate - minDate;
    const defaultRangeMs = defaultDays * 24 * 60 * 60 * 1000;
    const brushStart = rangeMs > defaultRangeMs
      ? new Date(maxDate.getTime() - defaultRangeMs)
      : minDate;

    this.xScaleFocus = d3.scaleTime()
      .domain([brushStart, maxDate])
      .range([0, width]);

    this.brushSelection = [brushStart, maxDate];

    // Create brush
    this.brush = d3.brushX()
      .extent([[0, 0], [width, contextHeight]])
      .on('brush end', (event) => this.handleBrush(event));

    // Draw initial charts
    this.drawContextChart(width, contextHeight);
    this.drawFocusChart(width, focusHeight);

    // Add brush to context
    const brushG = this.contextSvg.append('g')
      .attr('class', 'brush')
      .call(this.brush);

    // Set initial brush position
    const x0 = this.xScaleContext(brushStart);
    const x1 = this.xScaleContext(maxDate);
    brushG.call(this.brush.move, [x0, x1]);

    // Add click handler for focus chart
    this.focusSvg.on('click', (event) => {
      const [x] = d3.pointer(event);
      const clickedDate = this.xScaleFocus.invert(x);
      this.jumpToClosestDate(clickedDate);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.resizeTimeline();
    });
  },

  /**
   * Handle brush event
   */
  handleBrush(event) {
    if (!event.selection) return;

    const [x0, x1] = event.selection;
    const startDate = this.xScaleContext.invert(x0);
    const endDate = this.xScaleContext.invert(x1);

    this.brushSelection = [startDate, endDate];
    this.xScaleFocus.domain([startDate, endDate]);

    // Redraw focus chart
    const focusContainer = document.getElementById('anomaly-focus');
    const width = focusContainer.clientWidth - this.margin.left - this.margin.right;
    const focusHeight = this.focusHeight - this.margin.top - this.margin.bottom;

    this.focusSvg.selectAll('*').remove();
    this.drawFocusChart(width, focusHeight);

    // Re-add click handler
    this.focusSvg.on('click', (event) => {
      const [x] = d3.pointer(event);
      const clickedDate = this.xScaleFocus.invert(x);
      this.jumpToClosestDate(clickedDate);
    });
  },

  /**
   * Jump to closest date in dates array
   */
  jumpToClosestDate(targetDate) {
    let closestDate = this.dates[0];
    let minDiff = Math.abs(new Date(closestDate) - targetDate);

    for (const date of this.dates) {
      const diff = Math.abs(new Date(date) - targetDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = date;
      }
    }

    this.setDate(closestDate);
    this.stop();
  },

  /**
   * Resize timeline on window resize
   */
  resizeTimeline() {
    const focusContainer = document.getElementById('anomaly-focus');
    const contextContainer = document.getElementById('anomaly-context');

    if (!focusContainer || !contextContainer) return;

    // Clear and reinitialize
    focusContainer.innerHTML = '';
    contextContainer.innerHTML = '';

    this.initializeAnomalyTimeline();
  },

  /**
   * Draw context (overview) chart - shows full timeline
   */
  drawContextChart(width, height) {
    if (!DataLoader.data.anomalies || this.dates.length === 0) return;

    const zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi'];
    const zoneHeight = height / zones.length;
    const xScale = this.xScaleContext;

    const anomalyColors = {
      'Äärimmäinen kylmyys': '#2171b5',
      'Ankara pakkasjakso': '#6baed6',
      'Hellejakso': '#de2d26',
      'Takatalvi': '#756bb1',
      'Äkillinen lämpeneminen': '#fdae6b'
    };

    // Draw zone backgrounds (alternating)
    zones.forEach((zone, i) => {
      this.contextSvg.append('rect')
        .attr('x', 0)
        .attr('y', i * zoneHeight)
        .attr('width', width)
        .attr('height', zoneHeight)
        .attr('fill', i % 2 === 0 ? '#fafafa' : '#f5f5f5');
    });

    // Draw winter periods
    if (DataLoader.data.winterStarts) {
      DataLoader.data.winterStarts.forEach(winter => {
        if (!winter.winter_start) return;

        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const winterStart = new Date(winter.winter_start);
        const winterEnd = winter.winter_end ? new Date(winter.winter_end) : new Date(this.dates[this.dates.length - 1]);

        const x = xScale(winterStart);
        const barWidth = xScale(winterEnd) - x;
        const y = zoneIndex * zoneHeight;

        this.contextSvg.append('rect')
          .attr('class', 'winter-period')
          .attr('x', x)
          .attr('y', y)
          .attr('width', barWidth)
          .attr('height', zoneHeight);
      });
    }

    // Draw anomaly bars (simplified for context view)
    DataLoader.data.anomalies.forEach(anomaly => {
      const startDate = anomaly.start_date || anomaly.date;
      if (!startDate) return;

      const zoneIndex = zones.indexOf(anomaly.zone);
      if (zoneIndex === -1) return;

      const start = new Date(startDate);
      const duration = anomaly.duration_days || 1;
      const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

      const x = xScale(start);
      const barWidth = Math.max(2, xScale(end) - x);
      const y = zoneIndex * zoneHeight + 2;

      this.contextSvg.append('rect')
        .attr('class', 'anomaly-bar')
        .attr('x', x)
        .attr('y', y)
        .attr('width', barWidth)
        .attr('height', zoneHeight - 4)
        .attr('fill', anomalyColors[anomaly.type] || '#999');
    });

    // Draw x-axis (simplified)
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d3.timeFormat('%Y'));

    this.contextSvg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);
  },

  /**
   * Draw focus (detail) chart - shows selected range
   */
  drawFocusChart(width, height) {
    if (!DataLoader.data.anomalies || this.dates.length === 0) return;

    const zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi'];
    const zoneHeight = height / zones.length;
    const xScale = this.xScaleFocus;
    const [startDomain, endDomain] = this.xScaleFocus.domain();

    const anomalyColors = {
      'Äärimmäinen kylmyys': '#2171b5',
      'Ankara pakkasjakso': '#6baed6',
      'Hellejakso': '#de2d26',
      'Takatalvi': '#756bb1',
      'Äkillinen lämpeneminen': '#fdae6b'
    };

    // Draw zone backgrounds and labels
    zones.forEach((zone, i) => {
      this.focusSvg.append('rect')
        .attr('x', 0)
        .attr('y', i * zoneHeight)
        .attr('width', width)
        .attr('height', zoneHeight)
        .attr('fill', i % 2 === 0 ? '#fafafa' : '#f5f5f5');

      this.focusSvg.append('text')
        .attr('class', 'zone-label')
        .attr('x', -5)
        .attr('y', i * zoneHeight + zoneHeight / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .text(zone);
    });

    // Draw winter periods
    if (DataLoader.data.winterStarts) {
      DataLoader.data.winterStarts.forEach(winter => {
        if (!winter.winter_start) return;

        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const winterStart = new Date(winter.winter_start);
        const winterEnd = winter.winter_end ? new Date(winter.winter_end) : new Date(this.dates[this.dates.length - 1]);

        // Skip if outside visible range
        if (winterEnd < startDomain || winterStart > endDomain) return;

        const x = Math.max(0, xScale(winterStart));
        const endX = Math.min(width, xScale(winterEnd));
        const barWidth = endX - x;
        const y = zoneIndex * zoneHeight;

        this.focusSvg.append('rect')
          .attr('class', 'winter-period')
          .attr('x', x)
          .attr('y', y)
          .attr('width', barWidth)
          .attr('height', zoneHeight);

        // Winter start line (if in view)
        if (winterStart >= startDomain && winterStart <= endDomain) {
          this.focusSvg.append('line')
            .attr('class', 'winter-start-line')
            .attr('x1', xScale(winterStart))
            .attr('y1', y)
            .attr('x2', xScale(winterStart))
            .attr('y2', y + zoneHeight);
        }

        // Winter end line (if in view)
        if (winter.winter_end && winterEnd >= startDomain && winterEnd <= endDomain) {
          this.focusSvg.append('line')
            .attr('class', 'winter-end-line')
            .attr('x1', xScale(winterEnd))
            .attr('y1', y)
            .attr('x2', xScale(winterEnd))
            .attr('y2', y + zoneHeight);
        }
      });
    }

    // Draw anomaly bars with tooltips
    const self = this;
    DataLoader.data.anomalies.forEach(anomaly => {
      const startDate = anomaly.start_date || anomaly.date;
      if (!startDate) return;

      const zoneIndex = zones.indexOf(anomaly.zone);
      if (zoneIndex === -1) return;

      const start = new Date(startDate);
      const duration = anomaly.duration_days || 1;
      const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

      // Skip if outside visible range
      if (end < startDomain || start > endDomain) return;

      const x = Math.max(0, xScale(start));
      const endX = Math.min(width, xScale(end));
      const barWidth = Math.max(3, endX - x);
      const y = zoneIndex * zoneHeight + 3;

      this.focusSvg.append('rect')
        .attr('class', 'anomaly-bar')
        .attr('x', x)
        .attr('y', y)
        .attr('width', barWidth)
        .attr('height', zoneHeight - 6)
        .attr('fill', anomalyColors[anomaly.type] || '#999')
        .attr('stroke', anomalyColors[anomaly.type] || '#999')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this).attr('stroke-width', 2);
          self.showAnomalyTooltip(event.clientX, event.clientY, startDate,
            [anomaly], self.getWinterStatusForDate(startDate));
        })
        .on('mouseout', function() {
          d3.select(this).attr('stroke-width', 1);
          self.hideAnomalyTooltip();
        })
        .on('click', function(event) {
          event.stopPropagation();
          self.setDate(startDate);
          self.stop();
        });
    });

    // Draw current date indicator
    if (this.currentDate) {
      const currentDateObj = new Date(this.currentDate);
      if (currentDateObj >= startDomain && currentDateObj <= endDomain) {
        this.focusSvg.append('line')
          .attr('class', 'current-date-line')
          .attr('x1', xScale(currentDateObj))
          .attr('y1', 0)
          .attr('x2', xScale(currentDateObj))
          .attr('y2', height);
      }
    }

    // Draw x-axis
    const daysDiff = (endDomain - startDomain) / (1000 * 60 * 60 * 24);
    let tickFormat, ticks;

    if (daysDiff <= 14) {
      tickFormat = d3.timeFormat('%d.%m');
      ticks = d3.timeDay.every(1);
    } else if (daysDiff <= 60) {
      tickFormat = d3.timeFormat('%d.%m');
      ticks = d3.timeWeek.every(1);
    } else if (daysDiff <= 365) {
      tickFormat = d3.timeFormat('%b %Y');
      ticks = d3.timeMonth.every(1);
    } else {
      tickFormat = d3.timeFormat('%b %Y');
      ticks = d3.timeMonth.every(3);
    }

    const xAxis = d3.axisBottom(xScale)
      .ticks(ticks)
      .tickFormat(tickFormat);

    this.focusSvg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);
  },

  /**
   * Redraw timeline (called when current date changes)
   */
  drawAnomalyTimeline() {
    if (!this.focusSvg || !this.xScaleFocus) return;

    const focusContainer = document.getElementById('anomaly-focus');
    if (!focusContainer) return;

    const width = focusContainer.clientWidth - this.margin.left - this.margin.right;
    const focusHeight = this.focusHeight - this.margin.top - this.margin.bottom;

    this.focusSvg.selectAll('*').remove();
    this.drawFocusChart(width, focusHeight);

    // Re-add click handler
    this.focusSvg.on('click', (event) => {
      const [x] = d3.pointer(event);
      const clickedDate = this.xScaleFocus.invert(x);
      this.jumpToClosestDate(clickedDate);
    });
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
