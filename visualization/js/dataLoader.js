/**
 * Data loading module
 * Handles loading and parsing of all JSON data files
 */

const DataLoader = {
  // Data storage
  data: {
    zoneSummary: null, // Daily zone summaries (for statistics)
    stationData: null, // Daily station data (individual measurements)
    stations: null, // Station locations
    anomalies: null, // Anomaly events
    winterStarts: null, // Winter progression
    slipperyRisk: null, // Slippery road risk data
    firstFrost: null, // First frost data
    firstSnow: null, // First snow data (ensilumi)
    precomputedGrids: null, // Pre-computed IDW grids
  },

  /**
   * Accessors used by Data Management status card
   */
  getZoneSummary() {
    return this.data.zoneSummary || [];
  },

  getStations() {
    return this.data.stations || [];
  },

  getStationData() {
    return this.data.stationData || [];
  },

  // Loading state
  loading: {
    zoneSummary: false,
    stationData: false,
    stations: false,
    anomalies: false,
    winterStarts: false,
    slipperyRisk: false,
    firstFrost: false,
    firstSnow: false,
    precomputedGrids: false,
  },

  // Loaded flags
  loaded: {
    zoneSummary: false,
    stationData: false,
    stations: false,
    anomalies: false,
    winterStarts: false,
    slipperyRisk: false,
    firstFrost: false,
    firstSnow: false,
    precomputedGrids: false,
  },

  /**
   * Load all essential data files
   * @returns {Promise} Resolves when all data is loaded
   */
  async loadAll() {
    console.log("Loading all data files...");

    try {
      // Load in parallel for speed
      const [
        zoneSummary,
        stationData,
        stations,
        anomalies,
        winterStarts,
        slipperyRisk,
        firstFrost,
        firstSnow,
      ] = await Promise.all([
        this.loadZoneSummary(),
        this.loadStationData(),
        this.loadStations(),
        this.loadAnomalies(),
        this.loadWinterStarts(),
        this.loadSlipperyRisk(),
        this.loadFirstFrost(),
        this.loadFirstSnow(),
      ]);

      console.log("Essential data loaded successfully");
      console.log("- Zone summaries:", zoneSummary.length, "records");
      console.log("- Station data:", stationData.length, "records");
      console.log("- Stations:", stations.length, "locations");
      console.log("- Anomalies:", anomalies.length, "events");
      console.log("- Winter seasons:", winterStarts.length, "records");
      console.log("- Slippery risk:", slipperyRisk.length, "records");
      console.log("- First frost:", firstFrost.length, "records");
      console.log("- First snow:", firstSnow.length, "records");

      // Load precomputed grids in background (not blocking)
      this.loadPrecomputedGrids().catch((err) => {
        console.warn(
          "Could not load precomputed grids (will use real-time interpolation):",
          err.message
        );
      });

      return {
        zoneSummary,
        stationData,
        stations,
        anomalies,
        winterStarts,
        slipperyRisk,
        firstFrost,
        firstSnow,
      };
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  },

  /**
   * Load zone-daily summary data
   * @returns {Promise<Array>} Zone summary records
   */
  async loadZoneSummary() {
    if (this.loaded.zoneSummary) return this.data.zoneSummary;

    this.loading.zoneSummary = true;

    try {
      // Try gzipped version first
      const data = await this.fetchJSON("data/daily_zone_summary.json");
      this.data.zoneSummary = data;
      this.loaded.zoneSummary = true;
      return data;
    } finally {
      this.loading.zoneSummary = false;
    }
  },

  /**
   * Load station-daily data (individual station measurements)
   * @returns {Promise<Array>} Station data records
   */
  async loadStationData() {
    if (this.loaded.stationData) return this.data.stationData;

    this.loading.stationData = true;

    try {
      const data = await this.fetchJSON("data/daily_station_data.json");
      this.data.stationData = data;
      this.loaded.stationData = true;
      return data;
    } finally {
      this.loading.stationData = false;
    }
  },

  /**
   * Load station locations
   * @returns {Promise<Array>} Station records
   */
  async loadStations() {
    if (this.loaded.stations) return this.data.stations;

    this.loading.stations = true;

    try {
      const data = await this.fetchJSON("data/station_locations.json");
      this.data.stations = data;
      this.loaded.stations = true;
      return data;
    } finally {
      this.loading.stations = false;
    }
  },

  /**
   * Load anomaly events
   * @returns {Promise<Array>} Anomaly records
   */
  async loadAnomalies() {
    if (this.loaded.anomalies) return this.data.anomalies;

    this.loading.anomalies = true;

    try {
      const data = await this.fetchJSON("data/anomalies.json");
      this.data.anomalies = data;
      this.loaded.anomalies = true;
      return data;
    } finally {
      this.loading.anomalies = false;
    }
  },

  /**
   * Load winter start/end data
   * @returns {Promise<Array>} Winter records
   */
  async loadWinterStarts() {
    if (this.loaded.winterStarts) return this.data.winterStarts;

    this.loading.winterStarts = true;

    try {
      const data = await this.fetchJSON("data/winter_starts.json");
      this.data.winterStarts = data;
      this.loaded.winterStarts = true;
      return data;
    } finally {
      this.loading.winterStarts = false;
    }
  },

  /**
   * Load slippery road risk data
   * @returns {Promise<Array>} Slippery risk records
   */
  async loadSlipperyRisk() {
    if (this.loaded.slipperyRisk) return this.data.slipperyRisk;

    this.loading.slipperyRisk = true;

    try {
      const data = await this.fetchJSON("data/slippery_risk.json");
      this.data.slipperyRisk = data;
      this.loaded.slipperyRisk = true;
      return data;
    } catch (error) {
      console.warn("Slippery risk data not available:", error.message);
      this.data.slipperyRisk = [];
      this.loaded.slipperyRisk = true;
      return [];
    } finally {
      this.loading.slipperyRisk = false;
    }
  },

  /**
   * Load first frost data
   * @returns {Promise<Array>} First frost records
   */
  async loadFirstFrost() {
    if (this.loaded.firstFrost) return this.data.firstFrost;

    this.loading.firstFrost = true;

    try {
      const data = await this.fetchJSON("data/first_frost.json");
      this.data.firstFrost = data;
      this.loaded.firstFrost = true;
      return data;
    } catch (error) {
      console.warn("First frost data not available:", error.message);
      this.data.firstFrost = [];
      this.loaded.firstFrost = true;
      return [];
    } finally {
      this.loading.firstFrost = false;
    }
  },

  /**
   * Load first snow data (ensilumi)
   * @returns {Promise<Array>} First snow records
   */
  async loadFirstSnow() {
    if (this.loaded.firstSnow) return this.data.firstSnow;

    this.loading.firstSnow = true;

    try {
      const data = await this.fetchJSON("data/first_snow.json");
      this.data.firstSnow = data;
      this.loaded.firstSnow = true;
      return data;
    } catch (error) {
      console.warn("First snow data not available:", error.message);
      this.data.firstSnow = [];
      this.loaded.firstSnow = true;
      return [];
    } finally {
      this.loading.firstSnow = false;
    }
  },

  /**
   * Load precomputed interpolation grids
   * @returns {Promise<Array>} Grid records
   */
  async loadPrecomputedGrids() {
    if (this.loaded.precomputedGrids) return this.data.precomputedGrids;

    this.loading.precomputedGrids = true;

    try {
      const data = await this.fetchJSON("data/precomputed_grids.json");
      this.data.precomputedGrids = data;
      this.loaded.precomputedGrids = true;
      console.log("Precomputed grids loaded:", data.length, "grids");
      return data;
    } catch (error) {
      console.warn(
        "Precomputed grids not available, will use real-time interpolation"
      );
      this.data.precomputedGrids = [];
      this.loaded.precomputedGrids = true;
      return [];
    } finally {
      this.loading.precomputedGrids = false;
    }
  },

  /**
   * Fetch and parse JSON file (tries .gz version first)
   * @param {string} url - File URL
   * @returns {Promise<any>} Parsed JSON data
   */
  async fetchJSON(url) {
    // Try gzipped version first for better performance
    const gzUrl = url + '.gz';

    try {
      const response = await fetch(gzUrl);
      if (response.ok) {
        // Browser automatically decompresses gzip when Content-Encoding is set
        // But for static hosting, we need to decompress manually
        const blob = await response.blob();
        const ds = new DecompressionStream('gzip');
        const decompressed = blob.stream().pipeThrough(ds);
        const text = await new Response(decompressed).text();
        return JSON.parse(text);
      }
    } catch (e) {
      // Gzip version not available or failed, fall back to regular JSON
      console.debug(`Gzip not available for ${url}, using uncompressed`);
    }

    // Fall back to uncompressed JSON
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load ${url}: ${response.status} ${response.statusText}`
      );
    }
    return await response.json();
  },

  /**
   * Get data for a specific date and zone
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {string} zone - Zone key
   * @returns {object|null} Zone data or null
   */
  getZoneData(date, zone) {
    if (!this.data.zoneSummary) return null;

    return (
      this.data.zoneSummary.find(
        (record) => record.date === date && record.zone === zone
      ) || null
    );
  },

  /**
   * Get all zone data for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of zone records
   */
  getDateData(date) {
    if (!this.data.zoneSummary) return [];

    return this.data.zoneSummary.filter((record) => record.date === date);
  },

  /**
   * Get all station data for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of station records with measurements
   */
  getStationDataForDate(date) {
    if (!this.data.stationData) return [];

    return this.data.stationData.filter((record) => record.date === date);
  },

  /**
   * Get anomalies for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of anomaly events
   */
  getAnomaliesForDate(date) {
    if (!this.data.anomalies) return [];

    return this.data.anomalies.filter((anomaly) => {
      // Check if date falls within anomaly period
      const startDate = anomaly.start_date || anomaly.date;
      if (!startDate) return false;

      const duration = anomaly.duration_days || 1;
      const endDate = this.addDays(startDate, duration);

      return date >= startDate && date < endDate;
    });
  },

  /**
   * Get cold spells active on a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of cold spell objects with zone info
   */
  getColdSpellsForDate(date) {
    if (!this.data.winterStarts) return [];

    const results = [];
    this.data.winterStarts.forEach((record) => {
      if (!record.cold_spells) return;

      record.cold_spells.forEach((spell) => {
        if (date >= spell.start && date <= spell.end) {
          results.push({
            type: "cold_spell",
            zone: record.zone,
            start_date: spell.start,
            end_date: spell.end,
            duration_days: spell.duration,
            min_temp: spell.min_temp,
            season: record.season,
          });
        }
      });
    });

    return results;
  },

  /**
   * Get warm spells active on a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of warm spell objects with zone info
   */
  getWarmSpellsForDate(date) {
    if (!this.data.winterStarts) return [];

    const results = [];
    this.data.winterStarts.forEach((record) => {
      if (!record.warm_spells) return;

      record.warm_spells.forEach((spell) => {
        if (date >= spell.start && date <= spell.end) {
          results.push({
            type: "warm_spell",
            zone: record.zone,
            start_date: spell.start,
            end_date: spell.end,
            duration_days: spell.duration,
            max_temp: spell.max_temp,
            season: record.season,
          });
        }
      });
    });

    return results;
  },

  /**
   * Get winter start markers for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of winter start marker objects
   */
  getWinterStartsForDate(date) {
    if (!this.data.winterStarts) return [];

    return this.data.winterStarts
      .filter((record) => record.season_start === date)
      .map((record) => ({
        type: "winter_start",
        zone: record.zone,
        date: record.season_start,
        season: record.season,
        total_days: record.total_days,
      }));
  },

  /**
   * Get winter end markers for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of winter end marker objects
   */
  getWinterEndsForDate(date) {
    if (!this.data.winterStarts) return [];

    return this.data.winterStarts
      .filter((record) => record.season_end === date)
      .map((record) => ({
        type: "winter_end",
        zone: record.zone,
        date: record.season_end,
        season: record.season,
        total_days: record.total_days,
      }));
  },

  /**
   * Get slippery season start markers for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of slippery season start marker objects
   */
  getSlipperySeasonStartsForDate(date) {
    if (!this.data.slipperyRisk) return [];

    return this.data.slipperyRisk
      .filter((record) => record.season_start === date)
      .map((record) => ({
        type: "slippery_start",
        zone: record.zone,
        date: record.season_start,
        year: record.year,
        risk_days_total: record.risk_days_total,
      }));
  },

  /**
   * Get slippery risk periods active on a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of slippery risk period objects
   */
  getSlipperyPeriodsForDate(date) {
    if (!this.data.slipperyRisk) return [];

    const results = [];
    this.data.slipperyRisk.forEach((record) => {
      if (!record.slippery_periods) return;

      record.slippery_periods.forEach((period) => {
        if (date >= period.start && date <= period.end) {
          results.push({
            type: "slippery_period",
            zone: record.zone,
            start_date: period.start,
            end_date: period.end,
            duration_days: period.duration,
            high_risk_days: period.high_risk_days,
            avg_min_temp: period.avg_min_temp,
            avg_max_temp: period.avg_max_temp,
            year: record.year,
          });
        }
      });
    });

    return results;
  },

  /**
   * Get first frost markers for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of first frost marker objects
   */
  getFirstFrostForDate(date) {
    if (!this.data.firstFrost) return [];

    return this.data.firstFrost
      .filter((record) => record.first_frost_date === date)
      .map((record) => ({
        type: "first_frost",
        zone: record.zone,
        date: record.first_frost_date,
        frost_temp: record.first_frost_temp,
        year: record.year,
      }));
  },

  /**
   * Get first snow markers for a specific date (ensilumi)
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of first snow marker objects
   */
  getFirstSnowForDate(date) {
    if (!this.data.firstSnow) return [];

    return this.data.firstSnow
      .filter((record) => record.first_snow_date === date)
      .map((record) => ({
        type: "first_snow",
        zone: record.zone,
        date: record.first_snow_date,
        snow_depth: record.first_snow_depth,
        year: record.year,
      }));
  },

  /**
   * Get frost periods active on a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of frost period objects
   */
  getFrostPeriodsForDate(date) {
    if (!this.data.firstFrost) return [];

    const results = [];
    this.data.firstFrost.forEach((record) => {
      if (!record.frost_periods) return;

      record.frost_periods.forEach((period) => {
        if (date >= period.start && date <= period.end) {
          results.push({
            type: "frost_period",
            zone: record.zone,
            start_date: period.start,
            end_date: period.end,
            duration_days: period.duration,
            min_temp: period.min_temp,
            avg_min_temp: period.avg_min_temp,
            year: record.year,
          });
        }
      });
    });

    return results;
  },

  /**
   * Get all phenomena active on a specific date
   * Combines all phenomenon types for the Active Anomalies list
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Array} Array of all phenomenon objects sorted by type
   */
  getAllPhenomenaForDate(date) {
    const allPhenomena = [
      ...this.getColdSpellsForDate(date),
      ...this.getWarmSpellsForDate(date),
      ...this.getWinterStartsForDate(date),
      ...this.getWinterEndsForDate(date),
      ...this.getSlipperySeasonStartsForDate(date),
      ...this.getSlipperyPeriodsForDate(date),
      ...this.getFirstFrostForDate(date),
      ...this.getFrostPeriodsForDate(date),
      ...this.getFirstSnowForDate(date),
    ];

    // Also add anomalies, normalized to the same format
    const anomalies = this.getAnomaliesForDate(date);
    anomalies.forEach((anomaly) => {
      allPhenomena.push({
        type: anomaly.type,
        zone: anomaly.zone,
        start_date: anomaly.start_date || anomaly.date,
        end_date: anomaly.end_date,
        duration_days: anomaly.duration_days,
        min_temp: anomaly.min_temperature,
        max_temp: anomaly.max_temperature,
      });
    });

    // Zone order: South to North
    const zoneOrder = ["Etelä-Suomi", "Keski-Suomi", "Pohjois-Suomi", "Lappi"];

    // Type order for secondary grouping within each zone
    const typeOrder = [
      "winter_start",
      "winter_end",
      "first_frost",
      "frost_period",
      "first_snow",
      "cold_spell",
      "warm_spell",
      "Äärimmäinen kylmyys",
      "Ankara pakkasjakso",
      "Hellejakso",
      "Takatalvi",
      "Äkillinen lämpeneminen",
      "slippery_start",
      "slippery_period",
    ];

    allPhenomena.sort((a, b) => {
      // Primary sort by zone
      const zoneIndexA = zoneOrder.indexOf(a.zone);
      const zoneIndexB = zoneOrder.indexOf(b.zone);
      if (zoneIndexA !== zoneIndexB) return zoneIndexA - zoneIndexB;
      // Secondary sort by phenomenon type
      const typeIndexA = typeOrder.indexOf(a.type);
      const typeIndexB = typeOrder.indexOf(b.type);
      return typeIndexA - typeIndexB;
    });

    return allPhenomena;
  },

  /**
   * Get winter status for a zone on a date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {string} zone - Zone key
   * @returns {object|null} Winter status or null
   */
  getWinterStatus(date, zone) {
    if (!this.data.winterStarts) return null;

    for (const record of this.data.winterStarts) {
      if (record.zone !== zone) continue;

      const winterStart = record.winter_start;
      const winterEnd = record.winter_end;

      if (!winterStart) continue;

      // Check if date is within winter period
      if (winterEnd) {
        if (date >= winterStart && date <= winterEnd) {
          return {
            inWinter: true,
            season: record.season,
            daysSinceStart: this.daysBetween(winterStart, date),
            duration: record.winter_duration_days,
          };
        }
      } else {
        // Ongoing winter (no end date yet)
        if (date >= winterStart) {
          return {
            inWinter: true,
            season: record.season,
            daysSinceStart: this.daysBetween(winterStart, date),
            duration: null,
          };
        }
      }
    }

    return { inWinter: false };
  },

  /**
   * Get date range from data
   * @returns {object} {minDate, maxDate}
   */
  getDateRange() {
    if (!this.data.zoneSummary || this.data.zoneSummary.length === 0) {
      return { minDate: "2022-01-01", maxDate: "2025-12-31" };
    }

    const dates = this.data.zoneSummary.map((r) => r.date);
    return {
      minDate: dates.reduce((a, b) => (a < b ? a : b)),
      maxDate: dates.reduce((a, b) => (a > b ? a : b)),
    };
  },

  /**
   * Helper: Add days to a date string
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @param {number} days - Days to add
   * @returns {string} New date string
   */
  addDays(dateStr, days) {
    if (!dateStr || isNaN(days)) {
      console.warn("Invalid date or days:", dateStr, days);
      return dateStr;
    }
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) {
      console.warn("Invalid date string:", dateStr);
      return dateStr;
    }
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  },

  /**
   * Helper: Calculate days between two dates
   * @param {string} date1 - Start date (YYYY-MM-DD)
   * @param {string} date2 - End date (YYYY-MM-DD)
   * @returns {number} Number of days
   */
  daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if all essential data is loaded
   * @returns {boolean} True if all loaded
   */
  isReady() {
    return (
      this.loaded.zoneSummary &&
      this.loaded.stationData &&
      this.loaded.stations &&
      this.loaded.anomalies &&
      this.loaded.winterStarts
    );
  },
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = DataLoader;
}
