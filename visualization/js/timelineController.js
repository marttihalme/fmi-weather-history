/**
 * timelineController.js
 * Manages date slider, play/pause animation, and speed control
 */

// Finnish month abbreviations for d3 formatting
const finnishMonthsShort = ["Tammi", "Helmi", "Maalis", "Huhti", "Touko", "Kesä", "Heinä", "Elo", "Syys", "Loka", "Marras", "Joulu"];

// Custom Finnish date formatter for month + year
const finnishMonthYear = (date) => `${finnishMonthsShort[date.getMonth()]} ${date.getFullYear()}`;

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
  brushSelection: null, // Current brush extent [startDate, endDate]

  // Drag state for timeline scrubbing
  isDragging: false,

  // Dimensions
  margin: { top: 5, right: 20, bottom: 25, left: 80 },
  focusHeight: 143,
  contextHeight: 77,
  resizeTimeout: null,

  // Visibility toggles for different element types
  visibility: {
    coldSpell: true,
    warmSpell: true,
    winterStart: true,
    winterEnd: true,
    slipperyStart: true,
    slipperyBar: true,
    frostMarker: true,
    frostBar: true,
    snowMarker: true,
    extremeCold: true,
    coldSnap: true,
    heatWave: true,
    returnWinter: true,
    tempJump: true,
  },

  // Phenomenon type configurations for Active Anomalies list
  phenomenonConfig: {
    cold_spell: {
      icon: "❄️",
      cssClass: "cold-spell",
      label: "Pakkasjakso",
      color: "rgba(33, 113, 181, 0.6)",
      description: "Pakkasjakso tunnistetaan, kun vähintään kolmena peräkkäisenä päivänä vuorokauden keskilämpötila pysyy alle -10°C. Tämä kuvaa merkittävää kylmää jaksoa, joka vaikuttaa arkeen ja luontoon.",
    },
    warm_spell: {
      icon: "🌡️",
      cssClass: "warm-spell",
      label: "Lämpökatko",
      color: "rgba(253, 174, 107, 0.6)",
      description: "Lämpökatko havaitaan talvikaudella, kun vähintään kahtena peräkkäisenä päivänä vuorokauden keskilämpötila nousee yli 0°C. Tämä voi aiheuttaa lumen sulamista ja liukkautta.",
    },
    winter_start: {
      icon: "🌨️",
      cssClass: "winter-start",
      label: "Talvikausi alkaa",
      color: "#4a90e2",
      description: "Talvikauden alku määritetään, kun 5 päivän liukuva keskilämpötila laskee pysyvästi alle 0°C syksyllä. Tämä merkitsee pysyvän talvisään alkamista alueella.",
    },
    winter_end: {
      icon: "🌸",
      cssClass: "winter-end",
      label: "Talvikausi päättyy",
      color: "#e27d60",
      description: "Talvikauden loppu tunnistetaan, kun 5 päivän liukuva keskilämpötila nousee pysyvästi yli 0°C keväällä. Tämä merkitsee kevään tuloa ja lumien sulamisen alkamista.",
    },
    slippery_start: {
      icon: "⚠️",
      cssClass: "slippery-start",
      label: "Liukkauskausi alkaa",
      color: "#ff9800",
      description: "Liukkauskauden alku määritetään ensimmäisestä päivästä syksyllä, jolloin yölämpötila laskee alle 0°C ja päivälämpötila on 0-5°C. Nämä olosuhteet aiheuttavat jäätymis-sulamis-kierteen.",
    },
    slippery_period: {
      icon: "🧊",
      cssClass: "slippery-period",
      label: "Liukkausriski",
      color: "rgba(255, 152, 0, 0.8)",
      description: "Liukkausriski lasketaan päivistä, jolloin yölämpötila on alle 0°C ja päivälämpötila on 0-5°C. Tällöin tiet ja kävelytiet voivat olla erityisen liukkaita jäätymis-sulamis-ilmiön vuoksi.",
    },
    first_frost: {
      icon: "🌙",
      cssClass: "first-frost",
      label: "Ensimmäinen yöpakkanen",
      color: "#00bcd4",
      description: "Ensimmäinen yöpakkanen on syksyn ensimmäinen päivä, jolloin vuorokauden minimilämpötila laskee alle 0°C. Tämä on merkki kasvukauden päättymisestä ja syksyn edistymisestä.",
    },
    frost_period: {
      icon: "🥶",
      cssClass: "frost-period",
      label: "Hallajakso",
      color: "rgba(0, 188, 212, 0.5)",
      description: "Hallajakso kattaa päivät, jolloin yölämpötila laskee alle 0°C. Jakso lasketaan ensimmäisestä yöpakkasesta eteenpäin ja kuvaa hallariski-aikaa syksyllä.",
    },
    first_snow: {
      icon: "❄️",
      cssClass: "first-snow",
      label: "Ensilumi",
      color: "#90caf9",
      description: "Ensilumi on syksyn ensimmäinen päivä, jolloin maassa on mitattavissa oleva lumipeite (≥1 cm). Tämä merkitsee talven lähestymistä ja lumikauden alkua alueella.",
    },
    "Äärimmäinen kylmyys": {
      icon: "❄️",
      cssClass: "extreme-cold",
      label: "Äärimmäinen kylmyys",
      color: "#2171b5",
      description: "Äärimmäinen kylmyys tunnistetaan, kun vuorokauden minimilämpötila laskee -25°C tai alle. Nämä ovat harvinaisia ja vaarallisia pakkaspäiviä, jotka vaativat erityistä varautumista.",
    },
    "Ankara pakkasjakso": {
      icon: "🥶",
      cssClass: "cold-snap",
      label: "Ankara pakkasjakso",
      color: "#6baed6",
      description: "Ankara pakkasjakso havaitaan, kun vähintään kolmena peräkkäisenä päivänä vuorokauden maksimilämpötila pysyy alle -15°C. Tämä tarkoittaa, että päiväsälläkään ei lämpene merkittävästi.",
    },
    Hellejakso: {
      icon: "☀️",
      cssClass: "heat-wave",
      label: "Hellejakso",
      color: "#de2d26",
      description: "Hellejakso tunnistetaan, kun vähintään kolmena peräkkäisenä päivänä vuorokauden maksimilämpötila nousee yli +25°C. Hellejaksot ovat merkittäviä kesäsääilmiöitä Suomessa.",
    },
    Takatalvi: {
      icon: "⛄",
      cssClass: "return-winter",
      label: "Takatalvi",
      color: "#756bb1",
      description: "Takatalvi tunnistetaan, kun kevään edistyttyä ja lämpötilojen noustua pysyvästi plussan puolelle, tulee uusi pakkasjakso. Takatalvi on tyypillinen ilmiö Suomen keväässä.",
    },
    "Äkillinen lämpeneminen": {
      icon: "⚡",
      cssClass: "temp-jump",
      label: "Lämpöhyppy",
      color: "#fdae6b",
      description: "Lämpöhyppy tunnistetaan, kun vuorokauden keskilämpötila muuttuu yli 15°C edelliseen päivään verrattuna. Näin suuret äkilliset muutokset ovat harvinaisia ja voivat johtua säärintamista.",
    },
  },

  // Currently expanded phenomenon for detail panel
  expandedPhenomenon: null,

  callbacks: {
    onDateChange: null,
    onPlayStatusChange: null,
  },

  /**
   * Initialize timeline controller
   * @param {Array} dates - Array of date strings (YYYY-MM-DD format)
   * @param {string} initialDate - Initial date to display
   */
  initialize(dates, initialDate = null) {
    if (!Array.isArray(dates) || dates.length === 0) {
      console.warn("No dates provided for timeline");
      return;
    }

    this.dates = dates.sort();
    this.currentDate = initialDate || this.dates[0];

    // Update date range labels from data
    this.updateDateRangeLabels();

    this.initializeAnomalyTimeline();
    this.attachEventHandlers();
    this.attachLegendToggles();
    this.attachDetailPanelCloseHandler();
  },

  /**
   * Attach close button handler for detail panel
   */
  attachDetailPanelCloseHandler() {
    const closeBtn = document.getElementById("close-detail-panel");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closePhenomenonDetail();
      });
    }
  },

  /**
   * Update the date range labels (min/max) from actual data
   */
  updateDateRangeLabels() {
    if (this.dates.length === 0) return;

    const minDate = this.dates[0];
    const maxDate = this.dates[this.dates.length - 1];

    const dateMinEl = document.getElementById("date-min");
    const dateMaxEl = document.getElementById("date-max");
    const dateCurrentEl = document.getElementById("date-current");
    const currentDateDisplay = document.getElementById("current-date-display");

    if (dateMinEl) dateMinEl.textContent = this.formatDisplayDate(minDate);
    if (dateMaxEl) dateMaxEl.textContent = this.formatDisplayDate(maxDate);
    if (dateCurrentEl) dateCurrentEl.textContent = this.formatDisplayDate(this.currentDate);
    if (currentDateDisplay) currentDateDisplay.textContent = this.formatDisplayDate(this.currentDate);
  },

  /**
   * Initialize anomaly timeline with D3 brush & zoom
   */
  initializeAnomalyTimeline() {
    const focusContainer = document.getElementById("anomaly-focus");
    const contextContainer = document.getElementById("anomaly-context");

    if (!focusContainer || !contextContainer) {
      console.warn("Anomaly timeline containers not found");
      return;
    }

    // Clear any existing content
    focusContainer.innerHTML = "";
    contextContainer.innerHTML = "";

    // Get dimensions
    const containerWidth = focusContainer.clientWidth;

    // Guard against zero/invalid width (element hidden or not yet rendered)
    if (!containerWidth || containerWidth <= 0) {
      console.warn("Timeline container has no width, skipping render");
      return;
    }

    const width = containerWidth - this.margin.left - this.margin.right;

    // Ensure valid width after margins
    if (width <= 0) {
      console.warn("Timeline width too small after margins, skipping render");
      return;
    }

    const focusHeight = this.focusHeight - this.margin.top - this.margin.bottom;
    const contextHeight =
      this.contextHeight - this.margin.top - this.margin.bottom;

    // Create SVGs
    this.focusSvg = d3
      .select("#anomaly-focus")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.focusHeight)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    this.contextSvg = d3
      .select("#anomaly-context")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.contextHeight)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    // Parse dates
    const minDate = new Date(this.dates[0]);
    const maxDate = new Date(this.dates[this.dates.length - 1]);

    // Create scales
    this.xScaleContext = d3
      .scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);

    // Default brush selection: last 13 months or full range if less
    const defaultMonths = 13;
    const brushStart = new Date(maxDate);
    brushStart.setMonth(brushStart.getMonth() - defaultMonths);
    // If calculated start is before data range, use minDate
    const effectiveBrushStart = brushStart < minDate ? minDate : brushStart;

    this.xScaleFocus = d3
      .scaleTime()
      .domain([effectiveBrushStart, maxDate])
      .range([0, width]);

    this.brushSelection = [effectiveBrushStart, maxDate];

    // Create brush
    this.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, contextHeight],
      ])
      .on("brush end", (event) => this.handleBrush(event));

    // Draw initial charts
    this.drawContextChart(width, contextHeight);
    this.drawFocusChart(width, focusHeight);

    // Add brush to context
    const brushG = this.contextSvg
      .append("g")
      .attr("class", "brush")
      .call(this.brush);

    // Set initial brush position
    const x0 = this.xScaleContext(effectiveBrushStart);
    const x1 = this.xScaleContext(maxDate);
    brushG.call(this.brush.move, [x0, x1]);

    // Add interaction handlers for focus chart (click + drag to scrub)
    const self = this;

    this.focusSvg.on("mousedown", function(event) {
      self.isDragging = true;
      self.stop(); // Stop animation when starting to drag

      const [x] = d3.pointer(event);
      const clickedDate = self.xScaleFocus.invert(x);
      self.jumpToClosestDate(clickedDate);
    });

    this.focusSvg.on("mousemove", function(event) {
      if (self.isDragging) {
        const [x] = d3.pointer(event);
        const clickedDate = self.xScaleFocus.invert(x);
        self.jumpToClosestDate(clickedDate);
      }
    });

    this.focusSvg.on("mouseup", function(event) {
      self.isDragging = false;
    });

    this.focusSvg.on("mouseleave", function(event) {
      self.isDragging = false;
    });

    // Also add click handler for single clicks (when not dragging)
    this.focusSvg.on("click", (event) => {
      const [x] = d3.pointer(event);
      const clickedDate = this.xScaleFocus.invert(x);
      this.jumpToClosestDate(clickedDate);
    });

    // Handle window resize with debounce
    window.addEventListener("resize", () => {
      // Debounce resize to avoid excessive redraws
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {
        this.resizeTimeline();
      }, 150);
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
    const focusContainer = document.getElementById("anomaly-focus");
    const width =
      focusContainer.clientWidth - this.margin.left - this.margin.right;
    const focusHeight = this.focusHeight - this.margin.top - this.margin.bottom;

    this.focusSvg.selectAll("*").remove();
    this.drawFocusChart(width, focusHeight);

    // Re-add interaction handlers (click + drag to scrub)
    const self = this;

    this.focusSvg.on("mousedown", function(event) {
      self.isDragging = true;
      self.stop();

      const [x] = d3.pointer(event);
      const clickedDate = self.xScaleFocus.invert(x);
      self.jumpToClosestDate(clickedDate);
    });

    this.focusSvg.on("mousemove", function(event) {
      if (self.isDragging) {
        const [x] = d3.pointer(event);
        const clickedDate = self.xScaleFocus.invert(x);
        self.jumpToClosestDate(clickedDate);
      }
    });

    this.focusSvg.on("mouseup", function(event) {
      self.isDragging = false;
    });

    this.focusSvg.on("mouseleave", function(event) {
      self.isDragging = false;
    });

    this.focusSvg.on("click", (event) => {
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
    const focusContainer = document.getElementById("anomaly-focus");
    const contextContainer = document.getElementById("anomaly-context");

    if (!focusContainer || !contextContainer) return;

    // Clear and reinitialize
    focusContainer.innerHTML = "";
    contextContainer.innerHTML = "";

    this.initializeAnomalyTimeline();
  },

  /**
   * Draw context (overview) chart - shows full timeline
   */
  drawContextChart(width, height) {
    if (!DataLoader.data.anomalies || this.dates.length === 0) return;

    // Guard against invalid dimensions
    if (!width || width <= 0 || !height || height <= 0 || !isFinite(width) || !isFinite(height)) {
      console.warn("Invalid dimensions for context chart:", { width, height });
      return;
    }

    // Guard against invalid scale
    if (!this.xScaleContext) {
      console.warn("Context chart: xScaleContext not initialized");
      return;
    }

    const zones = ["Etelä-Suomi", "Keski-Suomi", "Pohjois-Suomi", "Lappi"];
    const zoneHeight = height / zones.length;
    const xScale = this.xScaleContext;

    const anomalyColors = {
      "Äärimmäinen kylmyys": "#2171b5",
      "Ankara pakkasjakso": "#6baed6",
      Hellejakso: "#de2d26",
      Takatalvi: "#756bb1",
      "Äkillinen lämpeneminen": "#fdae6b",
    };

    // Draw zone backgrounds (alternating)
    zones.forEach((zone, i) => {
      this.contextSvg
        .append("rect")
        .attr("x", 0)
        .attr("y", i * zoneHeight)
        .attr("width", width)
        .attr("height", zoneHeight)
        .attr("fill", i % 2 === 0 ? "#fafafa" : "#f5f5f5");
    });

    // Draw slippery risk periods (context view)
    if (DataLoader.data.slipperyRisk && this.visibility.slipperyBar) {
      DataLoader.data.slipperyRisk.forEach((risk) => {
        const zoneIndex = zones.indexOf(risk.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw slippery periods
        if (this.visibility.slipperyBar && risk.slippery_periods) {
          risk.slippery_periods.forEach((period) => {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);

            // Skip invalid dates
            if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) return;

            const x = xScale(periodStart);
            const endX = xScale(periodEnd);

            // Skip if scale returns invalid values
            if (!isFinite(x) || !isFinite(endX)) return;

            const barWidth = Math.max(1, endX - x);

            this.contextSvg
              .append("rect")
              .attr("class", "slippery-period")
              .attr("x", x)
              .attr("y", y + zoneHeight * 0.7)
              .attr("width", barWidth)
              .attr("height", zoneHeight * 0.25)
              .attr(
                "fill",
                period.high_risk_days > 0
                  ? "rgba(255, 152, 0, 0.7)"
                  : "rgba(255, 193, 7, 0.5)"
              );
          });
        }
      });
    }

    // Draw first frost markers (context view)
    if (DataLoader.data.firstFrost && (this.visibility.frostMarker || this.visibility.frostBar)) {
      DataLoader.data.firstFrost.forEach((frost) => {
        const zoneIndex = zones.indexOf(frost.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw first frost marker
        if (this.visibility.frostMarker && frost.first_frost_date) {
          const frostDate = new Date(frost.first_frost_date);
          if (!isNaN(frostDate.getTime())) {
            const x = xScale(frostDate);
            if (isFinite(x)) {
              this.contextSvg
                .append("line")
                .attr("class", "first-frost-line")
                .attr("x1", x)
                .attr("y1", y)
                .attr("x2", x)
                .attr("y2", y + zoneHeight)
                .attr("stroke", "#00bcd4")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "2,2");
            }
          }
        }

        // Draw frost periods
        if (this.visibility.frostBar && frost.frost_periods) {
          frost.frost_periods.forEach((period) => {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);

            // Skip invalid dates
            if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) return;

            const x = xScale(periodStart);
            const endX = xScale(periodEnd);

            // Skip if scale returns invalid values
            if (!isFinite(x) || !isFinite(endX)) return;

            const barWidth = Math.max(1, endX - x);

            this.contextSvg
              .append("rect")
              .attr("class", "frost-period")
              .attr("x", x)
              .attr("y", y + zoneHeight * 0.45)
              .attr("width", barWidth)
              .attr("height", zoneHeight * 0.2)
              .attr("fill", "rgba(0, 188, 212, 0.4)");
          });
        }
      });
    }

    // Draw first snow markers (context view) - ensilumi
    if (DataLoader.data.firstSnow && this.visibility.snowMarker) {
      DataLoader.data.firstSnow.forEach((snow) => {
        const zoneIndex = zones.indexOf(snow.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw first snow marker
        if (snow.first_snow_date) {
          const snowDate = new Date(snow.first_snow_date);
          if (!isNaN(snowDate.getTime())) {
            const x = xScale(snowDate);
            if (isFinite(x)) {
              this.contextSvg
                .append("line")
                .attr("class", "first-snow-line")
                .attr("x1", x)
                .attr("y1", y)
                .attr("x2", x)
                .attr("y2", y + zoneHeight)
                .attr("stroke", "#90caf9")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "2,2");
            }
          }
        }
      });
    }

    // Draw winter periods with cold spells (detailed view)
    if (DataLoader.data.winterStarts && this.visibility.coldSpell) {
      DataLoader.data.winterStarts.forEach((winter) => {
        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // If we have detailed cold_spells data, draw individual spells
        if (winter.cold_spells && winter.cold_spells.length > 0) {
          winter.cold_spells.forEach((spell) => {
            const spellStart = new Date(spell.start);
            const spellEnd = new Date(spell.end);

            // Skip invalid dates
            if (isNaN(spellStart.getTime()) || isNaN(spellEnd.getTime())) return;

            const x = xScale(spellStart);
            const endX = xScale(spellEnd);

            // Skip if scale returns invalid values
            if (!isFinite(x) || !isFinite(endX)) return;

            const barWidth = Math.max(1, endX - x);

            this.contextSvg
              .append("rect")
              .attr("class", "winter-period cold-spell")
              .attr("x", x)
              .attr("y", y)
              .attr("width", barWidth)
              .attr("height", zoneHeight)
              .attr("fill", "rgba(33, 113, 181, 0.4)");
          });
        } else if (winter.season_start || winter.winter_start) {
          // Fallback to old format
          const winterStart = new Date(
            winter.season_start || winter.winter_start
          );
          const winterEnd =
            winter.season_end || winter.winter_end
              ? new Date(winter.season_end || winter.winter_end)
              : new Date(this.dates[this.dates.length - 1]);

          // Skip invalid dates
          if (isNaN(winterStart.getTime()) || isNaN(winterEnd.getTime())) return;

          const x = xScale(winterStart);
          const endX = xScale(winterEnd);

          // Skip if scale returns invalid values
          if (!isFinite(x) || !isFinite(endX)) return;

          const barWidth = endX - x;

          this.contextSvg
            .append("rect")
            .attr("class", "winter-period")
            .attr("x", x)
            .attr("y", y)
            .attr("width", barWidth)
            .attr("height", zoneHeight);
        }
      });
    }

    // Draw anomaly bars (simplified for context view)
    DataLoader.data.anomalies.forEach((anomaly) => {
      // Check visibility for this anomaly type
      let isVisible = false;
      if (anomaly.type === "Äärimmäinen kylmyys") isVisible = this.visibility.extremeCold;
      else if (anomaly.type === "Ankara pakkasjakso") isVisible = this.visibility.coldSnap;
      else if (anomaly.type === "Hellejakso") isVisible = this.visibility.heatWave;
      else if (anomaly.type === "Takatalvi") isVisible = this.visibility.returnWinter;
      else if (anomaly.type === "Äkillinen lämpeneminen") isVisible = this.visibility.tempJump;

      if (!isVisible) return;

      const startDate = anomaly.start_date || anomaly.date;
      if (!startDate) return;

      const zoneIndex = zones.indexOf(anomaly.zone);
      if (zoneIndex === -1) return;

      const start = new Date(startDate);
      // Skip if invalid date
      if (isNaN(start.getTime())) return;

      const duration = anomaly.duration_days || 1;
      const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

      const x = xScale(start);
      const endX = xScale(end);

      // Skip if scale returns invalid values
      if (!isFinite(x) || !isFinite(endX)) return;

      const barWidth = Math.max(2, endX - x);
      const y = zoneIndex * zoneHeight + 2;

      this.contextSvg
        .append("rect")
        .attr("class", "anomaly-bar")
        .attr("x", x)
        .attr("y", y)
        .attr("width", barWidth)
        .attr("height", zoneHeight - 4)
        .attr("fill", anomalyColors[anomaly.type] || "#999");
    });

    // Draw x-axis (simplified)
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickFormat(d3.timeFormat("%Y"));

    this.contextSvg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);
  },

  /**
   * Draw focus (detail) chart - shows selected range
   */
  drawFocusChart(width, height) {
    if (!DataLoader.data.anomalies || this.dates.length === 0) return;

    // Guard against invalid dimensions
    if (!width || width <= 0 || !height || height <= 0 || !isFinite(width) || !isFinite(height)) {
      console.warn("Invalid dimensions for focus chart:", { width, height });
      return;
    }

    // Guard against invalid scales
    if (!this.xScaleFocus) {
      console.warn("Focus chart: xScaleFocus not initialized");
      return;
    }

    const zones = ["Etelä-Suomi", "Keski-Suomi", "Pohjois-Suomi", "Lappi"];
    const zoneHeight = height / zones.length;
    const xScale = this.xScaleFocus;
    const [startDomain, endDomain] = this.xScaleFocus.domain();

    const anomalyColors = {
      "Äärimmäinen kylmyys": "#2171b5",
      "Ankara pakkasjakso": "#6baed6",
      Hellejakso: "#de2d26",
      Takatalvi: "#756bb1",
      "Äkillinen lämpeneminen": "#fdae6b",
    };

    // Draw zone backgrounds and labels
    const self = this;
    zones.forEach((zone, i) => {
      this.focusSvg
        .append("rect")
        .attr("x", 0)
        .attr("y", i * zoneHeight)
        .attr("width", width)
        .attr("height", zoneHeight)
        .attr("fill", i % 2 === 0 ? "#fafafa" : "#f5f5f5");

      this.focusSvg
        .append("text")
        .attr("class", "zone-label")
        .attr("x", -5)
        .attr("y", i * zoneHeight + zoneHeight / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("cursor", "pointer")
        .text(zone)
        .on("mouseover", function() {
          d3.select(this).attr("font-weight", "bold");
          if (typeof MapManager !== 'undefined' && MapManager.highlightZone) {
            MapManager.highlightZone(zone);
          }
        })
        .on("mouseout", function() {
          d3.select(this).attr("font-weight", "normal");
          if (typeof MapManager !== 'undefined' && MapManager.clearZoneHighlight) {
            MapManager.clearZoneHighlight();
          }
        });
    });

    // Draw slippery risk periods (focus view with tooltips)
    if (DataLoader.data.slipperyRisk && (this.visibility.slipperyStart || this.visibility.slipperyBar)) {
      DataLoader.data.slipperyRisk.forEach((risk) => {
        const zoneIndex = zones.indexOf(risk.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw season start marker
        if (this.visibility.slipperyStart && risk.season_start) {
          const seasonStart = new Date(risk.season_start);
          // Skip invalid dates
          if (isNaN(seasonStart.getTime())) return;
          if (seasonStart >= startDomain && seasonStart <= endDomain) {
            const xPos = xScale(seasonStart);
            if (!isFinite(xPos)) return;

            const line = this.focusSvg
              .append("line")
              .attr("class", "slippery-start-line")
              .attr("x1", xPos)
              .attr("y1", y)
              .attr("x2", xPos)
              .attr("y2", y + zoneHeight)
              .attr("stroke", "#ff9800")
              .attr("stroke-width", 2)
              .attr("stroke-dasharray", "4,2");

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", xPos - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                line.attr("stroke-width", 3);
                self.showSlipperySeasonStartTooltip(
                  event.clientX,
                  event.clientY,
                  risk
                );
              })
              .on("mouseout", function () {
                line.attr("stroke-width", 2);
                self.hideAnomalyTooltip();
              });
          }
        }

        // Draw slippery periods
        if (this.visibility.slipperyBar && risk.slippery_periods) {
          risk.slippery_periods.forEach((period) => {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);

            // Skip invalid dates
            if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) return;

            // Skip if outside visible range
            if (periodEnd < startDomain || periodStart > endDomain) return;

            const rawX = xScale(periodStart);
            const rawEndX = xScale(periodEnd);
            if (!isFinite(rawX) || !isFinite(rawEndX)) return;

            const x = Math.max(0, rawX);
            const endX = Math.min(width, rawEndX);
            const barWidth = Math.max(2, endX - x);

            const isHighRisk = period.high_risk_days > 0;

            this.focusSvg
              .append("rect")
              .attr("class", "slippery-period")
              .attr("x", x)
              .attr("y", y + zoneHeight * 0.65)
              .attr("width", barWidth)
              .attr("height", zoneHeight * 0.3)
              .attr(
                "fill",
                isHighRisk ? "rgba(255, 152, 0, 0.8)" : "rgba(255, 193, 7, 0.6)"
              )
              .attr("stroke", isHighRisk ? "#e65100" : "#f9a825")
              .attr("stroke-width", 0.5)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                d3.select(this).attr(
                  "fill",
                  isHighRisk ? "rgba(255, 152, 0, 1)" : "rgba(255, 193, 7, 0.9)"
                );
                self.showSlipperyTooltip(
                  event.clientX,
                  event.clientY,
                  risk,
                  period
                );
              })
              .on("mouseout", function () {
                d3.select(this).attr(
                  "fill",
                  isHighRisk
                    ? "rgba(255, 152, 0, 0.8)"
                    : "rgba(255, 193, 7, 0.6)"
                );
                self.hideAnomalyTooltip();
              });
          });
        }
      });
    }

    // Draw first frost data (focus view with tooltips)
    if (DataLoader.data.firstFrost && (this.visibility.frostMarker || this.visibility.frostBar)) {
      DataLoader.data.firstFrost.forEach((frost) => {
        const zoneIndex = zones.indexOf(frost.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw first frost marker line
        if (this.visibility.frostMarker && frost.first_frost_date) {
          const frostDate = new Date(frost.first_frost_date);
          // Skip invalid dates
          if (isNaN(frostDate.getTime())) return;
          if (frostDate >= startDomain && frostDate <= endDomain) {
            const x = xScale(frostDate);
            if (!isFinite(x)) return;

            const line = this.focusSvg
              .append("line")
              .attr("class", "first-frost-line")
              .attr("x1", x)
              .attr("y1", y)
              .attr("x2", x)
              .attr("y2", y + zoneHeight)
              .attr("stroke", "#00bcd4")
              .attr("stroke-width", 2)
              .attr("stroke-dasharray", "4,2");

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", x - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                line.attr("stroke-width", 3);
                self.showFrostTooltip(
                  event.clientX,
                  event.clientY,
                  frost,
                  null
                );
              })
              .on("mouseout", function () {
                line.attr("stroke-width", 2);
                self.hideAnomalyTooltip();
              });
          }
        }

        // Draw frost periods
        if (this.visibility.frostBar && frost.frost_periods) {
          frost.frost_periods.forEach((period) => {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);

            // Skip invalid dates
            if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) return;

            // Skip if outside visible range
            if (periodEnd < startDomain || periodStart > endDomain) return;

            const rawX = xScale(periodStart);
            const rawEndX = xScale(periodEnd);
            if (!isFinite(rawX) || !isFinite(rawEndX)) return;

            const x = Math.max(0, rawX);
            const endX = Math.min(width, rawEndX);
            const barWidth = Math.max(2, endX - x);

            this.focusSvg
              .append("rect")
              .attr("class", "frost-period")
              .attr("x", x)
              .attr("y", y + zoneHeight * 0.4)
              .attr("width", barWidth)
              .attr("height", zoneHeight * 0.25)
              .attr("fill", "rgba(0, 188, 212, 0.5)")
              .attr("stroke", "rgba(0, 188, 212, 0.8)")
              .attr("stroke-width", 0.5)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                d3.select(this).attr("fill", "rgba(0, 188, 212, 0.7)");
                self.showFrostTooltip(
                  event.clientX,
                  event.clientY,
                  frost,
                  period
                );
              })
              .on("mouseout", function () {
                d3.select(this).attr("fill", "rgba(0, 188, 212, 0.5)");
                self.hideAnomalyTooltip();
              });
          });
        }
      });
    }

    // Draw first snow data (focus view with tooltips) - ensilumi
    if (DataLoader.data.firstSnow && this.visibility.snowMarker) {
      DataLoader.data.firstSnow.forEach((snow) => {
        const zoneIndex = zones.indexOf(snow.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // Draw first snow marker line
        if (snow.first_snow_date) {
          const snowDate = new Date(snow.first_snow_date);
          // Skip invalid dates
          if (isNaN(snowDate.getTime())) return;
          if (snowDate >= startDomain && snowDate <= endDomain) {
            const x = xScale(snowDate);
            if (!isFinite(x)) return;

            const line = this.focusSvg
              .append("line")
              .attr("class", "first-snow-line")
              .attr("x1", x)
              .attr("y1", y)
              .attr("x2", x)
              .attr("y2", y + zoneHeight)
              .attr("stroke", "#90caf9")
              .attr("stroke-width", 2)
              .attr("stroke-dasharray", "4,2");

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", x - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                line.attr("stroke-width", 3);
                self.showSnowTooltip(
                  event.clientX,
                  event.clientY,
                  snow
                );
              })
              .on("mouseout", function () {
                line.attr("stroke-width", 2);
                self.hideAnomalyTooltip();
              });
          }
        }
      });
    }

    // Draw winter periods with detailed cold/warm spells
    if (DataLoader.data.winterStarts && (this.visibility.coldSpell || this.visibility.warmSpell || this.visibility.winterStart || this.visibility.winterEnd)) {
      DataLoader.data.winterStarts.forEach((winter) => {
        const zoneIndex = zones.indexOf(winter.zone);
        if (zoneIndex === -1) return;

        const y = zoneIndex * zoneHeight;

        // If we have detailed cold_spells data, draw individual spells
        if (this.visibility.coldSpell && winter.cold_spells && winter.cold_spells.length > 0) {
          // Draw cold spells (frost periods)
          winter.cold_spells.forEach((spell) => {
            const spellStart = new Date(spell.start);
            const spellEnd = new Date(spell.end);

            // Skip invalid dates
            if (isNaN(spellStart.getTime()) || isNaN(spellEnd.getTime())) return;

            // Skip if outside visible range
            if (spellEnd < startDomain || spellStart > endDomain) return;

            const rawX = xScale(spellStart);
            const rawEndX = xScale(spellEnd);
            if (!isFinite(rawX) || !isFinite(rawEndX)) return;

            const x = Math.max(0, rawX);
            const endX = Math.min(width, rawEndX);
            const barWidth = Math.max(2, endX - x);

            this.focusSvg
              .append("rect")
              .attr("class", "winter-period cold-spell")
              .attr("x", x)
              .attr("y", y + 1)
              .attr("width", barWidth)
              .attr("height", zoneHeight - 2)
              .attr("fill", "rgba(33, 113, 181, 0.5)")
              .attr("stroke", "rgba(33, 113, 181, 0.8)")
              .attr("stroke-width", 0.5)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                d3.select(this).attr("fill", "rgba(33, 113, 181, 0.7)");
                self.showWinterSpellTooltip(
                  event.clientX,
                  event.clientY,
                  winter,
                  spell,
                  "cold"
                );
              })
              .on("mouseout", function () {
                d3.select(this).attr("fill", "rgba(33, 113, 181, 0.5)");
                self.hideAnomalyTooltip();
              });
          });

          // Draw warm spells (interruptions) - optional, shown as gaps or different color
          if (this.visibility.warmSpell && winter.warm_spells) {
            winter.warm_spells.forEach((spell) => {
              const spellStart = new Date(spell.start);
              const spellEnd = new Date(spell.end);

              // Skip invalid dates
              if (isNaN(spellStart.getTime()) || isNaN(spellEnd.getTime())) return;

              if (spellEnd < startDomain || spellStart > endDomain) return;

              const rawX = xScale(spellStart);
              const rawEndX = xScale(spellEnd);
              if (!isFinite(rawX) || !isFinite(rawEndX)) return;

              const x = Math.max(0, rawX);
              const endX = Math.min(width, rawEndX);
              const barWidth = Math.max(2, endX - x);

              this.focusSvg
                .append("rect")
                .attr("class", "winter-period warm-spell")
                .attr("x", x)
                .attr("y", y + zoneHeight * 0.3)
                .attr("width", barWidth)
                .attr("height", zoneHeight * 0.4)
                .attr("fill", "rgba(253, 174, 107, 0.6)")
                .attr("stroke", "rgba(253, 174, 107, 0.9)")
                .attr("stroke-width", 0.5)
                .style("cursor", "pointer")
                .on("mouseover", function (event) {
                  d3.select(this).attr("fill", "rgba(253, 174, 107, 0.8)");
                  self.showWinterSpellTooltip(
                    event.clientX,
                    event.clientY,
                    winter,
                    spell,
                    "warm"
                  );
                })
                .on("mouseout", function () {
                  d3.select(this).attr("fill", "rgba(253, 174, 107, 0.6)");
                  self.hideAnomalyTooltip();
                });
            });
          }

          // Draw season boundary lines
          const seasonStart = new Date(winter.season_start);
          const seasonEnd = new Date(winter.season_end);

          // Skip if invalid dates
          if (isNaN(seasonStart.getTime())) return;

          if (this.visibility.winterStart && seasonStart >= startDomain && seasonStart <= endDomain) {
            const xPos = xScale(seasonStart);
            if (!isFinite(xPos)) return;

            const startLine = this.focusSvg
              .append("line")
              .attr("class", "winter-start-line")
              .attr("x1", xPos)
              .attr("y1", y)
              .attr("x2", xPos)
              .attr("y2", y + zoneHeight);

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", xPos - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                startLine.attr("stroke-width", 2.5);
                self.showWinterSeasonTooltip(
                  event.clientX,
                  event.clientY,
                  winter,
                  "start"
                );
              })
              .on("mouseout", function () {
                startLine.attr("stroke-width", null);
                self.hideAnomalyTooltip();
              });
          }

          if (
            this.visibility.winterEnd &&
            winter.season_end &&
            !isNaN(seasonEnd.getTime()) &&
            seasonEnd >= startDomain &&
            seasonEnd <= endDomain
          ) {
            const xPos = xScale(seasonEnd);
            if (!isFinite(xPos)) return;

            const endLine = this.focusSvg
              .append("line")
              .attr("class", "winter-end-line")
              .attr("x1", xPos)
              .attr("y1", y)
              .attr("x2", xPos)
              .attr("y2", y + zoneHeight);

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", xPos - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                endLine.attr("stroke-width", 2.5);
                self.showWinterSeasonTooltip(
                  event.clientX,
                  event.clientY,
                  winter,
                  "end"
                );
              })
              .on("mouseout", function () {
                endLine.attr("stroke-width", null);
                self.hideAnomalyTooltip();
              });
          }
        } else if (winter.season_start || winter.winter_start) {
          // Fallback to old format (solid block)
          const winterStart = new Date(
            winter.season_start || winter.winter_start
          );
          const winterEnd =
            winter.season_end || winter.winter_end
              ? new Date(winter.season_end || winter.winter_end)
              : new Date(this.dates[this.dates.length - 1]);

          // Skip invalid dates
          if (isNaN(winterStart.getTime()) || isNaN(winterEnd.getTime())) return;

          if (winterEnd < startDomain || winterStart > endDomain) return;

          const rawX = xScale(winterStart);
          const rawEndX = xScale(winterEnd);
          if (!isFinite(rawX) || !isFinite(rawEndX)) return;

          const x = Math.max(0, rawX);
          const endX = Math.min(width, rawEndX);
          const barWidth = endX - x;

          this.focusSvg
            .append("rect")
            .attr("class", "winter-period")
            .attr("x", x)
            .attr("y", y)
            .attr("width", barWidth)
            .attr("height", zoneHeight);

          if (this.visibility.winterStart && winterStart >= startDomain && winterStart <= endDomain) {
            const xPos = xScale(winterStart);
            if (!isFinite(xPos)) return;

            const startLine = this.focusSvg
              .append("line")
              .attr("class", "winter-start-line")
              .attr("x1", xPos)
              .attr("y1", y)
              .attr("x2", xPos)
              .attr("y2", y + zoneHeight);

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", xPos - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                startLine.attr("stroke-width", 2.5);
                self.showWinterSeasonTooltip(
                  event.clientX,
                  event.clientY,
                  winter,
                  "start"
                );
              })
              .on("mouseout", function () {
                startLine.attr("stroke-width", null);
                self.hideAnomalyTooltip();
              });
          }

          if (
            this.visibility.winterEnd &&
            (winter.season_end || winter.winter_end) &&
            winterEnd >= startDomain &&
            winterEnd <= endDomain
          ) {
            const xPos = xScale(winterEnd);
            if (!isFinite(xPos)) return;

            const endLine = this.focusSvg
              .append("line")
              .attr("class", "winter-end-line")
              .attr("x1", xPos)
              .attr("y1", y)
              .attr("x2", xPos)
              .attr("y2", y + zoneHeight);

            // Add hover area for better mouse targeting
            this.focusSvg
              .append("rect")
              .attr("class", "line-hover-area")
              .attr("x", xPos - 8)
              .attr("y", y)
              .attr("width", 16)
              .attr("height", zoneHeight)
              .attr("fill", "transparent")
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                endLine.attr("stroke-width", 2.5);
                self.showWinterSeasonTooltip(
                  event.clientX,
                  event.clientY,
                  winter,
                  "end"
                );
              })
              .on("mouseout", function () {
                endLine.attr("stroke-width", null);
                self.hideAnomalyTooltip();
              });
          }
        }
      });
    }

    // Draw anomaly bars with tooltips
    DataLoader.data.anomalies.forEach((anomaly) => {
      // Check visibility for this anomaly type
      let isVisible = false;
      if (anomaly.type === "Äärimmäinen kylmyys") isVisible = this.visibility.extremeCold;
      else if (anomaly.type === "Ankara pakkasjakso") isVisible = this.visibility.coldSnap;
      else if (anomaly.type === "Hellejakso") isVisible = this.visibility.heatWave;
      else if (anomaly.type === "Takatalvi") isVisible = this.visibility.returnWinter;
      else if (anomaly.type === "Äkillinen lämpeneminen") isVisible = this.visibility.tempJump;

      if (!isVisible) return;

      const startDate = anomaly.start_date || anomaly.date;
      if (!startDate) return;

      const zoneIndex = zones.indexOf(anomaly.zone);
      if (zoneIndex === -1) return;

      const start = new Date(startDate);
      // Skip if invalid date
      if (isNaN(start.getTime())) return;

      const duration = anomaly.duration_days || 1;
      const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

      // Skip if outside visible range
      if (end < startDomain || start > endDomain) return;

      const rawX = xScale(start);
      const rawEndX = xScale(end);

      // Skip if scale returns invalid values
      if (!isFinite(rawX) || !isFinite(rawEndX)) return;

      const x = Math.max(0, rawX);
      const endX = Math.min(width, rawEndX);
      const barWidth = Math.max(3, endX - x);
      const y = zoneIndex * zoneHeight + 3;

      this.focusSvg
        .append("rect")
        .attr("class", "anomaly-bar")
        .attr("x", x)
        .attr("y", y)
        .attr("width", barWidth)
        .attr("height", zoneHeight - 6)
        .attr("fill", anomalyColors[anomaly.type] || "#999")
        .attr("stroke", anomalyColors[anomaly.type] || "#999")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function (event) {
          d3.select(this).attr("stroke-width", 2);
          self.showAnomalyTooltip(
            event.clientX,
            event.clientY,
            startDate,
            [anomaly],
            self.getWinterStatusForDate(startDate)
          );
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke-width", 1);
          self.hideAnomalyTooltip();
        })
        .on("click", function (event) {
          event.stopPropagation();
          self.setDate(startDate);
          self.stop();
        });
    });

    // Draw current date indicator
    if (this.currentDate) {
      const currentDateObj = new Date(this.currentDate);
      if (currentDateObj >= startDomain && currentDateObj <= endDomain) {
        this.focusSvg
          .append("line")
          .attr("class", "current-date-line")
          .attr("x1", xScale(currentDateObj))
          .attr("y1", 0)
          .attr("x2", xScale(currentDateObj))
          .attr("y2", height);
      }
    }

    // Draw x-axis
    const daysDiff = (endDomain - startDomain) / (1000 * 60 * 60 * 24);
    let tickFormat, ticks;

    if (daysDiff <= 14) {
      tickFormat = d3.timeFormat("%d.%m");
      ticks = d3.timeDay.every(1);
    } else if (daysDiff <= 60) {
      tickFormat = d3.timeFormat("%d.%m");
      ticks = d3.timeWeek.every(1);
    } else if (daysDiff <= 365) {
      tickFormat = finnishMonthYear;
      ticks = d3.timeMonth.every(1);
    } else {
      tickFormat = finnishMonthYear;
      ticks = d3.timeMonth.every(3);
    }

    const xAxis = d3.axisBottom(xScale).ticks(ticks).tickFormat(tickFormat);

    this.focusSvg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);
  },

  /**
   * Redraw timeline (called when current date changes)
   */
  drawAnomalyTimeline() {
    if (!this.focusSvg || !this.xScaleFocus) return;

    const focusContainer = document.getElementById("anomaly-focus");
    if (!focusContainer) return;

    const width =
      focusContainer.clientWidth - this.margin.left - this.margin.right;
    const focusHeight = this.focusHeight - this.margin.top - this.margin.bottom;

    this.focusSvg.selectAll("*").remove();
    this.drawFocusChart(width, focusHeight);

    // Re-add interaction handlers (click + drag to scrub)
    const self = this;

    this.focusSvg.on("mousedown", function(event) {
      self.isDragging = true;
      self.stop();

      const [x] = d3.pointer(event);
      const clickedDate = self.xScaleFocus.invert(x);
      self.jumpToClosestDate(clickedDate);
    });

    this.focusSvg.on("mousemove", function(event) {
      if (self.isDragging) {
        const [x] = d3.pointer(event);
        const clickedDate = self.xScaleFocus.invert(x);
        self.jumpToClosestDate(clickedDate);
      }
    });

    this.focusSvg.on("mouseup", function(event) {
      self.isDragging = false;
    });

    this.focusSvg.on("mouseleave", function(event) {
      self.isDragging = false;
    });

    this.focusSvg.on("click", (event) => {
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

    const zones = ["Etelä-Suomi", "Keski-Suomi", "Pohjois-Suomi", "Lappi"];
    const statuses = [];

    zones.forEach((zone) => {
      const status = DataLoader.getWinterStatus(date, zone);
      if (status && status.inWinter) {
        statuses.push({
          zone: zone,
          daysSinceStart: status.daysSinceStart,
          season: status.season,
        });
      }
    });

    return statuses;
  },

  /**
   * Position tooltip intelligently (avoid viewport edges)
   * @param {HTMLElement} tooltip - The tooltip element
   * @param {number} x - Mouse X position
   * @param {number} y - Mouse Y position
   */
  positionTooltip(tooltip, x, y) {
    // First set display to block so we can measure dimensions
    tooltip.style.display = "block";

    // Get tooltip dimensions
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default offset from cursor
    const offset = 15;

    // Calculate positions
    let left = x + offset;
    let top = y + offset;

    // Check if tooltip would go off the right edge
    if (left + tooltipWidth > viewportWidth - 10) {
      // Position to the left of cursor instead
      left = x - tooltipWidth - offset;
    }

    // Check if tooltip would go off the bottom edge
    if (top + tooltipHeight > viewportHeight - 10) {
      // Position above cursor instead
      top = y - tooltipHeight - offset;
    }

    // Make sure tooltip doesn't go off left edge
    if (left < 10) {
      left = 10;
    }

    // Make sure tooltip doesn't go off top edge
    if (top < 10) {
      top = 10;
    }

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
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
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    // Create tooltip if it doesn't exist
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    // Build tooltip content
    let html = `<strong>${date}</strong><br><br>`;

    // Add winter status
    if (winterStatus.length > 0) {
      html += '<div style="margin-bottom: 8px; color: #aed6f1;">';
      html += "❄️ <strong>Winter:</strong><br>";
      winterStatus.forEach((w) => {
        html += `<span style="font-size: 11px; margin-left: 15px;">• ${w.zone}: Day ${w.daysSinceStart}</span><br>`;
      });
      html += "</div>";
    }

    // Add anomalies
    if (anomalies.length > 0) {
      const anomalyIcons = {
        "Äärimmäinen kylmyys": "❄️",
        "Ankara pakkasjakso": "🥶",
        Hellejakso: "☀️",
        Takatalvi: "⛄",
        "Äkillinen lämpeneminen": "⚡",
      };

      const anomalyColors = {
        "Äärimmäinen kylmyys": "#6baed6",
        "Ankara pakkasjakso": "#9ecae1",
        Hellejakso: "#fc8d62",
        Takatalvi: "#bc80bd",
        "Äkillinen lämpeneminen": "#fdb462",
      };

      html += '<div style="margin-top: 8px;">';
      html += "⚠️ <strong>Active Anomalies:</strong><br>";

      anomalies.forEach((a) => {
        const icon = anomalyIcons[a.type] || "⚠️";
        const color = anomalyColors[a.type] || "#999";
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
        html += "</span></div>";
      });
      html += "</div>";
    }

    // Show "No activity" if nothing is happening
    if (anomalies.length === 0 && winterStatus.length === 0) {
      html +=
        '<span style="color: #999;">No anomalies or winter activity</span>';
    }

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Hide anomaly tooltip
   */
  hideAnomalyTooltip() {
    const tooltip = document.getElementById("anomaly-timeline-tooltip");
    if (tooltip) {
      tooltip.style.display = "none";
    }
  },

  /**
   * Show tooltip for slippery season start
   */
  showSlipperySeasonStartTooltip(x, y, risk) {
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    let html = `<div style="color: #ff9800;">
      <strong>⚠️ Liukkauskausi alkaa</strong><br>
      <span style="color: #ccc;">${risk.zone}</span><br>
      <span style="color: #aaa;">Syksy ${risk.year}</span>
    </div>
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #666; font-size: 11px;">
      <strong>Kausi alkaa:</strong> ${risk.season_start}<br>
      <strong>Riskipäiviä:</strong> ${risk.risk_days_total}
    </div>`;

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Show tooltip for winter season start/end
   */
  showWinterSeasonTooltip(x, y, winter, type) {
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    const date = type === "start" ? winter.season_start : winter.season_end;
    const label = type === "start" ? "❄️ Talvi alkaa" : "🌱 Talvi päättyy";

    let html = `<div style="color: #6baed6;">
      <strong>${label}</strong><br>
      <span style="color: #ccc;">${winter.zone}</span><br>
      <span style="color: #aaa;">Talvi ${winter.season}</span>
    </div>
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #666; font-size: 11px;">
      <strong>Päivämäärä:</strong> ${date}
    </div>`;

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Show tooltip for winter spell (cold or warm)
   */
  showWinterSpellTooltip(x, y, winter, spell, type) {
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    let html = "";

    if (type === "cold") {
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
      Kausi: ${winter.frost_days}/${winter.total_days} pakkaspäivää (${
      winter.coverage_pct
    }%)<br>
      Katkonaisuus: ${(winter.fragmentation_index * 100).toFixed(0)}%
    </div>`;

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Show tooltip for slippery road risk period
   */
  showSlipperyTooltip(x, y, risk, period) {
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    const isHighRisk = period.high_risk_days > 0;
    const avgMin =
      period.avg_min_temp !== null ? period.avg_min_temp.toFixed(1) : "-";
    const avgMax =
      period.avg_max_temp !== null ? period.avg_max_temp.toFixed(1) : "-";

    let html = `<div style="color: ${isHighRisk ? "#ff9800" : "#ffc107"};">
      <strong>⚠️ Liukkausriski</strong><br>
      <span style="font-size: 11px;">${risk.zone} • Syksy ${risk.year}</span>
    </div>
    <div style="margin-top: 8px;">
      <strong>${period.start}</strong> → <strong>${period.end}</strong><br>
      Kesto: ${period.duration} päivää<br>
      ${isHighRisk ? `Korkea riski: ${period.high_risk_days} pv<br>` : ""}
      Yölämpötila: ${avgMin}°C<br>
      Päivälämpötila: ${avgMax}°C
    </div>`;

    // Add season summary
    html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
      Liukkauskausi alkoi: ${risk.season_start}<br>
      Riskipäiviä syksyllä: ${risk.risk_days_total} (korkea: ${risk.high_risk_days})
    </div>`;

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Show tooltip for first frost data
   */
  showFrostTooltip(x, y, frost, period) {
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    let html = "";

    if (period) {
      // Frost period tooltip
      const minTemp =
        period.min_temp !== null ? period.min_temp.toFixed(1) : "-";
      const avgMinTemp =
        period.avg_min_temp !== null ? period.avg_min_temp.toFixed(1) : "-";

      html = `<div style="color: #00bcd4;">
        <strong>🥶 Nollaraja alittuu</strong><br>
        <span style="font-size: 11px;">${frost.zone} • Syksy ${frost.year}</span>
      </div>
      <div style="margin-top: 8px;">
        <strong>${period.start}</strong> → <strong>${period.end}</strong><br>
        Kesto: ${period.duration} päivää<br>
        Kylmin yölämpötila: ${minTemp}°C<br>
        Keskiarvo: ${avgMinTemp}°C
      </div>`;
    } else {
      // First frost marker tooltip
      const firstFrostTemp =
        frost.first_frost_temp !== null
          ? frost.first_frost_temp.toFixed(1)
          : "-";
      const avgFrostTemp =
        frost.avg_frost_temp !== null ? frost.avg_frost_temp.toFixed(1) : "-";
      const coldestTemp =
        frost.coldest_temp !== null ? frost.coldest_temp.toFixed(1) : "-";

      html = `<div style="color: #00bcd4;">
        <strong>🌡️ Ensimmäinen yöpakkanen</strong><br>
        <span style="font-size: 11px;">${frost.zone} • Syksy ${frost.year}</span>
      </div>
      <div style="margin-top: 8px;">
        <strong>${frost.first_frost_date}</strong><br>
        Lämpötila: ${firstFrostTemp}°C
      </div>`;

      // Add season summary
      html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
        Pakkasöitä syksyllä: ${frost.frost_nights_total}<br>
        Keskiarvo pakkasyö: ${avgFrostTemp}°C<br>
        Kylmin yö: ${coldestTemp}°C
      </div>`;
    }

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Show tooltip for first snow data (ensilumi)
   */
  showSnowTooltip(x, y, snow) {
    let tooltip = document.getElementById("anomaly-timeline-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "anomaly-timeline-tooltip";
      tooltip.style.position = "fixed";
      tooltip.style.background = "rgba(0, 0, 0, 0.9)";
      tooltip.style.color = "white";
      tooltip.style.padding = "10px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.fontSize = "12px";
      tooltip.style.zIndex = "10000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.maxWidth = "300px";
      tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltip);
    }

    const snowDepth =
      snow.first_snow_depth !== null ? snow.first_snow_depth.toFixed(1) : "-";
    const maxSnowDepth =
      snow.max_snow_depth !== null ? snow.max_snow_depth.toFixed(1) : "-";

    let html = `<div style="color: #90caf9;">
      <strong>❄️ Ensilumi</strong><br>
      <span style="font-size: 11px;">${snow.zone} • Syksy ${snow.year}</span>
    </div>
    <div style="margin-top: 8px;">
      <strong>${snow.first_snow_date}</strong><br>
      Lumensyvyys: ${snowDepth} cm
    </div>`;

    // Add season summary
    html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
      Lumipäiviä syksyllä: ${snow.snow_days_total}<br>
      Maksimilumi: ${maxSnowDepth} cm
    </div>`;

    tooltip.innerHTML = html;

    // Position tooltip intelligently
    this.positionTooltip(tooltip, x, y);
  },

  /**
   * Attach event handlers to timeline UI elements
   */
  attachEventHandlers() {
    const slider = document.getElementById("date-slider");
    const playButton = document.getElementById("btn-play");
    const firstButton = document.getElementById("btn-first");
    const prevButton = document.getElementById("btn-prev");
    const nextButton = document.getElementById("btn-next");
    const lastButton = document.getElementById("btn-last");
    const speedControl = document.getElementById("speed-slider");
    const speedDisplay = document.getElementById("speed-value");

    if (slider) {
      slider.min = 0;
      slider.max = this.dates.length - 1;
      slider.value = this.dates.indexOf(this.currentDate);

      slider.addEventListener("input", (e) => {
        const index = parseInt(e.target.value);
        this.setDate(this.dates[index]);
        this.stop(); // Stop animation when user drags slider
      });
      console.log("Date slider attached");
    } else {
      console.warn("Date slider not found");
    }

    if (playButton) {
      playButton.addEventListener("click", () => {
        console.log("Play button clicked");
        if (this.isPlaying) {
          this.stop();
        } else {
          this.play();
        }
      });
    } else {
      console.warn("Play button not found");
    }

    if (firstButton) {
      firstButton.addEventListener("click", () => {
        this.setDate(this.dates[0]);
        this.stop();
      });
    }

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        this.previousDate();
        this.stop();
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        this.nextDate();
        this.stop();
      });
    }

    if (lastButton) {
      lastButton.addEventListener("click", () => {
        this.setDate(this.dates[this.dates.length - 1]);
        this.stop();
      });
    }

    if (speedControl) {
      speedControl.addEventListener("input", (e) => {
        const speed = parseInt(e.target.value);
        this.setSpeed(speed);
        if (speedDisplay) {
          speedDisplay.textContent = speed + "ms";
        }
      });
    } else {
      console.warn("Speed control not found");
    }
  },

  /**
   * Attach click handlers to legend items for toggling visibility
   * Supports drag-to-toggle: hold mouse button and drag over items to toggle multiple
   */
  attachLegendToggles() {
    const legendContainer = document.querySelector("#anomaly-timeline .anomaly-legend-inline");
    if (!legendContainer) return;

    const legendItems = legendContainer.querySelectorAll(".legend-item");

    // Drag-to-toggle state
    let isDragging = false;
    let dragTargetState = null; // The state we're setting items to (true/false)
    let toggledDuringDrag = new Set(); // Track which items were toggled during this drag

    // Helper to get visKey from a legend item
    const getVisKey = (item) => {
      if (item.querySelector(".cold-spell-icon")) return "coldSpell";
      if (item.querySelector(".warm-spell-icon")) return "warmSpell";
      if (item.querySelector(".winter-start-icon")) return "winterStart";
      if (item.querySelector(".winter-end-icon")) return "winterEnd";
      if (item.querySelector(".slippery-start-icon")) return "slipperyStart";
      if (item.querySelector(".slippery-bar-icon")) return "slipperyBar";
      if (item.querySelector(".frost-marker-icon")) return "frostMarker";
      if (item.querySelector(".frost-bar-icon")) return "frostBar";
      if (item.querySelector(".snow-marker-icon")) return "snowMarker";
      if (item.querySelector(".anomaly-icon.extreme-cold")) return "extremeCold";
      if (item.querySelector(".anomaly-icon.cold-snap")) return "coldSnap";
      if (item.querySelector(".anomaly-icon.heat-wave")) return "heatWave";
      if (item.querySelector(".anomaly-icon.return-winter")) return "returnWinter";
      if (item.querySelector(".anomaly-icon.temp-jump")) return "tempJump";
      return null;
    };

    // Helper to toggle an item
    const toggleItem = (item, visKey, forceState = null) => {
      const newState = forceState !== null ? forceState : !this.visibility[visKey];
      this.visibility[visKey] = newState;

      if (newState) {
        item.classList.remove("legend-disabled");
      } else {
        item.classList.add("legend-disabled");
      }
    };

    legendItems.forEach((item) => {
      // Make legend items clickable
      item.style.cursor = "pointer";
      item.style.userSelect = "none";

      const visKey = getVisKey(item);
      if (!visKey) return;

      // Mouse down - start drag mode
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        toggledDuringDrag.clear();

        // Toggle this item and set the target state for drag
        dragTargetState = !this.visibility[visKey];
        toggleItem(item, visKey, dragTargetState);
        toggledDuringDrag.add(visKey);

        this.drawAnomalyTimeline();
      });

      // Mouse enter while dragging - toggle this item too
      item.addEventListener("mouseenter", () => {
        if (isDragging && visKey && !toggledDuringDrag.has(visKey)) {
          toggleItem(item, visKey, dragTargetState);
          toggledDuringDrag.add(visKey);
          this.drawAnomalyTimeline();
        }
      });
    });

    // Mouse up anywhere - end drag mode
    document.addEventListener("mouseup", () => {
      isDragging = false;
      dragTargetState = null;
      toggledDuringDrag.clear();
    });
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
    const slider = document.getElementById("date-slider");
    const dateDisplayTimeline = document.getElementById("date-current");
    const dateDisplayLegend = document.getElementById("current-date-display");

    if (slider) {
      slider.value = this.dates.indexOf(this.currentDate);
    }

    // Update both date displays
    if (dateDisplayTimeline) {
      dateDisplayTimeline.textContent = this.formatDisplayDate(this.currentDate);
    }

    if (dateDisplayLegend) {
      dateDisplayLegend.textContent = this.formatDisplayDate(this.currentDate);
    }

    // Redraw anomaly timeline with new current date indicator
    this.drawAnomalyTimeline();

    // Update active anomalies list
    this.updateActiveAnomaliesList();
  },

  /**
   * Update the active anomalies list in both sidebars
   * Now shows all 13 phenomenon types, not just anomalies
   */
  updateActiveAnomaliesList() {
    const leftContainer = document.getElementById("active-anomalies-list");
    const rightContainer = document.getElementById(
      "active-anomalies-list-right"
    );

    if (!this.currentDate) return;

    // Get all phenomena for current date (all 13 types)
    const allPhenomena = DataLoader.getAllPhenomenaForDate(this.currentDate);

    // Build HTML for left sidebar (compact version)
    if (leftContainer) {
      if (!allPhenomena || allPhenomena.length === 0) {
        leftContainer.innerHTML =
          '<p style="color: #999; font-size: 12px;">Ei ilmiöitä tänä päivänä</p>';
      } else {
        let html = "";
        allPhenomena.forEach((phenomenon) => {
          const config = this.phenomenonConfig[phenomenon.type];
          if (!config) return;

          let details = [];
          if (phenomenon.duration_days && phenomenon.duration_days > 1) {
            details.push(`${phenomenon.duration_days} pv`);
          }
          if (phenomenon.min_temp !== null && phenomenon.min_temp !== undefined) {
            details.push(`Min: ${phenomenon.min_temp.toFixed(1)}°C`);
          }
          if (phenomenon.max_temp !== null && phenomenon.max_temp !== undefined) {
            details.push(`Max: ${phenomenon.max_temp.toFixed(1)}°C`);
          }

          html += `
            <div class="active-anomaly-item ${config.cssClass}">
              <span class="anomaly-type">${config.icon} ${config.label}</span>
              <span class="anomaly-zone">${phenomenon.zone}</span>
              ${
                details.length > 0
                  ? `<div class="anomaly-details">${details.join(" • ")}</div>`
                  : ""
              }
            </div>
          `;
        });
        leftContainer.innerHTML = html;
      }
    }

    // Build HTML for right sidebar (card-style version with more details)
    if (rightContainer) {
      if (!allPhenomena || allPhenomena.length === 0) {
        rightContainer.innerHTML =
          '<p class="no-anomalies-message">Ei ilmiöitä tänä päivänä</p>';
      } else {
        let html = "";
        allPhenomena.forEach((phenomenon, index) => {
          html += this.renderPhenomenonCard(phenomenon, index);
        });
        rightContainer.innerHTML = html;

        // Attach click handlers for detail panel
        this.attachPhenomenonClickHandlers();
      }
    }
  },

  /**
   * Render a single phenomenon card for the right sidebar
   * @param {Object} phenomenon - Phenomenon data object
   * @param {number} index - Index for data attribute
   * @returns {string} HTML string for the card
   */
  renderPhenomenonCard(phenomenon, index) {
    const config = this.phenomenonConfig[phenomenon.type];
    if (!config) {
      console.warn("No config for phenomenon type:", phenomenon.type);
      return "";
    }

    const icon = config.icon || "•";
    const cssClass = config.cssClass || "";

    // Format dates
    let dateStr = "";
    if (phenomenon.start_date && phenomenon.end_date) {
      dateStr = `${this.formatShortDate(phenomenon.start_date)} - ${this.formatShortDate(phenomenon.end_date)}`;
      if (phenomenon.duration_days && phenomenon.duration_days > 1) {
        dateStr += ` (${phenomenon.duration_days} pv)`;
      }
    } else if (phenomenon.date) {
      dateStr = this.formatShortDate(phenomenon.date);
    } else if (phenomenon.start_date) {
      dateStr = this.formatShortDate(phenomenon.start_date);
      if (phenomenon.duration_days && phenomenon.duration_days > 1) {
        const endDate = this.addDays(phenomenon.start_date, phenomenon.duration_days - 1);
        dateStr = `${this.formatShortDate(phenomenon.start_date)} - ${this.formatShortDate(endDate)} (${phenomenon.duration_days} pv)`;
      }
    }

    // Build details array
    let details = [];

    if (phenomenon.min_temp !== null && phenomenon.min_temp !== undefined) {
      details.push(`Min: <strong>${phenomenon.min_temp.toFixed(1)}°C</strong>`);
    }
    if (phenomenon.max_temp !== null && phenomenon.max_temp !== undefined) {
      details.push(`Max: <strong>${phenomenon.max_temp.toFixed(1)}°C</strong>`);
    }
    if (phenomenon.avg_min_temp !== null && phenomenon.avg_min_temp !== undefined) {
      details.push(`Ka. min: <strong>${phenomenon.avg_min_temp.toFixed(1)}°C</strong>`);
    }
    if (phenomenon.avg_max_temp !== null && phenomenon.avg_max_temp !== undefined) {
      details.push(`Ka. max: <strong>${phenomenon.avg_max_temp.toFixed(1)}°C</strong>`);
    }
    if (phenomenon.high_risk_days) {
      details.push(`Korkea riski: <strong>${phenomenon.high_risk_days} pv</strong>`);
    }
    if (phenomenon.frost_temp !== null && phenomenon.frost_temp !== undefined) {
      details.push(`Lämpötila: <strong>${phenomenon.frost_temp.toFixed(1)}°C</strong>`);
    }
    if (phenomenon.total_days) {
      details.push(`Kesto: <strong>${phenomenon.total_days} pv</strong>`);
    }
    if (phenomenon.risk_days_total) {
      details.push(`Riskipäiviä: <strong>${phenomenon.risk_days_total} pv</strong>`);
    }

    const valueStr = details.join(" / ");

    // Check if this card is expanded
    const isExpanded = this.expandedPhenomenon &&
      this.expandedPhenomenon.type === phenomenon.type &&
      this.expandedPhenomenon.zone === phenomenon.zone &&
      this.expandedPhenomenon.start_date === (phenomenon.start_date || phenomenon.date);

    return `
      <div class="anomaly-card phenomenon-card ${cssClass}${isExpanded ? " expanded" : ""}"
           data-phenomenon-index="${index}"
           data-phenomenon-type="${phenomenon.type}"
           data-phenomenon-zone="${phenomenon.zone}"
           data-phenomenon-start="${phenomenon.start_date || phenomenon.date || ""}"
           data-phenomenon-end="${phenomenon.end_date || ""}">
        <div class="anomaly-header">
          <span class="anomaly-type">${icon} ${config.label}</span>
          <span class="anomaly-zone">${phenomenon.zone}</span>
        </div>
        ${dateStr ? `<div class="anomaly-dates">${dateStr}</div>` : ""}
        ${valueStr ? `<div class="anomaly-value">${valueStr}</div>` : ""}
      </div>
    `;
  },

  /**
   * Attach click handlers to phenomenon cards for detail panel
   */
  attachPhenomenonClickHandlers() {
    const cards = document.querySelectorAll(".phenomenon-card");
    const detailPanel = document.getElementById("phenomenon-detail-panel");

    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = card.dataset.phenomenonType;
        const zone = card.dataset.phenomenonZone;
        const startDate = card.dataset.phenomenonStart;
        const endDate = card.dataset.phenomenonEnd;

        const currentlyExpanded = card.classList.contains("expanded");

        // Close any other expanded cards
        document.querySelectorAll(".phenomenon-card.expanded").forEach((c) => {
          c.classList.remove("expanded");
        });

        if (currentlyExpanded) {
          // Close this card
          this.expandedPhenomenon = null;
          if (detailPanel) {
            detailPanel.classList.add("hidden");
          }
          // Update URL
          this.clearPhenomenonFromURL();
        } else {
          // Expand this card
          card.classList.add("expanded");
          this.expandedPhenomenon = { type, zone, start_date: startDate, end_date: endDate };

          // Show detail panel
          this.showPhenomenonDetails(type, zone, startDate, endDate);

          // Update URL for deep linking
          this.updateURLForPhenomenon(type, zone, this.currentDate);
        }
      });
    });
  },

  /**
   * Close the phenomenon detail panel
   */
  closePhenomenonDetail() {
    this.expandedPhenomenon = null;
    document.querySelectorAll(".phenomenon-card.expanded").forEach((c) => {
      c.classList.remove("expanded");
    });
    const detailPanel = document.getElementById("phenomenon-detail-panel");
    if (detailPanel) {
      detailPanel.classList.add("hidden");
    }
    this.clearPhenomenonFromURL();
  },

  /**
   * Show detailed information for a phenomenon
   * @param {string} type - Phenomenon type
   * @param {string} zone - Zone name
   * @param {string} startDate - Start date
   * @param {string} endDate - End date (optional)
   */
  showPhenomenonDetails(type, zone, startDate, endDate) {
    const detailPanel = document.getElementById("phenomenon-detail-panel");
    const detailContent = document.getElementById("detail-panel-content");
    const titleEl = document.getElementById("detail-panel-title");

    if (!detailPanel || !detailContent) return;

    const config = this.phenomenonConfig[type];
    if (!config) return;

    titleEl.textContent = `${config.icon} ${config.label} - ${zone}`;

    // Build detail panel content
    let html = '<div class="detail-sections">';

    // Section 1: Summary info
    html += '<div class="detail-section summary-section">';
    html += "<h5>Yhteenveto</h5>";
    html += this.buildSummarySection(type, zone, startDate, endDate);
    html += "</div>";

    // Section 2: Temperature chart (show for all phenomena with duration)
    // Types with duration: _spell, _period, Hellejakso, pakkasjakso, Takatalvi, lämpeneminen
    const hasDuration = endDate ||
      type.includes("_spell") ||
      type.includes("_period") ||
      type.includes("jakso") ||  // Hellejakso, pakkasjakso
      type === "Takatalvi" ||
      type.includes("lämpeneminen");

    if (startDate && hasDuration) {
      html += '<div class="detail-section chart-section">';
      html += "<h5>Lämpötilakehitys</h5>";
      html += '<div id="phenomenon-temp-chart"></div>';
      html += "</div>";
    }

    // Section 3: Station measurements
    html += '<div class="detail-section stations-section">';
    html += "<h5>Asemamittaukset</h5>";
    html += '<div id="phenomenon-stations-list"></div>';
    html += "</div>";

    // Section 4: Description of how the phenomenon is calculated
    if (config.description) {
      html += '<div class="detail-section description-section">';
      html += "<h5>Miten ilmiö tunnistetaan?</h5>";
      html += `<p class="phenomenon-description">${config.description}</p>`;
      html += "</div>";
    }

    html += "</div>";

    detailContent.innerHTML = html;
    detailPanel.classList.remove("hidden");

    // Render temperature chart
    const effectiveEndDate = endDate || (startDate ? this.addDays(startDate, 0) : null);
    if (startDate) {
      this.renderTemperatureChart(zone, startDate, effectiveEndDate);
    }

    // Render station measurements
    this.renderStationMeasurements(zone);
  },

  /**
   * Build summary section HTML
   * @param {string} type - Phenomenon type
   * @param {string} zone - Zone name
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {string} HTML string
   */
  buildSummarySection(type, zone, startDate, endDate) {
    let html = '<div class="summary-grid">';

    if (startDate) {
      html += `<div class="summary-item">
        <span class="summary-label">Alkupäivä</span>
        <span class="summary-value">${this.formatShortDate(startDate)}</span>
      </div>`;
    }

    if (endDate && endDate !== startDate) {
      html += `<div class="summary-item">
        <span class="summary-label">Loppupäivä</span>
        <span class="summary-value">${this.formatShortDate(endDate)}</span>
      </div>`;

      // Calculate duration
      const duration = this.daysBetween(startDate, endDate) + 1;
      html += `<div class="summary-item">
        <span class="summary-label">Kesto</span>
        <span class="summary-value">${duration} päivää</span>
      </div>`;
    }

    html += "</div>";
    return html;
  },

  /**
   * Calculate days between two dates
   * @param {string} date1 - Start date
   * @param {string} date2 - End date
   * @returns {number} Number of days
   */
  daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Map zone display name to zone key used in zone summary data
   * @param {string} zoneName - Display name like "Etelä-Suomi"
   * @returns {string} Zone key like "etela_suomi"
   */
  getZoneKey(zoneName) {
    const zoneMap = {
      "Etelä-Suomi": "etela_suomi",
      "Keski-Suomi": "keski_suomi",
      "Pohjois-Suomi": "pohjois_suomi",
      "Lappi": "lappi",
    };
    return zoneMap[zoneName] || zoneName;
  },

  /**
   * Render temperature progression chart using D3
   * @param {string} zone - Zone name (display name like "Etelä-Suomi")
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   */
  renderTemperatureChart(zone, startDate, endDate) {
    const chartContainer = document.getElementById("phenomenon-temp-chart");
    if (!chartContainer) return;

    // Map zone name to zone key used in data
    const zoneKey = this.getZoneKey(zone);

    // Collect daily data for the period
    const dailyData = [];
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);

    // Extend range by a few days for context
    start.setDate(start.getDate() - 2);
    end.setDate(end.getDate() + 2);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const zoneData = DataLoader.getZoneData(dateStr, zoneKey);

      if (zoneData) {
        dailyData.push({
          date: new Date(dateStr),
          temp_mean: zoneData.temp_mean,
          temp_min: zoneData.temp_min,
          temp_max: zoneData.temp_max,
        });
      }
    }

    if (dailyData.length === 0) {
      chartContainer.innerHTML = '<p class="no-data">Ei lämpötiladataa saatavilla</p>';
      return;
    }

    // D3 chart rendering
    const margin = { top: 10, right: 30, bottom: 30, left: 40 };
    const width = chartContainer.clientWidth - margin.left - margin.right || 220;
    const height = 150 - margin.top - margin.bottom;

    // Clear previous chart
    d3.select(chartContainer).selectAll("*").remove();

    const svg = d3
      .select(chartContainer)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(dailyData, (d) => d.date))
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min(dailyData, (d) => d.temp_min) - 2,
        d3.max(dailyData, (d) => d.temp_max) + 2,
      ])
      .nice()
      .range([height, 0]);

    // Area between min and max
    const area = d3
      .area()
      .x((d) => x(d.date))
      .y0((d) => y(d.temp_min))
      .y1((d) => y(d.temp_max));

    svg
      .append("path")
      .datum(dailyData)
      .attr("fill", "rgba(52, 152, 219, 0.15)")
      .attr("d", area);

    // Lines
    const lineMax = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.temp_max));

    const lineMean = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.temp_mean));

    const lineMin = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.temp_min));

    svg
      .append("path")
      .datum(dailyData)
      .attr("fill", "none")
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 1.5)
      .attr("d", lineMax);

    svg
      .append("path")
      .datum(dailyData)
      .attr("fill", "none")
      .attr("stroke", "#3498db")
      .attr("stroke-width", 2)
      .attr("d", lineMean);

    svg
      .append("path")
      .datum(dailyData)
      .attr("fill", "none")
      .attr("stroke", "#2980b9")
      .attr("stroke-width", 1.5)
      .attr("d", lineMin);

    // Zero line
    if (y.domain()[0] < 0 && y.domain()[1] > 0) {
      svg
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#999")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 1);
    }

    // Axes
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.timeFormat("%d.%m")))
      .selectAll("text")
      .style("font-size", "9px");

    svg
      .append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .style("font-size", "9px");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width - 50}, 5)`);

    legend
      .append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 1.5);
    legend.append("text").attr("x", 18).attr("y", 4).attr("font-size", "8px").text("Max");

    legend
      .append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 12)
      .attr("y2", 12)
      .attr("stroke", "#3498db")
      .attr("stroke-width", 2);
    legend.append("text").attr("x", 18).attr("y", 16).attr("font-size", "8px").text("Ka.");

    legend
      .append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 24)
      .attr("y2", 24)
      .attr("stroke", "#2980b9")
      .attr("stroke-width", 1.5);
    legend.append("text").attr("x", 18).attr("y", 28).attr("font-size", "8px").text("Min");
  },

  /**
   * Render station measurements for the current date and zone
   * @param {string} zone - Zone name (display name like "Etelä-Suomi")
   */
  renderStationMeasurements(zone) {
    const stationsContainer = document.getElementById("phenomenon-stations-list");
    if (!stationsContainer) return;

    // Map zone name to zone key used in data
    const zoneKey = this.getZoneKey(zone);

    // Get station data for the current date
    const stationData = DataLoader.getStationDataForDate(this.currentDate);

    // Filter by zone (can match either zone key or zone_name)
    const zoneStations = stationData.filter((s) => s.zone === zoneKey || s.zone_name === zone);

    if (zoneStations.length === 0) {
      stationsContainer.innerHTML = '<p class="no-data">Ei asemadataa saatavilla</p>';
      return;
    }

    // Sort by temperature
    zoneStations.sort((a, b) => (a.temp_mean || 0) - (b.temp_mean || 0));

    // Build station list
    let html = '<div class="stations-grid">';

    zoneStations.forEach((station) => {
      const tempMax = station.temp_max !== null ? station.temp_max.toFixed(1) + "°C" : "-";
      const tempMean = station.temp_mean !== null ? station.temp_mean.toFixed(1) + "°C" : "-";
      const tempMin = station.temp_min !== null ? station.temp_min.toFixed(1) + "°C" : "-";

      html += `
        <div class="station-item">
          <div class="station-name">${station.station_name || station.name || "Tuntematon"}</div>
          <div class="station-temps">
            <span class="temp-max" title="Max">${tempMax}</span>
            <span class="temp-mean" title="Keskiarvo">${tempMean}</span>
            <span class="temp-min" title="Min">${tempMin}</span>
          </div>
        </div>
      `;
    });

    html += "</div>";
    stationsContainer.innerHTML = html;
  },

  /**
   * Update URL query parameters for deep linking
   * @param {string} type - Phenomenon type
   * @param {string} zone - Zone name
   * @param {string} date - Current date
   */
  updateURLForPhenomenon(type, zone, date) {
    const params = new URLSearchParams(window.location.search);
    params.set("date", date);
    params.set("phenomenon", type);
    params.set("zone", zone);

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newURL);
  },

  /**
   * Clear phenomenon parameters from URL
   */
  clearPhenomenonFromURL() {
    const params = new URLSearchParams(window.location.search);
    params.delete("phenomenon");
    params.delete("zone");

    const newURL = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.pushState({}, "", newURL);
  },

  /**
   * Parse URL parameters and restore state (for deep linking)
   */
  parseURLParameters() {
    const params = new URLSearchParams(window.location.search);

    const date = params.get("date");
    const phenomenon = params.get("phenomenon");
    const zone = params.get("zone");

    if (date && this.dates.includes(date)) {
      this.setDate(date);
    }

    if (phenomenon && zone) {
      // Wait for UI to render, then expand the phenomenon
      setTimeout(() => {
        const card = document.querySelector(
          `.phenomenon-card[data-phenomenon-type="${phenomenon}"][data-phenomenon-zone="${zone}"]`
        );
        if (card) {
          card.click();
        }
      }, 100);
    }
  },

  /**
   * Format date as Finnish format with year (d.m.yyyy)
   */
  formatShortDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  },

  /**
   * Format date for display in Finnish format (d.m.yyyy)
   */
  formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  },

  /**
   * Add days to a date string
   */
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  },

  /**
   * Format date for display
   * @param {string} date - Date string
   * @returns {string} Formatted date
   */
  formatDate(date) {
    const d = new Date(date);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return d.toLocaleDateString("fi-FI", options);
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
    const playButton = document.getElementById("btn-play");
    if (playButton) {
      playButton.textContent = this.isPlaying ? "⏸" : "▶";
      playButton.classList.toggle("playing", this.isPlaying);
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
  },
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = TimelineController;
}
