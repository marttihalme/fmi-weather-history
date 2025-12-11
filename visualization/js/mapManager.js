/**
 * mapManager.js
 * Manages D3-based map visualization of Finland
 * Uses fi.json GeoJSON for Finland borders
 */

const MapManager = {
  svg: null,
  projection: null,
  path: null,
  markers: [],
  finlandGeoJSON: null,
  container: null,
  width: 0,
  height: 0,
  g: null, // Main group for all map elements
  zoom: null,

  // Layer groups (in order: background, heatmap, border, markers)
  layers: {
    heatmap: null,
    border: null,
    markers: null,
    anomalies: null
  },

  // Finland bounds (WGS84)
  FINLAND_BOUNDS: {
    north: 70.1,
    south: 59.5,
    east: 31.6,
    west: 19.0
  },

  /**
   * Initialize the D3 map with Finland
   * @param {string} containerId - ID of the map container element
   * @returns {Object} D3 selection of SVG
   */
  async initializeMap(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Map container '${containerId}' not found`);
      return null;
    }

    // Get container dimensions
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = rect.height || 600;

    // Create SVG
    this.svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('background', '#e8f4f8');

    // Create main group for map elements (will be transformed by zoom)
    this.g = this.svg.append('g').attr('class', 'map-group');

    // Create layer groups in correct order
    this.layers.heatmap = this.g.append('g').attr('class', 'layer-heatmap');
    this.layers.border = this.g.append('g').attr('class', 'layer-border');
    this.layers.markers = this.g.append('g').attr('class', 'layer-markers');
    this.layers.anomalies = this.g.append('g').attr('class', 'layer-anomalies');

    // Set up zoom behavior
    this.setupZoom();

    // Load Finland GeoJSON and set up projection
    await this.loadFinlandBorder();

    console.log('D3 Map initialized with zoom/pan');
    return this.svg;
  },

  /**
   * Set up D3 zoom behavior
   */
  setupZoom() {
    this.zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Add zoom controls
    this.addZoomControls();
  },

  /**
   * Add zoom control buttons
   */
  addZoomControls() {
    const controls = d3.select(this.container)
      .append('div')
      .attr('class', 'map-zoom-controls')
      .style('position', 'absolute')
      .style('top', '10px')
      .style('right', '10px')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('gap', '5px')
      .style('z-index', '100');

    // Zoom in button
    controls.append('button')
      .attr('class', 'zoom-btn')
      .style('width', '30px')
      .style('height', '30px')
      .style('font-size', '18px')
      .style('cursor', 'pointer')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('background', 'white')
      .text('+')
      .on('click', () => this.zoomIn());

    // Zoom out button
    controls.append('button')
      .attr('class', 'zoom-btn')
      .style('width', '30px')
      .style('height', '30px')
      .style('font-size', '18px')
      .style('cursor', 'pointer')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('background', 'white')
      .text('−')
      .on('click', () => this.zoomOut());

    // Reset button
    controls.append('button')
      .attr('class', 'zoom-btn')
      .style('width', '30px')
      .style('height', '30px')
      .style('font-size', '12px')
      .style('cursor', 'pointer')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('background', 'white')
      .text('⌂')
      .on('click', () => this.resetZoom());
  },

  /**
   * Zoom in
   */
  zoomIn() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.5);
  },

  /**
   * Zoom out
   */
  zoomOut() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.67);
  },

  /**
   * Reset zoom to initial state
   */
  resetZoom() {
    this.svg.transition().duration(300).call(this.zoom.transform, d3.zoomIdentity);
  },

  /**
   * Load Finland border from GeoJSON and set up projection
   */
  async loadFinlandBorder() {
    try {
      const response = await fetch('fi.json');
      if (!response.ok) {
        throw new Error(`Failed to load Finland GeoJSON: ${response.statusText}`);
      }
      this.finlandGeoJSON = await response.json();

      // Set up projection to fit Finland in container
      this.setupProjection();

      // Draw Finland
      this.drawFinland();

      console.log('Finland border loaded successfully');
    } catch (error) {
      console.error('Error loading Finland border:', error);
    }
  },

  /**
   * Set up D3 projection for Finland
   */
  setupProjection() {
    if (!this.finlandGeoJSON) return;

    // Use Mercator projection centered on Finland
    this.projection = d3.geoMercator()
      .fitExtent(
        [[this.width * 0.05, this.height * 0.05], [this.width * 0.95, this.height * 0.95]],
        this.finlandGeoJSON
      );

    // Create path generator
    this.path = d3.geoPath().projection(this.projection);
  },

  /**
   * Draw Finland polygon
   */
  drawFinland() {
    if (!this.finlandGeoJSON || !this.path) return;

    // Remove existing Finland layer
    this.layers.border.selectAll('.finland-border').remove();

    // Draw Finland border
    this.layers.border.append('path')
      .datum(this.finlandGeoJSON)
      .attr('class', 'finland-border')
      .attr('d', this.path)
      .attr('fill', 'none')
      .attr('stroke', '#333')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none');
  },

  /**
   * Convert lat/lon to pixel coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Array} [x, y] pixel coordinates
   */
  latLonToPixel(lat, lon) {
    if (!this.projection) return [0, 0];
    return this.projection([lon, lat]);
  },

  /**
   * Clear all markers from the map
   */
  clearMarkers() {
    if (this.layers.markers) {
      this.layers.markers.selectAll('*').remove();
    }
    if (this.layers.heatmap) {
      this.layers.heatmap.selectAll('*').remove();
    }
    this.markers = [];
  },

  /**
   * Add a station marker to the map
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} options - Marker options
   * @returns {Object} D3 selection of marker
   */
  addStationMarker(lat, lon, options = {}) {
    if (!this.layers.markers || !this.projection) return null;

    const [x, y] = this.latLonToPixel(lat, lon);

    const defaultOptions = {
      radius: 6,
      fillColor: '#3388ff',
      strokeColor: '#000',
      strokeWidth: 1,
      opacity: 0.8,
      fillOpacity: 0.7
    };

    const opts = { ...defaultOptions, ...options };

    const marker = this.layers.markers.append('circle')
      .attr('class', 'station-marker')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', opts.radius)
      .attr('fill', opts.fillColor)
      .attr('fill-opacity', opts.fillOpacity)
      .attr('stroke', opts.strokeColor)
      .attr('stroke-width', opts.strokeWidth)
      .attr('opacity', opts.opacity)
      .style('cursor', 'pointer')
      .style('pointer-events', 'all');

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
        fillColor: color
      });

      if (marker) {
        marker.datum(station);
        const name = station.name || station.station_name || station.id || 'Station';
        marker.append('title').text(name);
      }
    });
  },

  /**
   * Add station markers with metric tooltip
   * @param {Array} stations - Array of station objects
   * @param {Function} colorFunction - Function to determine circle color
   * @param {Function} radiusFunction - Function to determine circle radius
   * @param {string} metric - Current metric name
   */
  addStationMarkersWithTooltip(stations, colorFunction, radiusFunction, metric) {
    this.clearMarkers();

    stations.forEach(station => {
      const color = colorFunction ? colorFunction(station) : '#3388ff';
      const radius = radiusFunction ? radiusFunction(station) : 6;

      const marker = this.addStationMarker(station.lat, station.lon, {
        radius: radius,
        fillColor: color
      });

      if (marker) {
        marker.datum(station);
        const name = station.name || station.station_name || station.id || 'Station';
        const value = station.value !== undefined ? station.value.toFixed(1) : '-';
        marker.append('title').text(`${name}\n${metric}: ${value}`);
      }
    });
  },

  /**
   * Add weather station markers with detailed tooltips
   * @param {Array} stationData - Array of station data objects with lat, lon, and measurements
   * @param {string} currentMetric - Currently selected metric
   */
  addWeatherStationMarkers(stationData, currentMetric) {
    if (!this.layers.markers || !this.projection) return;

    // Clear existing markers
    this.layers.markers.selectAll('.weather-station-marker').remove();

    const self = this;

    stationData.forEach(station => {
      if (!station.lat || !station.lon) return;

      const [x, y] = this.latLonToPixel(station.lat, station.lon);

      // Create marker circle - small and gray
      const marker = this.layers.markers.append('circle')
        .attr('class', 'weather-station-marker')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 3)
        .attr('fill', '#666666')
        .attr('fill-opacity', 0.6)
        .attr('stroke', '#444444')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .style('pointer-events', 'all')
        .datum(station);

      // Add hover effects
      marker
        .on('mouseover', function(event) {
          d3.select(this)
            .attr('r', 6)
            .attr('fill', '#888888')
            .attr('fill-opacity', 0.9)
            .attr('stroke-width', 1.5);

          self.showStationTooltip(event, d3.select(this).datum(), currentMetric);
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('r', 3)
            .attr('fill', '#666666')
            .attr('fill-opacity', 0.6)
            .attr('stroke-width', 1);

          self.hideStationTooltip();
        });
    });
  },

  /**
   * Show tooltip
   */
  showTooltip(event, data) {
    let tooltip = d3.select('#map-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('id', 'map-tooltip')
        .attr('class', 'map-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0,0,0,0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000');
    }

    const name = data.name || data.station_name || data.id;
    tooltip
      .html(`<strong>${name}</strong>`)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .style('display', 'block');
  },

  /**
   * Hide tooltip
   */
  hideTooltip() {
    d3.select('#map-tooltip').style('display', 'none');
  },

  /**
   * Show detailed station tooltip with all metrics
   * @param {Event} event - Mouse event
   * @param {Object} station - Station data
   * @param {string} currentMetric - Currently selected metric
   */
  showStationTooltip(event, station, currentMetric) {
    let tooltip = d3.select('#station-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('id', 'station-tooltip')
        .attr('class', 'station-tooltip')
        .style('position', 'fixed')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px 16px')
        .style('border-radius', '6px')
        .style('font-size', '13px')
        .style('pointer-events', 'none')
        .style('z-index', '10000')
        .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
        .style('max-width', '320px')
        .style('line-height', '1.5');
    }

    // Build tooltip content
    const stationName = station.station_name || station.name || 'Unknown Station';
    const stationId = station.station_id || station.id || '';

    let html = `<div style="border-bottom: 1px solid #555; padding-bottom: 8px; margin-bottom: 8px;">
      <strong style="font-size: 14px;">${stationName}</strong>`;

    if (stationId) {
      html += `<br><span style="color: #aaa; font-size: 11px;">Asema ID: ${stationId}</span>`;
    }

    html += `</div><div style="display: grid; grid-template-columns: auto auto; gap: 8px 16px;">`;

    // Add all available metrics
    const metrics = [
      { key: 'temp_mean', label: 'Keskilämpötila', unit: '°C', highlight: currentMetric === 'temp_mean' },
      { key: 'temp_min', label: 'Minimilämpötila', unit: '°C', highlight: currentMetric === 'temp_min' },
      { key: 'temp_max', label: 'Maksimilämpötila', unit: '°C', highlight: currentMetric === 'temp_max' },
      { key: 'snow_depth', label: 'Lumensyvyys', unit: 'cm', highlight: currentMetric === 'snow_depth' },
      { key: 'precipitation', label: 'Sademäärä', unit: 'mm', highlight: currentMetric === 'precipitation' }
    ];

    metrics.forEach(metric => {
      const value = station[metric.key];
      if (value !== null && value !== undefined) {
        const style = metric.highlight ? 'color: #ffd43b; font-weight: bold;' : 'color: #ddd;';
        html += `<div style="${style}">${metric.label}:</div>`;
        html += `<div style="${style} text-align: right;">${value.toFixed(1)} ${metric.unit}</div>`;
      }
    });

    html += '</div>';

    // Add zone info if available
    if (station.zone) {
      html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555; color: #aaa; font-size: 11px;">
        Alue: ${station.zone}
      </div>`;
    }

    tooltip.html(html);

    // Position tooltip near cursor but ensure it stays on screen
    const tooltipNode = tooltip.node();
    const tooltipRect = tooltipNode.getBoundingClientRect();

    let left = event.clientX + 15;
    let top = event.clientY + 15;

    // Adjust if tooltip would go off right edge
    if (left + tooltipRect.width > window.innerWidth) {
      left = event.clientX - tooltipRect.width - 15;
    }

    // Adjust if tooltip would go off bottom edge
    if (top + tooltipRect.height > window.innerHeight) {
      top = event.clientY - tooltipRect.height - 15;
    }

    tooltip
      .style('left', left + 'px')
      .style('top', top + 'px')
      .style('display', 'block');
  },

  /**
   * Hide station tooltip
   */
  hideStationTooltip() {
    d3.select('#station-tooltip').style('display', 'none');
  },

  /**
   * Add interpolation circles (for smooth heatmap effect)
   * @param {Array} circles - Array of {lat, lon, radius, color, opacity}
   */
  addInterpolationCircles(circles) {
    if (!this.layers.heatmap || !this.projection) return;

    circles.forEach(circle => {
      const [x, y] = this.latLonToPixel(circle.lat, circle.lon);

      // Convert km radius to pixels (approximate)
      const scale = this.getScaleFactor();
      const pixelRadius = circle.radius * scale;

      this.layers.heatmap.append('circle')
        .attr('class', 'interpolation-circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', pixelRadius)
        .attr('fill', circle.color)
        .attr('fill-opacity', circle.opacity || 0.3)
        .attr('stroke', 'none');
    });
  },

  /**
   * Get approximate scale factor (pixels per km)
   */
  getScaleFactor() {
    if (!this.projection) return 1;

    // Calculate pixels per degree at Finland's latitude
    const center = [25, 64]; // Approximate Finland center
    const p1 = this.projection(center);
    const p2 = this.projection([center[0] + 1, center[1]]);

    // 1 degree longitude at 64°N ≈ 49 km
    const pixelsPerDegree = Math.abs(p2[0] - p1[0]);
    return pixelsPerDegree / 49;
  },

  /**
   * Get current map bounds in lat/lon
   * @returns {Object} {north, south, east, west}
   */
  getBounds() {
    return this.FINLAND_BOUNDS;
  },

  /**
   * Resize handler
   */
  resize() {
    if (!this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = rect.height || 600;

    if (this.svg) {
      this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    }

    // Recalculate projection and redraw
    this.setupProjection();
    this.drawFinland();
  },

  // Compatibility methods for existing code

  /**
   * Get map reference (for compatibility)
   */
  get map() {
    return this.svg;
  },

  /**
   * Remove a layer (for compatibility)
   */
  removeLayer(layer) {
    if (layer && layer.remove) {
      layer.remove();
    }
  },

  /**
   * Add layer to layers control (stub for compatibility)
   */
  addHeatmapLayer(layer, name) {
    console.log('Heatmap layer added:', name);
  },

  /**
   * Add interpolation layer (stub for compatibility)
   */
  addInterpolationLayer(layer, name) {
    console.log('Interpolation layer added:', name);
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapManager;
}
