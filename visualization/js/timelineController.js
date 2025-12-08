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

    // Draw slippery risk periods (context view)
    if (DataLoader.data.slipperyRisk) {
      DataLoader.data.slipperyRisk.forEach(risk => {
        const zoneIndex = zones.indexOf(risk.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw slippery periods
        if (risk.slippery_periods) {
          risk.slippery_periods.forEach(period => {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);

            const x = xScale(periodStart);
            const barWidth = Math.max(1, xScale(periodEnd) - x);

            this.contextSvg.append('rect')
              .attr('class', 'slippery-period')
              .attr('x', x)
              .attr('y', y + zoneHeight * 0.7)
              .attr('width', barWidth)
              .attr('height', zoneHeight * 0.25)
              .attr('fill', period.high_risk_days > 0 ? 'rgba(255, 152, 0, 0.7)' : 'rgba(255, 193, 7, 0.5)');
          });
        }
      });
    }

    // Draw winter periods with cold spells (detailed view)
    if (DataLoader.data.winterStarts) {
      DataLoader.data.winterStarts.forEach(winter => {
        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // If we have detailed cold_spells data, draw individual spells
        if (winter.cold_spells && winter.cold_spells.length > 0) {
          winter.cold_spells.forEach(spell => {
            const spellStart = new Date(spell.start);
            const spellEnd = new Date(spell.end);

            const x = xScale(spellStart);
            const barWidth = Math.max(1, xScale(spellEnd) - x);

            this.contextSvg.append('rect')
              .attr('class', 'winter-period cold-spell')
              .attr('x', x)
              .attr('y', y)
              .attr('width', barWidth)
              .attr('height', zoneHeight)
              .attr('fill', 'rgba(33, 113, 181, 0.4)');
          });
        } else if (winter.season_start || winter.winter_start) {
          // Fallback to old format
          const winterStart = new Date(winter.season_start || winter.winter_start);
          const winterEnd = winter.season_end || winter.winter_end
            ? new Date(winter.season_end || winter.winter_end)
            : new Date(this.dates[this.dates.length - 1]);

          const x = xScale(winterStart);
          const barWidth = xScale(winterEnd) - x;

          this.contextSvg.append('rect')
            .attr('class', 'winter-period')
            .attr('x', x)
            .attr('y', y)
            .attr('width', barWidth)
            .attr('height', zoneHeight);
        }
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

    // Draw slippery risk periods (focus view with tooltips)
    if (DataLoader.data.slipperyRisk) {
      const self = this;

      DataLoader.data.slipperyRisk.forEach(risk => {
        const zoneIndex = zones.indexOf(risk.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw season start marker
        if (risk.season_start) {
          const seasonStart = new Date(risk.season_start);
          if (seasonStart >= startDomain && seasonStart <= endDomain) {
            this.focusSvg.append('line')
              .attr('class', 'slippery-start-line')
              .attr('x1', xScale(seasonStart))
              .attr('y1', y)
              .attr('x2', xScale(seasonStart))
              .attr('y2', y + zoneHeight)
              .attr('stroke', '#ff9800')
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '4,2');
          }
        }

        // Draw slippery periods
        if (risk.slippery_periods) {
          risk.slippery_periods.forEach(period => {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);

            // Skip if outside visible range
            if (periodEnd < startDomain || periodStart > endDomain) return;

            const x = Math.max(0, xScale(periodStart));
            const endX = Math.min(width, xScale(periodEnd));
            const barWidth = Math.max(2, endX - x);

            const isHighRisk = period.high_risk_days > 0;

            this.focusSvg.append('rect')
              .attr('class', 'slippery-period')
              .attr('x', x)
              .attr('y', y + zoneHeight * 0.65)
              .attr('width', barWidth)
              .attr('height', zoneHeight * 0.3)
              .attr('fill', isHighRisk ? 'rgba(255, 152, 0, 0.8)' : 'rgba(255, 193, 7, 0.6)')
              .attr('stroke', isHighRisk ? '#e65100' : '#f9a825')
              .attr('stroke-width', 0.5)
              .style('cursor', 'pointer')
              .on('mouseover', function(event) {
                d3.select(this).attr('fill', isHighRisk ? 'rgba(255, 152, 0, 1)' : 'rgba(255, 193, 7, 0.9)');
                self.showSlipperyTooltip(event.clientX, event.clientY, risk, period);
              })
              .on('mouseout', function() {
                d3.select(this).attr('fill', isHighRisk ? 'rgba(255, 152, 0, 0.8)' : 'rgba(255, 193, 7, 0.6)');
                self.hideAnomalyTooltip();
              });
          });
        }
      });
    }

    // Draw winter periods with detailed cold/warm spells
    if (DataLoader.data.winterStarts) {
      const self = this;

      DataLoader.data.winterStarts.forEach(winter => {
        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // If we have detailed cold_spells data, draw individual spells
        if (winter.cold_spells && winter.cold_spells.length > 0) {
          // Draw cold spells (frost periods)
          winter.cold_spells.forEach(spell => {
            const spellStart = new Date(spell.start);
            const spellEnd = new Date(spell.end);

            // Skip if outside visible range
            if (spellEnd < startDomain || spellStart > endDomain) return;

            const x = Math.max(0, xScale(spellStart));
            const endX = Math.min(width, xScale(spellEnd));
            const barWidth = Math.max(2, endX - x);

            this.focusSvg.append('rect')
              .attr('class', 'winter-period cold-spell')
              .attr('x', x)
              .attr('y', y + 1)
              .attr('width', barWidth)
              .attr('height', zoneHeight - 2)
              .attr('fill', 'rgba(33, 113, 181, 0.5)')
              .attr('stroke', 'rgba(33, 113, 181, 0.8)')
              .attr('stroke-width', 0.5)
              .style('cursor', 'pointer')
              .on('mouseover', function(event) {
                d3.select(this).attr('fill', 'rgba(33, 113, 181, 0.7)');
                self.showWinterSpellTooltip(event.clientX, event.clientY, winter, spell, 'cold');
              })
              .on('mouseout', function() {
                d3.select(this).attr('fill', 'rgba(33, 113, 181, 0.5)');
                self.hideAnomalyTooltip();
              });
          });

          // Draw warm spells (interruptions) - optional, shown as gaps or different color
          if (winter.warm_spells) {
            winter.warm_spells.forEach(spell => {
              const spellStart = new Date(spell.start);
              const spellEnd = new Date(spell.end);

              if (spellEnd < startDomain || spellStart > endDomain) return;

              const x = Math.max(0, xScale(spellStart));
              const endX = Math.min(width, xScale(spellEnd));
              const barWidth = Math.max(2, endX - x);

              this.focusSvg.append('rect')
                .attr('class', 'winter-period warm-spell')
                .attr('x', x)
                .attr('y', y + zoneHeight * 0.3)
                .attr('width', barWidth)
                .attr('height', zoneHeight * 0.4)
                .attr('fill', 'rgba(253, 174, 107, 0.6)')
                .attr('stroke', 'rgba(253, 174, 107, 0.9)')
                .attr('stroke-width', 0.5)
                .style('cursor', 'pointer')
                .on('mouseover', function(event) {
                  d3.select(this).attr('fill', 'rgba(253, 174, 107, 0.8)');
                  self.showWinterSpellTooltip(event.clientX, event.clientY, winter, spell, 'warm');
                })
                .on('mouseout', function() {
                  d3.select(this).attr('fill', 'rgba(253, 174, 107, 0.6)');
                  self.hideAnomalyTooltip();
                });
            });
          }

          // Draw season boundary lines
          const seasonStart = new Date(winter.season_start);
          const seasonEnd = new Date(winter.season_end);

          if (seasonStart >= startDomain && seasonStart <= endDomain) {
            this.focusSvg.append('line')
              .attr('class', 'winter-start-line')
              .attr('x1', xScale(seasonStart))
              .attr('y1', y)
              .attr('x2', xScale(seasonStart))
              .attr('y2', y + zoneHeight);
          }

          if (winter.season_end && seasonEnd >= startDomain && seasonEnd <= endDomain) {
            this.focusSvg.append('line')
              .attr('class', 'winter-end-line')
              .attr('x1', xScale(seasonEnd))
              .attr('y1', y)
              .attr('x2', xScale(seasonEnd))
              .attr('y2', y + zoneHeight);
          }
        } else if (winter.season_start || winter.winter_start) {
          // Fallback to old format (solid block)
          const winterStart = new Date(winter.season_start || winter.winter_start);
          const winterEnd = winter.season_end || winter.winter_end
            ? new Date(winter.season_end || winter.winter_end)
            : new Date(this.dates[this.dates.length - 1]);

          if (winterEnd < startDomain || winterStart > endDomain) return;

          const x = Math.max(0, xScale(winterStart));
          const endX = Math.min(width, xScale(winterEnd));
          const barWidth = endX - x;

          this.focusSvg.append('rect')
            .attr('class', 'winter-period')
            .attr('x', x)
            .attr('y', y)
            .attr('width', barWidth)
            .attr('height', zoneHeight);

          if (winterStart >= startDomain && winterStart <= endDomain) {
            this.focusSvg.append('line')
              .attr('class', 'winter-start-line')
              .attr('x1', xScale(winterStart))
              .attr('y1', y)
              .attr('x2', xScale(winterStart))
              .attr('y2', y + zoneHeight);
          }

          if ((winter.season_end || winter.winter_end) && winterEnd >= startDomain && winterEnd <= endDomain) {
            this.focusSvg.append('line')
              .attr('class', 'winter-end-line')
              .attr('x1', xScale(winterEnd))
              .attr('y1', y)
              .attr('x2', xScale(winterEnd))
              .attr('y2', y + zoneHeight);
          }
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
   * Show tooltip for winter spell (cold or warm)
   */
  showWinterSpellTooltip(x, y, winter, spell, type) {
    let tooltip = document.getElementById('anomaly-timeline-tooltip');

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

    let html = '';

    if (type === 'cold') {
      html = `<div style="color: #6baed6;">
        <strong>❄️ Pakkasjakso</strong><br>
        <span style="font-size: 11px;">${winter.zone} • ${winter.season}</span>
      </div>
      <div style="margin-top: 8px;">
        <strong>${spell.start}</strong> → <strong>${spell.end}</strong><br>
        Kesto: ${spell.duration} päivää<br>
        Kylmin: ${spell.min_temp}°C
      </div>`;
    } else {
      html = `<div style="color: #fdae6b;">
        <strong>☀️ Lämpökatko</strong><br>
        <span style="font-size: 11px;">${winter.zone} • ${winter.season}</span>
      </div>
      <div style="margin-top: 8px;">
        <strong>${spell.start}</strong> → <strong>${spell.end}</strong><br>
        Kesto: ${spell.duration} päivää<br>
        Lämpimin: ${spell.max_temp}°C
      </div>`;
    }

    // Add season summary
    html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
      Kausi: ${winter.frost_days}/${winter.total_days} pakkaspäivää (${winter.coverage_pct}%)<br>
      Katkonaisuus: ${(winter.fragmentation_index * 100).toFixed(0)}%
    </div>`;

    tooltip.innerHTML = html;
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
    tooltip.style.display = 'block';
  },

  /**
   * Show tooltip for slippery road risk period
   */
  showSlipperyTooltip(x, y, risk, period) {
    let tooltip = document.getElementById('anomaly-timeline-tooltip');

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

    const isHighRisk = period.high_risk_days > 0;
    const avgMin = period.avg_min_temp !== null ? period.avg_min_temp.toFixed(1) : '-';
    const avgMax = period.avg_max_temp !== null ? period.avg_max_temp.toFixed(1) : '-';

    let html = `<div style="color: ${isHighRisk ? '#ff9800' : '#ffc107'};">
      <strong>⚠️ Liukkausriski</strong><br>
      <span style="font-size: 11px;">${risk.zone} • Syksy ${risk.year}</span>
    </div>
    <div style="margin-top: 8px;">
      <strong>${period.start}</strong> → <strong>${period.end}</strong><br>
      Kesto: ${period.duration} päivää<br>
      ${isHighRisk ? `Korkea riski: ${period.high_risk_days} pv<br>` : ''}
      Yölämpötila: ${avgMin}°C<br>
      Päivälämpötila: ${avgMax}°C
    </div>`;

    // Add season summary
    html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
      Liukkauskausi alkoi: ${risk.season_start}<br>
      Riskipäiviä syksyllä: ${risk.risk_days_total} (korkea: ${risk.high_risk_days})
    </div>`;

    tooltip.innerHTML = html;
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
    tooltip.style.display = 'block';
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
   * Update the active anomalies list in both sidebars
   */
  updateActiveAnomaliesList() {
    const leftContainer = document.getElementById('active-anomalies-list');
    const rightContainer = document.getElementById('active-anomalies-list-right');

    if (!this.currentDate) return;

    const anomalies = DataLoader.getAnomaliesForDate(this.currentDate);

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

    // Build HTML for left sidebar (compact version)
    if (leftContainer) {
      if (!anomalies || anomalies.length === 0) {
        leftContainer.innerHTML = '<p style="color: #999; font-size: 12px;">No anomalies on this date</p>';
      } else {
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
        leftContainer.innerHTML = html;
      }
    }

    // Build HTML for right sidebar (card-style version with more details)
    if (rightContainer) {
      if (!anomalies || anomalies.length === 0) {
        rightContainer.innerHTML = '<p class="no-anomalies-message">No anomalies on this date</p>';
      } else {
        let html = '';
        anomalies.forEach(anomaly => {
          const cssClass = anomalyClasses[anomaly.type] || '';
          const icon = anomalyIcons[anomaly.type] || '⚠️';

          // Format dates
          const startDate = anomaly.start_date || anomaly.date;
          const endDate = anomaly.end_date || (startDate && anomaly.duration_days > 1
            ? this.addDays(startDate, anomaly.duration_days - 1)
            : startDate);

          const dateStr = anomaly.duration_days > 1
            ? `${this.formatShortDate(startDate)} - ${this.formatShortDate(endDate)}`
            : this.formatShortDate(startDate);

          // Build value string
          let valueStr = '';
          if (anomaly.min_temperature !== null && anomaly.min_temperature !== undefined) {
            valueStr = `Min: <strong>${anomaly.min_temperature.toFixed(1)}°C</strong>`;
          }
          if (anomaly.max_temperature !== null && anomaly.max_temperature !== undefined) {
            if (valueStr) valueStr += ' / ';
            valueStr += `Max: <strong>${anomaly.max_temperature.toFixed(1)}°C</strong>`;
          }

          html += `
            <div class="anomaly-card ${cssClass}">
              <div class="anomaly-header">
                <span class="anomaly-type">${icon} ${anomaly.type}</span>
                <span class="anomaly-zone">${anomaly.zone}</span>
              </div>
              <div class="anomaly-dates">${dateStr}${anomaly.duration_days > 1 ? ` (${anomaly.duration_days} pv)` : ''}</div>
              ${valueStr ? `<div class="anomaly-value">${valueStr}</div>` : ''}
            </div>
          `;
        });
        rightContainer.innerHTML = html;
      }
    }
  },

  /**
   * Format date as short Finnish format (d.m.)
   */
  formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  },

  /**
   * Add days to a date string
   */
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
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
