/**
 * Color scales for different weather metrics
 * Each metric has a specific color gradient and value range
 */

const ColorScales = {
    // Metric configurations
    metrics: {
        temp_mean: {
            name: 'Air Temperature (Mean)',
            unit: '°C',
            range: [-40, 35],
            colors: [
                { value: -40, color: '#08519c' },  // Dark blue
                { value: -20, color: '#3182bd' },  // Medium blue
                { value: 0, color: '#deebf7' },    // Light blue
                { value: 10, color: '#fee0d2' },   // Light orange
                { value: 20, color: '#fc9272' },   // Medium orange
                { value: 35, color: '#de2d26' }    // Dark red
            ],
            type: 'diverging'
        },
        temp_min: {
            name: 'Minimum Temperature',
            unit: '°C',
            range: [-50, 25],
            colors: [
                { value: -50, color: '#08306b' },
                { value: -30, color: '#08519c' },
                { value: -10, color: '#3182bd' },
                { value: 0, color: '#6baed6' },
                { value: 10, color: '#9ecae1' },
                { value: 25, color: '#c6dbef' }
            ],
            type: 'sequential'
        },
        temp_max: {
            name: 'Maximum Temperature',
            unit: '°C',
            range: [-30, 40],
            colors: [
                { value: -30, color: '#ffffcc' },
                { value: -10, color: '#ffeda0' },
                { value: 0, color: '#fed976' },
                { value: 10, color: '#feb24c' },
                { value: 20, color: '#fd8d3c' },
                { value: 30, color: '#f03b20' },
                { value: 40, color: '#bd0026' }
            ],
            type: 'sequential'
        },
        snow_depth: {
            name: 'Snow Depth',
            unit: 'cm',
            range: [0, 100],
            colors: [
                { value: 0, color: '#f7fbff' },
                { value: 10, color: '#deebf7' },
                { value: 25, color: '#c6dbef' },
                { value: 40, color: '#9ecae1' },
                { value: 60, color: '#6baed6' },
                { value: 80, color: '#3182bd' },
                { value: 100, color: '#08519c' }
            ],
            type: 'sequential'
        },
        precipitation: {
            name: 'Precipitation Amount',
            unit: 'mm',
            range: [0, 40],
            colors: [
                { value: 0, color: '#f7fbff' },
                { value: 5, color: '#deebf7' },
                { value: 10, color: '#c6dbef' },
                { value: 15, color: '#9ecae1' },
                { value: 20, color: '#6baed6' },
                { value: 30, color: '#3182bd' },
                { value: 40, color: '#08519c' }
            ],
            type: 'sequential'
        }
    },

    // Zone colors
    zones: {
        etela_suomi: { color: '#2E86AB', name: 'Etelä-Suomi' },
        keski_suomi: { color: '#A23B72', name: 'Keski-Suomi' },
        pohjois_suomi: { color: '#F18F01', name: 'Pohjois-Suomi' },
        lappi: { color: '#C73E1D', name: 'Lappi' }
    },

    // Anomaly colors
    anomalies: {
        'Äärimmäinen kylmyys': { color: '#2171b5', name: 'Extreme Cold' },
        'Ankara pakkasjakso': { color: '#6baed6', name: 'Cold Snap' },
        'Hellejakso': { color: '#de2d26', name: 'Heat Wave' },
        'Takatalvi': { color: '#756bb1', name: 'Return Winter' },
        'Äkillinen lämpeneminen': { color: '#fdae6b', name: 'Temperature Jump' }
    },

    /**
     * Interpolate color for a given value
     * @param {string} metric - Metric key (e.g., 'temp_mean')
     * @param {number} value - Value to interpolate
     * @returns {string} RGB color string
     */
    getColor(metric, value) {
        const config = this.metrics[metric];
        if (!config) return '#999';

        // Handle null/undefined
        if (value === null || value === undefined || isNaN(value)) {
            return '#ccc';
        }

        // Clamp value to range
        const [min, max] = config.range;
        value = Math.max(min, Math.min(max, value));

        // Find surrounding color stops
        const colors = config.colors;
        for (let i = 0; i < colors.length - 1; i++) {
            const stop1 = colors[i];
            const stop2 = colors[i + 1];

            if (value >= stop1.value && value <= stop2.value) {
                // Linear interpolation
                const t = (value - stop1.value) / (stop2.value - stop1.value);
                return this.interpolateColor(stop1.color, stop2.color, t);
            }
        }

        // Return last color if value is at or beyond max
        return colors[colors.length - 1].color;
    },

    /**
     * Linear interpolation between two hex colors
     * @param {string} color1 - Start color (hex)
     * @param {string} color2 - End color (hex)
     * @param {number} t - Interpolation factor (0-1)
     * @returns {string} RGB color string
     */
    interpolateColor(color1, color2, t) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);

        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);

        return `rgb(${r}, ${g}, ${b})`;
    },

    /**
     * Convert hex color to RGB object
     * @param {string} hex - Hex color string
     * @returns {object} RGB object {r, g, b}
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    /**
     * Get metric configuration
     * @param {string} metric - Metric key
     * @returns {object} Metric configuration
     */
    getMetricConfig(metric) {
        return this.metrics[metric] || null;
    },

    /**
     * Draw color scale on canvas
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} metric - Metric key
     */
    drawColorScale(canvas, metric) {
        const config = this.metrics[metric];
        if (!config) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Draw gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        const [min, max] = config.range;

        config.colors.forEach(stop => {
            const position = (stop.value - min) / (max - min);
            gradient.addColorStop(position, stop.color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw border
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
    },

    /**
     * Format value with unit
     * @param {string} metric - Metric key
     * @param {number} value - Value to format
     * @returns {string} Formatted string
     */
    formatValue(metric, value) {
        const config = this.metrics[metric];
        if (!config) return '-';
        if (value === null || value === undefined || isNaN(value)) return '-';

        return `${value.toFixed(1)}${config.unit}`;
    },

    /**
     * Get zone color
     * @param {string} zone - Zone key
     * @returns {string} Hex color
     */
    getZoneColor(zone) {
        const zoneKey = zone.toLowerCase().replace(/-/g, '_');
        return this.zones[zoneKey]?.color || '#999';
    },

    /**
     * Get anomaly color
     * @param {string} type - Anomaly type
     * @returns {string} Hex color
     */
    getAnomalyColor(type) {
        return this.anomalies[type]?.color || '#999';
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorScales;
}
