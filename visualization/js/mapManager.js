/**
 * mapManager.js
 * Manages Leaflet map initialization and base functionality
 */

const MapManager = {
  map: null,
  markers: [],
  heatmapLayer: null,
  interpolationLayer: null,

  // Finland bounds
  FINLAND_BOUNDS: {
    north: 70.1,
    south: 59.5,
    east: 31.6,
    west: 19.0
  },

  /**
   * Initialize the map with Finland bounds
   * @param {string} containerId - ID of the map container element
   * @returns {L.Map} Leaflet map instance
   */
  initializeMap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Map container '${containerId}' not found`);
      return null;
    }

    // Create map centered on Finland
    const center = [
      (this.FINLAND_BOUNDS.north + this.FINLAND_BOUNDS.south) / 2,
      (this.FINLAND_BOUNDS.east + this.FINLAND_BOUNDS.west) / 2
    ];

    this.map = L.map(containerId).setView(center, 5);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Set max bounds to Finland area
    const bounds = L.latLngBounds(
      [this.FINLAND_BOUNDS.south, this.FINLAND_BOUNDS.west],
      [this.FINLAND_BOUNDS.north, this.FINLAND_BOUNDS.east]
    );
    this.map.setMaxBounds(bounds.pad(0.1));

    // Add controls
    this.addControls();

    return this.map;
  },

  /**
   * Add basic controls to map
   */
  addControls() {
    if (!this.map) return;

    // Add zoom control in top right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Add scale control
    L.control.scale({ position: 'bottomright' }).addTo(this.map);

    // Add layers control
    this.layersControl = L.control.layers({}, {}, { position: 'topright' });
    this.layersControl.addTo(this.map);
  },

  /**
   * Clear all markers from the map
   */
  clearMarkers() {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers = [];
  },

  /**
   * Add a station marker to the map
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} options - Marker options
   * @returns {L.CircleMarker} Leaflet circle marker
   */
  addStationMarker(lat, lon, options = {}) {
    if (!this.map) return null;

    const defaultOptions = {
      radius: 6,
      fillColor: '#3388ff',
      color: '#000',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.7,
      title: 'Weather Station'
    };

    const markerOptions = { ...defaultOptions, ...options };
    const marker = L.circleMarker([lat, lon], markerOptions);
    marker.addTo(this.map);
    this.markers.push(marker);

    return marker;
  },

  /**
   * Add multiple station markers
   * @param {Array} stations - Array of station objects with lat/lon
   * @param {Function} colorFunction - Function to determine circle color
   * @param {Function} radiusFunction - Function to determine circle radius
   */
  addStationMarkers(stations, colorFunction, radiusFunction) {
    this.clearMarkers();

    stations.forEach(station => {
      const color = colorFunction ? colorFunction(station) : '#3388ff';
      const radius = radiusFunction ? radiusFunction(station) : 6;

      const marker = this.addStationMarker(station.lat, station.lon, {
        radius: radius,
        fillColor: color,
        title: station.name || station.station_name || station.id
      });

      // Store reference to station data
      marker.stationData = station;
    });
  },

  /**
   * Add or update heatmap layer
   * @param {L.Layer} layer - Leaflet layer (Heatmap.js, etc.)
   * @param {string} name - Name for layers control
   */
  addHeatmapLayer(layer, name = 'Heatmap') {
    if (this.heatmapLayer) {
      this.map.removeLayer(this.heatmapLayer);
    }

    this.heatmapLayer = layer;
    this.map.addLayer(layer);

    // Add to layers control if it exists
    if (this.layersControl) {
      this.layersControl.addOverlay(layer, name);
    }
  },

  /**
   * Add or update interpolation overlay layer
   * @param {L.Layer} layer - Leaflet layer
   * @param {string} name - Name for layers control
   */
  addInterpolationLayer(layer, name = 'Interpolated') {
    if (this.interpolationLayer) {
      this.map.removeLayer(this.interpolationLayer);
    }

    this.interpolationLayer = layer;
    this.map.addLayer(layer);

    if (this.layersControl) {
      this.layersControl.addOverlay(layer, name);
    }
  },

  /**
   * Remove a layer from the map
   * @param {L.Layer} layer - Layer to remove
   */
  removeLayer(layer) {
    if (this.map && layer) {
      this.map.removeLayer(layer);
    }
  },

  /**
   * Set map view to specific bounds
   * @param {Array} bounds - [[south, west], [north, east]]
   */
  fitToBounds(bounds) {
    if (this.map && bounds && bounds.length === 2) {
      const latLngBounds = L.latLngBounds(bounds);
      this.map.fitBounds(latLngBounds);
    }
  },

  /**
   * Get current map zoom level
   * @returns {number} Zoom level
   */
  getZoom() {
    return this.map ? this.map.getZoom() : null;
  },

  /**
   * Get current map center
   * @returns {Object} {lat, lon}
   */
  getCenter() {
    if (!this.map) return null;
    const center = this.map.getCenter();
    return { lat: center.lat, lon: center.lng };
  },

  /**
   * Set map view
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} zoom - Zoom level
   */
  setView(lat, lon, zoom = 5) {
    if (this.map) {
      this.map.setView([lat, lon], zoom);
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapManager;
}
