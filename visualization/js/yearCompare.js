/**
 * yearCompare.js
 * Renders stacked year timeline comparison view (calendar year: Jan-Dec)
 */

const YearCompare = {
  // Configuration
  selectedZone: "Etelä-Suomi",
  rowHeight: 28,
  zoneRowHeight: 22,
  labelWidth: 80,

  // Month names for labels
  monthNames: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],

  // Anomaly colors (same as timeline)
  anomalyColors: {
    "Äärimmäinen kylmyys": "#2171b5",
    "Ankara pakkasjakso": "#6baed6",
    Hellejakso: "#de2d26",
    Takatalvi: "#756bb1",
    "Äkillinen lämpeneminen": "#fdae6b",
  },

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
    extremeCold: true,
    coldSnap: true,
    heatWave: true,
    returnWinter: true,
    tempJump: true,
  },

  /**
   * Initialize the year comparison view
   */
  initialize() {
    this.attachEventHandlers();
  },

  /**
   * Attach event handlers for controls
   */
  attachEventHandlers() {
    const zoneSelector = document.getElementById("zone-selector");

    if (zoneSelector) {
      zoneSelector.addEventListener("change", (e) => {
        this.selectedZone = e.target.value;
        this.render();
      });
    }

    // Attach legend toggle handlers
    this.attachLegendToggles();
  },

  /**
   * Attach click handlers to legend items for toggling visibility
   */
  attachLegendToggles() {
    const legendContainer = document.querySelector("#compare-controls .compare-legend-inline");
    if (!legendContainer) return;

    const legendItems = legendContainer.querySelectorAll(".legend-item");

    legendItems.forEach((item) => {
      // Make legend items clickable
      item.style.cursor = "pointer";
      item.style.userSelect = "none";

      // Determine which visibility key this legend item controls
      let visKey = null;
      if (item.querySelector(".cold-spell-icon")) visKey = "coldSpell";
      else if (item.querySelector(".warm-spell-icon")) visKey = "warmSpell";
      else if (item.querySelector(".winter-start-icon")) visKey = "winterStart";
      else if (item.querySelector(".winter-end-icon")) visKey = "winterEnd";
      else if (item.querySelector(".slippery-start-icon")) visKey = "slipperyStart";
      else if (item.querySelector(".slippery-bar-icon")) visKey = "slipperyBar";
      else if (item.querySelector(".frost-marker-icon")) visKey = "frostMarker";
      else if (item.querySelector(".frost-bar-icon")) visKey = "frostBar";
      else if (item.querySelector(".anomaly-icon.extreme-cold")) visKey = "extremeCold";
      else if (item.querySelector(".anomaly-icon.cold-snap")) visKey = "coldSnap";
      else if (item.querySelector(".anomaly-icon.heat-wave")) visKey = "heatWave";
      else if (item.querySelector(".anomaly-icon.return-winter")) visKey = "returnWinter";
      else if (item.querySelector(".anomaly-icon.temp-jump")) visKey = "tempJump";

      if (visKey) {
        item.addEventListener("click", () => {
          // Toggle visibility
          this.visibility[visKey] = !this.visibility[visKey];

          // Update visual state
          if (this.visibility[visKey]) {
            item.classList.remove("legend-disabled");
          } else {
            item.classList.add("legend-disabled");
          }

          // Re-render timeline
          this.render();
        });
      }
    });
  },

  /**
   * Render the year comparison timeline
   */
  render() {
    const container = document.getElementById("years-timeline");
    if (!container) return;

    // Get data
    const winterData = DataLoader.data.winterStarts || [];
    const anomalies = DataLoader.data.anomalies || [];

    if (winterData.length === 0 && anomalies.length === 0) {
      container.innerHTML =
        '<div style="padding: 2rem; color: #666;">No data available</div>';
      return;
    }

    // Get unique years from data
    const years = this.getYears(winterData, anomalies);

    // Build HTML
    container.innerHTML = "";

    // Create header with month labels
    const header = this.createHeader();
    container.appendChild(header);

    // Create rows for each year
    years.forEach((year) => {
      if (this.selectedZone === "all") {
        // Show all zones stacked within each year
        const yearGroup = this.createYearGroupWithZones(
          year,
          winterData,
          anomalies
        );
        container.appendChild(yearGroup);
      } else {
        // Show single zone per row
        const row = this.createYearRow(
          year,
          this.selectedZone,
          winterData,
          anomalies
        );
        container.appendChild(row);
      }
    });
  },

  /**
   * Get list of years from data
   */
  getYears(winterData, anomalies) {
    const yearSet = new Set();

    // Get years from winter data
    winterData.forEach((w) => {
      if (w.season) {
        // Parse season like "2022/2023" or "2022-2023" -> add both years
        const parts = w.season.split(/[-\/]/);
        parts.forEach((p) => {
          const y = parseInt(p);
          if (!isNaN(y) && y > 2000 && y < 2100) yearSet.add(y);
        });
      }
    });

    // Also extract years from anomalies
    anomalies.forEach((a) => {
      const date = a.start_date || a.date;
      if (date) {
        const year = new Date(date).getFullYear();
        if (!isNaN(year) && year > 2000 && year < 2100) yearSet.add(year);
      }
    });

    // Sort years (oldest first - ascending order)
    return Array.from(yearSet).sort((a, b) => a - b);
  },

  /**
   * Create header row with month labels
   */
  createHeader() {
    const header = document.createElement("div");
    header.className = "year-row header";

    const label = document.createElement("div");
    label.className = "year-label";
    label.textContent = "Year";
    header.appendChild(label);

    const chartContainer = document.createElement("div");
    chartContainer.className = "year-timeline-chart";

    // Create SVG for month labels
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "28");
    svg.style.display = "block";

    chartContainer.appendChild(svg);
    header.appendChild(chartContainer);

    // Draw month labels after DOM render
    requestAnimationFrame(() => {
      this.drawMonthLabels(svg);
    });

    return header;
  },

  /**
   * Draw month labels on header SVG
   */
  drawMonthLabels(svg) {
    const width = svg.clientWidth || svg.parentElement.clientWidth;
    if (width === 0) return;

    const monthWidth = width / 12;

    // Calendar months Jan-Dec
    for (let i = 0; i < 12; i++) {
      // Month label
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("x", i * monthWidth + monthWidth / 2);
      text.setAttribute("y", 18);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("class", "month-label");
      text.textContent = this.monthNames[i];
      svg.appendChild(text);

      // Grid line
      if (i > 0) {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line.setAttribute("x1", i * monthWidth);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", i * monthWidth);
        line.setAttribute("y2", 28);
        line.setAttribute("class", "month-grid-line");
        svg.appendChild(line);
      }
    }
  },

  /**
   * Create a year row for single zone view
   */
  createYearRow(year, zone, winterData, anomalies) {
    const row = document.createElement("div");
    row.className = "year-row";

    const label = document.createElement("div");
    label.className = "year-label";
    label.textContent = year;
    row.appendChild(label);

    const chartContainer = document.createElement("div");
    chartContainer.className = "year-timeline-chart";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", this.rowHeight);
    svg.style.display = "block";

    chartContainer.appendChild(svg);
    row.appendChild(chartContainer);

    // Draw data after DOM render
    requestAnimationFrame(() => {
      this.drawYearData(svg, year, zone, winterData, anomalies, this.rowHeight);
    });

    return row;
  },

  /**
   * Create year group with all zones
   */
  createYearGroupWithZones(year, winterData, anomalies) {
    const zones = ["Etelä-Suomi", "Keski-Suomi", "Pohjois-Suomi", "Lappi"];

    const group = document.createElement("div");
    group.className = "year-group";

    zones.forEach((zone, zoneIndex) => {
      const row = document.createElement("div");
      row.className = "zone-row";

      const label = document.createElement("div");
      label.className = "zone-label-small";
      // Show year label only on first zone
      if (zoneIndex === 0) {
        label.innerHTML = `<strong>${year}</strong> ${zone}`;
        label.style.paddingLeft = "8px";
      } else {
        label.textContent = zone;
      }
      row.appendChild(label);

      const chartContainer = document.createElement("div");
      chartContainer.className = "zone-timeline-chart";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", this.zoneRowHeight);
      svg.style.display = "block";

      chartContainer.appendChild(svg);
      row.appendChild(chartContainer);

      // Draw data after DOM render
      requestAnimationFrame(() => {
        this.drawYearData(
          svg,
          year,
          zone,
          winterData,
          anomalies,
          this.zoneRowHeight
        );
      });

      group.appendChild(row);
    });

    return group;
  },

  /**
   * Draw year data (winter periods, anomalies) on SVG
   */
  drawYearData(svg, year, zone, winterData, anomalies, height) {
    const width = svg.clientWidth || svg.parentElement.clientWidth;
    if (width === 0) return;

    const monthWidth = width / 12;

    // Year date range (calendar year)
    const yearStart = new Date(year, 0, 1); // Jan 1
    const yearEnd = new Date(year, 11, 31, 23, 59, 59); // Dec 31
    const yearMs = yearEnd - yearStart;

    // Draw month grid lines
    for (let i = 1; i < 12; i++) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", i * monthWidth);
      line.setAttribute("y1", 0);
      line.setAttribute("x2", i * monthWidth);
      line.setAttribute("y2", height);
      line.setAttribute("class", "month-grid-line");
      svg.appendChild(line);
    }

    // Find winter data that overlaps this year and zone
    // Winter seasons span two years, so check both "year-1 / year" and "year / year+1"
    const relevantWinters = winterData.filter((w) => {
      if (w.zone !== zone) return false;
      if (!w.season) return false;
      const parts = w.season.split(/[-\/]/);
      const startYear = parseInt(parts[0]);
      const endYear = parseInt(parts[1]);
      // Check if this winter overlaps with our calendar year
      return startYear === year || endYear === year;
    });

    // Draw cold spells and warm spells from winter data
    relevantWinters.forEach((winter) => {
      // Draw cold spells
      if (this.visibility.coldSpell && winter.cold_spells) {
        winter.cold_spells.forEach((spell) => {
          const spellStart = new Date(spell.start);
          const spellEnd = new Date(spell.end);

          // Check if spell overlaps with this year
          if (spellEnd < yearStart || spellStart > yearEnd) return;

          // Clip to year boundaries
          const drawStart = spellStart < yearStart ? yearStart : spellStart;
          const drawEnd = spellEnd > yearEnd ? yearEnd : spellEnd;

          const x1 = this.dateToX(drawStart, yearStart, yearMs, width);
          const x2 = this.dateToX(drawEnd, yearStart, yearMs, width);

          if (x1 !== null && x2 !== null) {
            const rect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            rect.setAttribute("x", Math.max(0, x1));
            rect.setAttribute("y", 1);
            rect.setAttribute(
              "width",
              Math.max(2, Math.min(width - x1, x2 - x1))
            );
            rect.setAttribute("height", height - 2);
            rect.setAttribute("class", "season-bar cold-spell");

            // Tooltip
            rect.addEventListener("mouseenter", (e) => {
              this.showSpellTooltip(e, spell, winter, "cold");
            });
            rect.addEventListener("mouseleave", () => this.hideTooltip());

            svg.appendChild(rect);
          }
        });
      }

      // Draw warm spells (interruptions)
      if (this.visibility.warmSpell && winter.warm_spells) {
        winter.warm_spells.forEach((spell) => {
          const spellStart = new Date(spell.start);
          const spellEnd = new Date(spell.end);

          if (spellEnd < yearStart || spellStart > yearEnd) return;

          const drawStart = spellStart < yearStart ? yearStart : spellStart;
          const drawEnd = spellEnd > yearEnd ? yearEnd : spellEnd;

          const x1 = this.dateToX(drawStart, yearStart, yearMs, width);
          const x2 = this.dateToX(drawEnd, yearStart, yearMs, width);

          if (x1 !== null && x2 !== null) {
            const rect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            rect.setAttribute("x", Math.max(0, x1));
            rect.setAttribute("y", height * 0.25);
            rect.setAttribute(
              "width",
              Math.max(2, Math.min(width - x1, x2 - x1))
            );
            rect.setAttribute("height", height * 0.5);
            rect.setAttribute("class", "season-bar warm-spell");

            rect.addEventListener("mouseenter", (e) => {
              this.showSpellTooltip(e, spell, winter, "warm");
            });
            rect.addEventListener("mouseleave", () => this.hideTooltip());

            svg.appendChild(rect);
          }
        });
      }

      // Draw winter start marker
      if (this.visibility.winterStart && winter.season_start) {
        const startDate = new Date(winter.season_start);
        if (startDate >= yearStart && startDate <= yearEnd) {
          const x = this.dateToX(startDate, yearStart, yearMs, width);
          if (x !== null && x >= 0 && x <= width) {
            const line = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line"
            );
            line.setAttribute("x1", x);
            line.setAttribute("y1", 0);
            line.setAttribute("x2", x);
            line.setAttribute("y2", height);
            line.setAttribute("class", "winter-marker start");
            svg.appendChild(line);

            // Add hover area for better mouse targeting
            const hoverRect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            hoverRect.setAttribute("x", x - 8);
            hoverRect.setAttribute("y", 0);
            hoverRect.setAttribute("width", 16);
            hoverRect.setAttribute("height", height);
            hoverRect.setAttribute("fill", "transparent");
            hoverRect.setAttribute("class", "line-hover-area");
            hoverRect.style.cursor = "pointer";
            hoverRect.addEventListener("mouseenter", (e) => {
              this.showWinterTooltip(e, winter, "start");
              line.style.strokeWidth = "3";
            });
            hoverRect.addEventListener("mouseleave", () => {
              this.hideTooltip();
              line.style.strokeWidth = "2";
            });
            svg.appendChild(hoverRect);
          }
        }
      }

      // Draw winter end marker
      if (this.visibility.winterEnd && winter.season_end) {
        const endDate = new Date(winter.season_end);
        if (endDate >= yearStart && endDate <= yearEnd) {
          const x = this.dateToX(endDate, yearStart, yearMs, width);
          if (x !== null && x >= 0 && x <= width) {
            const line = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line"
            );
            line.setAttribute("x1", x);
            line.setAttribute("y1", 0);
            line.setAttribute("x2", x);
            line.setAttribute("y2", height);
            line.setAttribute("class", "winter-marker end");
            svg.appendChild(line);

            // Add hover area for better mouse targeting
            const hoverRect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            hoverRect.setAttribute("x", x - 8);
            hoverRect.setAttribute("y", 0);
            hoverRect.setAttribute("width", 16);
            hoverRect.setAttribute("height", height);
            hoverRect.setAttribute("fill", "transparent");
            hoverRect.setAttribute("class", "line-hover-area");
            hoverRect.style.cursor = "pointer";
            hoverRect.addEventListener("mouseenter", (e) => {
              this.showWinterTooltip(e, winter, "end");
              line.style.strokeWidth = "3";
            });
            hoverRect.addEventListener("mouseleave", () => {
              this.hideTooltip();
              line.style.strokeWidth = "2";
            });
            svg.appendChild(hoverRect);
          }
        }
      }
    });

    // Draw slippery risk periods for this zone and year
    const slipperyData = DataLoader.data.slipperyRisk || [];
    const relevantSlippery = slipperyData.filter(
      (r) => r.zone === zone && r.year === year
    );

    relevantSlippery.forEach((risk) => {
      // Draw season start marker
      if (this.visibility.slipperyStart && risk.season_start) {
        const seasonStart = new Date(risk.season_start);
        if (seasonStart >= yearStart && seasonStart <= yearEnd) {
          const x = this.dateToX(seasonStart, yearStart, yearMs, width);
          if (x !== null && x >= 0 && x <= width) {
            const line = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line"
            );
            line.setAttribute("x1", x);
            line.setAttribute("y1", 0);
            line.setAttribute("x2", x);
            line.setAttribute("y2", height);
            line.setAttribute("stroke", "#ff9800");
            line.setAttribute("stroke-width", "2");
            line.setAttribute("stroke-dasharray", "4,2");
            line.setAttribute("class", "slippery-marker start");
            svg.appendChild(line);

            // Add hover area for better mouse targeting
            const hoverRect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            hoverRect.setAttribute("x", x - 8);
            hoverRect.setAttribute("y", 0);
            hoverRect.setAttribute("width", 16);
            hoverRect.setAttribute("height", height);
            hoverRect.setAttribute("fill", "transparent");
            hoverRect.setAttribute("class", "line-hover-area");
            hoverRect.style.cursor = "pointer";
            hoverRect.addEventListener("mouseenter", (e) => {
              this.showSlipperySeasonTooltip(e, risk);
              line.style.strokeWidth = "3";
            });
            hoverRect.addEventListener("mouseleave", () => {
              this.hideTooltip();
              line.style.strokeWidth = "2";
            });
            svg.appendChild(hoverRect);
          }
        }
      }

      // Draw slippery periods
      if (this.visibility.slipperyBar && risk.slippery_periods) {
        risk.slippery_periods.forEach((period) => {
          const periodStart = new Date(period.start);
          const periodEnd = new Date(period.end);

          if (periodEnd < yearStart || periodStart > yearEnd) return;

          const drawStart = periodStart < yearStart ? yearStart : periodStart;
          const drawEnd = periodEnd > yearEnd ? yearEnd : periodEnd;

          const x1 = this.dateToX(drawStart, yearStart, yearMs, width);
          const x2 = this.dateToX(drawEnd, yearStart, yearMs, width);

          if (x1 !== null && x2 !== null) {
            const isHighRisk = period.high_risk_days > 0;

            const rect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            rect.setAttribute("x", Math.max(0, x1));
            rect.setAttribute("y", height * 0.7);
            rect.setAttribute(
              "width",
              Math.max(2, Math.min(width - x1, x2 - x1))
            );
            rect.setAttribute("height", height * 0.25);
            rect.setAttribute("class", "slippery-bar");
            rect.setAttribute(
              "fill",
              isHighRisk ? "rgba(255, 152, 0, 0.8)" : "rgba(255, 193, 7, 0.6)"
            );
            rect.setAttribute("stroke", isHighRisk ? "#e65100" : "#f9a825");
            rect.setAttribute("stroke-width", "0.5");

            // Tooltip
            rect.addEventListener("mouseenter", (e) => {
              this.showSlipperyTooltip(e, period, risk);
            });
            rect.addEventListener("mouseleave", () => this.hideTooltip());

            svg.appendChild(rect);
          }
        });
      }
    });

    // Draw first frost data for this zone and year
    const frostData = DataLoader.data.firstFrost || [];
    const relevantFrost = frostData.filter(
      (f) => f.zone === zone && f.year === year
    );

    relevantFrost.forEach((frost) => {
      // Draw first frost marker line
      if (this.visibility.frostMarker && frost.first_frost_date) {
        const frostDate = new Date(frost.first_frost_date);
        if (frostDate >= yearStart && frostDate <= yearEnd) {
          const x = this.dateToX(frostDate, yearStart, yearMs, width);
          if (x !== null && x >= 0 && x <= width) {
            const line = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line"
            );
            line.setAttribute("x1", x);
            line.setAttribute("y1", 0);
            line.setAttribute("x2", x);
            line.setAttribute("y2", height);
            line.setAttribute("stroke", "#00bcd4");
            line.setAttribute("stroke-width", "2");
            line.setAttribute("stroke-dasharray", "4,2");
            line.setAttribute("class", "frost-marker start");
            svg.appendChild(line);

            // Add hover area for better mouse targeting
            const hoverRect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            hoverRect.setAttribute("x", x - 8);
            hoverRect.setAttribute("y", 0);
            hoverRect.setAttribute("width", 16);
            hoverRect.setAttribute("height", height);
            hoverRect.setAttribute("fill", "transparent");
            hoverRect.setAttribute("class", "line-hover-area");
            hoverRect.style.cursor = "pointer";
            hoverRect.addEventListener("mouseenter", (e) => {
              this.showFrostTooltip(e, frost, null);
              line.style.strokeWidth = "3";
            });
            hoverRect.addEventListener("mouseleave", () => {
              this.hideTooltip();
              line.style.strokeWidth = "2";
            });
            svg.appendChild(hoverRect);
          }
        }
      }

      // Draw frost periods
      if (this.visibility.frostBar && frost.frost_periods) {
        frost.frost_periods.forEach((period) => {
          const periodStart = new Date(period.start);
          const periodEnd = new Date(period.end);

          if (periodEnd < yearStart || periodStart > yearEnd) return;

          const drawStart = periodStart < yearStart ? yearStart : periodStart;
          const drawEnd = periodEnd > yearEnd ? yearEnd : periodEnd;

          const x1 = this.dateToX(drawStart, yearStart, yearMs, width);
          const x2 = this.dateToX(drawEnd, yearStart, yearMs, width);

          if (x1 !== null && x2 !== null) {
            const rect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            rect.setAttribute("x", Math.max(0, x1));
            rect.setAttribute("y", height * 0.45);
            rect.setAttribute(
              "width",
              Math.max(2, Math.min(width - x1, x2 - x1))
            );
            rect.setAttribute("height", height * 0.2);
            rect.setAttribute("class", "frost-bar");
            rect.setAttribute("fill", "rgba(0, 188, 212, 0.5)");
            rect.setAttribute("stroke", "rgba(0, 188, 212, 0.8)");
            rect.setAttribute("stroke-width", "0.5");

            // Tooltip
            rect.addEventListener("mouseenter", (e) => {
              this.showFrostTooltip(e, frost, period);
            });
            rect.addEventListener("mouseleave", () => this.hideTooltip());

            svg.appendChild(rect);
          }
        });
      }
    });

    // Draw anomalies for this zone and year
    const yearAnomalies = anomalies.filter((a) => {
      if (a.zone !== zone) return false;

      const date = a.start_date || a.date;
      if (!date) return false;

      const d = new Date(date);
      return d >= yearStart && d <= yearEnd;
    });

    yearAnomalies.forEach((anomaly) => {
      // Check visibility for this anomaly type
      let isVisible = false;
      if (anomaly.type === "Äärimmäinen kylmyys") isVisible = this.visibility.extremeCold;
      else if (anomaly.type === "Ankara pakkasjakso") isVisible = this.visibility.coldSnap;
      else if (anomaly.type === "Hellejakso") isVisible = this.visibility.heatWave;
      else if (anomaly.type === "Takatalvi") isVisible = this.visibility.returnWinter;
      else if (anomaly.type === "Äkillinen lämpeneminen") isVisible = this.visibility.tempJump;

      if (!isVisible) return;

      const startDate = new Date(anomaly.start_date || anomaly.date);
      const duration = anomaly.duration_days || 1;
      const endDate = new Date(
        startDate.getTime() + duration * 24 * 60 * 60 * 1000
      );

      // Clip to year
      const drawStart = startDate < yearStart ? yearStart : startDate;
      const drawEnd = endDate > yearEnd ? yearEnd : endDate;

      const x1 = this.dateToX(drawStart, yearStart, yearMs, width);
      const x2 = this.dateToX(drawEnd, yearStart, yearMs, width);

      if (x1 === null) return;

      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      rect.setAttribute("x", Math.max(0, x1));
      rect.setAttribute("y", 2);
      rect.setAttribute("width", Math.max(3, (x2 || x1 + 5) - x1));
      rect.setAttribute("height", height - 4);
      rect.setAttribute("fill", this.anomalyColors[anomaly.type] || "#999");
      rect.setAttribute("class", "compare-anomaly-bar");
      rect.setAttribute("stroke", this.anomalyColors[anomaly.type] || "#999");
      rect.setAttribute("stroke-width", "1");

      // Add tooltip on hover
      rect.addEventListener("mouseenter", (e) => {
        this.showAnomalyTooltip(e, anomaly);
      });
      rect.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });

      svg.appendChild(rect);
    });
  },

  /**
   * Convert date to X position within year
   */
  dateToX(date, yearStart, yearMs, width) {
    if (!date) return null;

    const d = date instanceof Date ? date : new Date(date);
    const offsetMs = d - yearStart;

    if (offsetMs < 0 || offsetMs > yearMs) return null;

    return (offsetMs / yearMs) * width;
  },

  /**
   * Show winter start/end tooltip
   */
  showWinterTooltip(event, winter, type) {
    let tooltip = document.getElementById("compare-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "compare-tooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        max-width: 280px;
      `;
      document.body.appendChild(tooltip);
    }

    const date = type === "start" ? winter.season_start : winter.season_end;
    const label = type === "start" ? "❄️ Talvi alkaa" : "🌱 Talvi päättyy";

    let html = `<div style="color: #6baed6;">
      <strong>${label}</strong>
    </div>
    <div style="margin-top: 4px;">
      ${winter.zone} • ${winter.season}<br>
      ${date}
    </div>`;

    tooltip.innerHTML = html;
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.style.display = "block";
  },

  /**
   * Show slippery season start tooltip
   */
  showSlipperySeasonTooltip(event, risk) {
    let tooltip = document.getElementById("compare-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "compare-tooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        max-width: 280px;
      `;
      document.body.appendChild(tooltip);
    }

    let html = `<div style="color: #ff9800;">
      <strong>⚠️ Liukkauskausi alkaa</strong>
    </div>
    <div style="margin-top: 4px;">
      ${risk.zone} • Syksy ${risk.year}<br>
      ${risk.season_start}<br>
      Riskipäiviä yhteensä: ${risk.risk_days_total}
    </div>`;

    tooltip.innerHTML = html;
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.style.display = "block";
  },

  /**
   * Show tooltip for cold/warm spell
   */
  showSpellTooltip(event, spell, winter, type) {
    let tooltip = document.getElementById("compare-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "compare-tooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        max-width: 280px;
      `;
      document.body.appendChild(tooltip);
    }

    let html = "";
    const minTemp =
      spell.min_temp !== undefined &&
      spell.min_temp !== null &&
      !isNaN(spell.min_temp)
        ? spell.min_temp.toFixed(1)
        : "-";
    const maxTemp =
      spell.max_temp !== undefined &&
      spell.max_temp !== null &&
      !isNaN(spell.max_temp)
        ? spell.max_temp.toFixed(1)
        : "-";
    const duration = spell.duration || "-";

    if (type === "cold") {
      html = `<div style="color: #6baed6;">
        <strong>❄️ Pakkasjakso</strong>
      </div>
      <div style="margin-top: 4px;">
        ${winter.zone} • ${winter.season}<br>
        ${spell.start || "-"} → ${spell.end || "-"}<br>
        Kesto: ${duration} pv<br>
        Kylmin: ${minTemp}°C
      </div>`;
    } else {
      html = `<div style="color: #fdae6b;">
        <strong>☀️ Lämpökatko</strong>
      </div>
      <div style="margin-top: 4px;">
        ${winter.zone} • ${winter.season}<br>
        ${spell.start || "-"} → ${spell.end || "-"}<br>
        Kesto: ${duration} pv<br>
        Lämpimin: ${maxTemp}°C
      </div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.style.display = "block";
  },

  /**
   * Show anomaly tooltip
   */
  showAnomalyTooltip(event, anomaly) {
    let tooltip = document.getElementById("compare-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "compare-tooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        max-width: 280px;
      `;
      document.body.appendChild(tooltip);
    }

    const startDate = anomaly.start_date || anomaly.date || "-";
    const color = this.anomalyColors[anomaly.type] || "#999";
    const anomalyType = anomaly.type || "Tuntematon";
    const zone = anomaly.zone || "-";

    let html = `<div style="color: ${color};">
      <strong>${anomalyType}</strong>
    </div>
    <div style="margin-top: 4px;">
      ${zone}<br>
      ${startDate}`;

    if (anomaly.duration_days && anomaly.duration_days > 1) {
      html += ` (${anomaly.duration_days} pv)`;
    }
    if (
      anomaly.min_temperature !== null &&
      anomaly.min_temperature !== undefined &&
      !isNaN(anomaly.min_temperature)
    ) {
      html += `<br>Min: ${anomaly.min_temperature.toFixed(1)}°C`;
    }
    if (
      anomaly.max_temperature !== null &&
      anomaly.max_temperature !== undefined &&
      !isNaN(anomaly.max_temperature)
    ) {
      html += `<br>Max: ${anomaly.max_temperature.toFixed(1)}°C`;
    }

    html += "</div>";

    tooltip.innerHTML = html;
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.style.display = "block";
  },

  /**
   * Show slippery risk tooltip
   */
  showSlipperyTooltip(event, period, risk) {
    let tooltip = document.getElementById("compare-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "compare-tooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        max-width: 280px;
      `;
      document.body.appendChild(tooltip);
    }

    const isHighRisk = period.high_risk_days > 0;
    const avgMin =
      period.avg_min_temp !== null && period.avg_min_temp !== undefined
        ? period.avg_min_temp.toFixed(1)
        : "-";
    const avgMax =
      period.avg_max_temp !== null && period.avg_max_temp !== undefined
        ? period.avg_max_temp.toFixed(1)
        : "-";

    let html = `<div style="color: ${isHighRisk ? "#ff9800" : "#ffc107"};">
      <strong>⚠️ Liukkausriski</strong>
    </div>
    <div style="margin-top: 4px;">
      ${risk.zone} • Syksy ${risk.year}<br>
      ${period.start} → ${period.end}<br>
      Kesto: ${period.duration} pv<br>
      ${isHighRisk ? `Korkea riski: ${period.high_risk_days} pv<br>` : ""}
      Yölämpötila: ${avgMin}°C / Päivä: ${avgMax}°C
    </div>
    <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
      Kausi alkoi: ${risk.season_start}<br>
      Riskipäiviä: ${risk.risk_days_total}
    </div>`;

    tooltip.innerHTML = html;
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.style.display = "block";
  },

  /**
   * Show first frost tooltip
   */
  showFrostTooltip(event, frost, period) {
    let tooltip = document.getElementById("compare-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "compare-tooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        max-width: 280px;
      `;
      document.body.appendChild(tooltip);
    }

    let html = "";

    if (period) {
      // Frost period tooltip
      const minTemp =
        period.min_temp !== null && period.min_temp !== undefined
          ? period.min_temp.toFixed(1)
          : "-";
      const avgMinTemp =
        period.avg_min_temp !== null && period.avg_min_temp !== undefined
          ? period.avg_min_temp.toFixed(1)
          : "-";

      html = `<div style="color: #00bcd4;">
        <strong>🥶 Nollaraja alittuu</strong>
      </div>
      <div style="margin-top: 4px;">
        ${frost.zone} • Syksy ${frost.year}<br>
        ${period.start} → ${period.end}<br>
        Kesto: ${period.duration} pv<br>
        Kylmin yölämpötila: ${minTemp}°C<br>
        Keskiarvo: ${avgMinTemp}°C
      </div>`;
    } else {
      // First frost marker tooltip
      const firstFrostTemp =
        frost.first_frost_temp !== null && frost.first_frost_temp !== undefined
          ? frost.first_frost_temp.toFixed(1)
          : "-";
      const avgFrostTemp =
        frost.avg_frost_temp !== null && frost.avg_frost_temp !== undefined
          ? frost.avg_frost_temp.toFixed(1)
          : "-";
      const coldestTemp =
        frost.coldest_temp !== null && frost.coldest_temp !== undefined
          ? frost.coldest_temp.toFixed(1)
          : "-";

      html = `<div style="color: #00bcd4;">
        <strong>🌡️ Ensimmäinen yöpakkanen</strong>
      </div>
      <div style="margin-top: 4px;">
        ${frost.zone} • Syksy ${frost.year}<br>
        ${frost.first_frost_date}<br>
        Lämpötila: ${firstFrostTemp}°C
      </div>
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #444; font-size: 11px; color: #aaa;">
        Pakkasöitä syksyllä: ${frost.frost_nights_total}<br>
        Keskiarvo: ${avgFrostTemp}°C<br>
        Kylmin yö: ${coldestTemp}°C
      </div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.style.display = "block";
  },

  /**
   * Hide tooltip
   */
  hideTooltip() {
    const tooltip = document.getElementById("compare-tooltip");
    if (tooltip) {
      tooltip.style.display = "none";
    }
  },
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = YearCompare;
}
