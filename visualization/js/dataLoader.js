/**
 * Data loading module
 * Handles loading and parsing of all JSON data files
 */

const DataLoader = {
    // Data storage
    data: {
        zoneSummary: null,      // Daily zone summaries
        stations: null,          // Station locations
        anomalies: null,         // Anomaly events
        winterStarts: null,      // Winter progression
        precomputedGrids: null   // Pre-computed IDW grids
    },

    // Loading state
    loading: {
        zoneSummary: false,
        stations: false,
        anomalies: false,
        winterStarts: false,
        precomputedGrids: false
    },

    // Loaded flags
    loaded: {
        zoneSummary: false,
        stations: false,
        anomalies: false,
        winterStarts: false,
        precomputedGrids: false
    },

    /**
     * Load all essential data files
     * @returns {Promise} Resolves when all data is loaded
     */
    async loadAll() {
        console.log('Loading all data files...');

        try {
            // Load in parallel for speed
            const [zoneSummary, stations, anomalies, winterStarts] = await Promise.all([
                this.loadZoneSummary(),
                this.loadStations(),
                this.loadAnomalies(),
                this.loadWinterStarts()
            ]);

            console.log('Essential data loaded successfully');
            console.log('- Zone summaries:', zoneSummary.length, 'records');
            console.log('- Stations:', stations.length, 'locations');
            console.log('- Anomalies:', anomalies.length, 'events');
            console.log('- Winter seasons:', winterStarts.length, 'records');

            // Load precomputed grids in background (not blocking)
            this.loadPrecomputedGrids().catch(err => {
                console.warn('Could not load precomputed grids (will use real-time interpolation):', err.message);
            });

            return {
                zoneSummary,
                stations,
                anomalies,
                winterStarts
            };

        } catch (error) {
            console.error('Error loading data:', error);
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
            const data = await this.fetchJSON('data/daily_zone_summary.json');
            this.data.zoneSummary = data;
            this.loaded.zoneSummary = true;
            return data;
        } finally {
            this.loading.zoneSummary = false;
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
            const data = await this.fetchJSON('data/station_locations.json');
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
            const data = await this.fetchJSON('data/anomalies.json');
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
            const data = await this.fetchJSON('data/winter_starts.json');
            this.data.winterStarts = data;
            this.loaded.winterStarts = true;
            return data;
        } finally {
            this.loading.winterStarts = false;
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
            const data = await this.fetchJSON('data/precomputed_grids.json');
            this.data.precomputedGrids = data;
            this.loaded.precomputedGrids = true;
            console.log('Precomputed grids loaded:', data.length, 'grids');
            return data;
        } catch (error) {
            console.warn('Precomputed grids not available, will use real-time interpolation');
            this.data.precomputedGrids = [];
            this.loaded.precomputedGrids = true;
            return [];
        } finally {
            this.loading.precomputedGrids = false;
        }
    },

    /**
     * Fetch and parse JSON file
     * @param {string} url - File URL
     * @returns {Promise<any>} Parsed JSON data
     */
    async fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
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

        return this.data.zoneSummary.find(record =>
            record.date === date && record.zone === zone
        ) || null;
    },

    /**
     * Get all data for a specific date
     * @param {string} date - Date string (YYYY-MM-DD)
     * @returns {Array} Array of zone records
     */
    getDateData(date) {
        if (!this.data.zoneSummary) return [];

        return this.data.zoneSummary.filter(record =>
            record.date === date
        );
    },

    /**
     * Get anomalies for a specific date
     * @param {string} date - Date string (YYYY-MM-DD)
     * @returns {Array} Array of anomaly events
     */
    getAnomaliesForDate(date) {
        if (!this.data.anomalies) return [];

        return this.data.anomalies.filter(anomaly => {
            // Check if date falls within anomaly period
            const startDate = anomaly.start_date || anomaly.date;
            if (!startDate) return false;

            const duration = anomaly.duration_days || 1;
            const endDate = this.addDays(startDate, duration);

            return date >= startDate && date < endDate;
        });
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
                        duration: record.winter_duration_days
                    };
                }
            } else {
                // Ongoing winter (no end date yet)
                if (date >= winterStart) {
                    return {
                        inWinter: true,
                        season: record.season,
                        daysSinceStart: this.daysBetween(winterStart, date),
                        duration: null
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
            return { minDate: '2022-01-01', maxDate: '2025-12-31' };
        }

        const dates = this.data.zoneSummary.map(r => r.date);
        return {
            minDate: dates.reduce((a, b) => a < b ? a : b),
            maxDate: dates.reduce((a, b) => a > b ? a : b)
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
            console.warn('Invalid date or days:', dateStr, days);
            return dateStr;
        }
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', dateStr);
            return dateStr;
        }
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
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
        return this.loaded.zoneSummary &&
               this.loaded.stations &&
               this.loaded.anomalies &&
               this.loaded.winterStarts;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
}
