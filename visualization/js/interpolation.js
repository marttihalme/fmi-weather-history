/**
 * interpolation.js
 * Inverse Distance Weighting (IDW) interpolation for creating continuous grids from station data
 */

const Interpolation = {
  /**
   * Perform IDW interpolation
   * @param {Array} stations - Array of stations with {lat, lon, value}
   * @param {Object} grid - Grid specification {latMin, latMax, lonMin, lonMax, resolution}
   * @param {number} power - IDW power parameter (default 2)
   * @returns {Array} Interpolated grid values
   */
  interpolateIDW(stations, grid, power = 2) {
    if (!stations || stations.length === 0) {
      console.warn('No stations provided for interpolation');
      return null;
    }

    const { latMin, latMax, lonMin, lonMax, resolution } = grid;
    const latStep = (latMax - latMin) / resolution;
    const lonStep = (lonMax - lonMin) / resolution;

    const interpolated = [];

    // Iterate over grid points
    for (let i = 0; i <= resolution; i++) {
      const lat = latMin + i * latStep;
      const row = [];

      for (let j = 0; j <= resolution; j++) {
        const lon = lonMin + j * lonStep;

        // Calculate IDW value for this point
        const value = this._calculateIDWValue(lat, lon, stations, power);
        row.push(value);
      }

      interpolated.push(row);
    }

    return interpolated;
  },

  /**
   * Calculate IDW value for a single point
   * @param {number} lat - Target latitude
   * @param {number} lon - Target longitude
   * @param {Array} stations - Array of stations with {lat, lon, value}
   * @param {number} power - IDW power parameter
   * @returns {number} Interpolated value
   * @private
   */
  _calculateIDWValue(lat, lon, stations, power) {
    let numerator = 0;
    let denominator = 0;
    const epsilon = 1e-10; // Small value to avoid division by zero

    stations.forEach(station => {
      // Calculate distance
      const distance = this._haversineDistance(lat, lon, station.lat, station.lon);

      if (distance < epsilon) {
        // Point is at or very close to a station
        numerator = station.value;
        denominator = 1;
        return; // Use this station's value
      }

      // IDW weight
      const weight = 1 / Math.pow(distance, power);
      numerator += weight * station.value;
      denominator += weight;
    });

    return denominator > 0 ? numerator / denominator : 0;
  },

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - First point latitude
   * @param {number} lon1 - First point longitude
   * @param {number} lat2 - Second point latitude
   * @param {number} lon2 - Second point longitude
   * @returns {number} Distance in kilometers
   * @private
   */
  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  /**
   * Load precomputed interpolation grid from file
   * @param {string} url - URL to grid data (JSON format)
   * @returns {Promise} Promise resolving to grid data
   */
  async loadPrecomputedGrid(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load grid: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading precomputed grid:', error);
      return null;
    }
  },

  /**
   * Convert interpolated grid to canvas image data
   * @param {Array} gridData - 2D array of interpolated values
   * @param {Object} colorScale - Color scale object with getColor method
   * @param {Object} bounds - {min, max} values for normalization
   * @returns {ImageData} Canvas ImageData for rendering
   */
  gridToImageData(gridData, colorScale, bounds) {
    if (!gridData || gridData.length === 0) {
      return null;
    }

    const height = gridData.length;
    const width = gridData[0].length;
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    let pixelIndex = 0;

    gridData.forEach(row => {
      row.forEach(value => {
        // Get color from color scale
        const color = colorScale.getColor(value);

        // Parse hex color to RGB
        const rgb = this._hexToRgb(color);

        data[pixelIndex++] = rgb.r;
        data[pixelIndex++] = rgb.g;
        data[pixelIndex++] = rgb.b;
        data[pixelIndex++] = 200; // Alpha
      });
    });

    return imageData;
  },

  /**
   * Convert hex color to RGB
   * @param {string} hex - Hex color string
   * @returns {Object} {r, g, b}
   * @private
   */
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 200, g: 200, b: 200 };
  },

  /**
   * Apply Gaussian blur to interpolated grid
   * @param {Array} gridData - 2D array of values
   * @param {number} radius - Blur radius in grid units
   * @returns {Array} Blurred grid
   */
  applyGaussianBlur(gridData, radius = 2) {
    if (!gridData || gridData.length === 0) return gridData;

    const blurred = JSON.parse(JSON.stringify(gridData)); // Deep copy
    const height = gridData.length;
    const width = gridData[0].length;

    // Simple box blur approximation
    const blurRadius = Math.max(1, Math.floor(radius));

    for (let i = blurRadius; i < height - blurRadius; i++) {
      for (let j = blurRadius; j < width - blurRadius; j++) {
        let sum = 0;
        let count = 0;

        for (let di = -blurRadius; di <= blurRadius; di++) {
          for (let dj = -blurRadius; dj <= blurRadius; dj++) {
            sum += gridData[i + di][j + dj];
            count++;
          }
        }

        blurred[i][j] = sum / count;
      }
    }

    return blurred;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Interpolation;
}
