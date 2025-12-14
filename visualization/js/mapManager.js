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

    // Create clip path for Finland shape
    let defs = this.svg.select('defs');
    if (defs.empty()) {
      defs = this.svg.insert('defs', ':first-child');
    }
    defs.selectAll('#finland-clip').remove();

    defs.append('clipPath')
      .attr('id', 'finland-clip')
      .append('path')
      .datum(this.finlandGeoJSON)
      .attr('d', this.path);

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
   * Add interpolation circles with radial gradient (for smooth heatmap effect)
   * @param {Array} circles - Array of {lat, lon, radius, color, opacity}
   */
  addInterpolationCircles(circles) {
    if (!this.layers.heatmap || !this.projection) return;

    // Ensure defs exists for gradients
    let defs = this.svg.select('defs');
    if (defs.empty()) {
      defs = this.svg.insert('defs', ':first-child');
    }

    circles.forEach((circle, index) => {
      const [x, y] = this.latLonToPixel(circle.lat, circle.lon);

      // Convert km radius to pixels (approximate)
      const scale = this.getScaleFactor();
      const pixelRadius = circle.radius * scale;

      // Create unique gradient ID for this circle
      const gradientId = `interpolation-gradient-${index}`;

      // Remove existing gradient with same ID
      defs.select(`#${gradientId}`).remove();

      // Create radial gradient that fades from center color to transparent
      const gradient = defs.append('radialGradient')
        .attr('id', gradientId)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');

      // Gradient stops: solid color in center, fading to transparent at edges
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', circle.color)
        .attr('stop-opacity', circle.opacity || 0.5);

      gradient.append('stop')
        .attr('offset', '60%')
        .attr('stop-color', circle.color)
        .attr('stop-opacity', (circle.opacity || 0.5) * 0.5);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', circle.color)
        .attr('stop-opacity', 0);

      this.layers.heatmap.append('circle')
        .attr('class', 'interpolation-circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', pixelRadius)
        .attr('fill', `url(#${gradientId})`)
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
   * Add Voronoi cells for stations, clipped to Finland borders
   * @param {Array} stations - Array of {lat, lon, color, value}
   */
  addVoronoiCells(stations) {
    if (!this.layers.heatmap || !this.projection || !this.finlandGeoJSON) return;

    // Clear existing heatmap elements
    this.layers.heatmap.selectAll('*').remove();

    if (stations.length === 0) return;

    // Convert stations to pixel coordinates
    const points = stations.map(station => {
      const [x, y] = this.latLonToPixel(station.lat, station.lon);
      return { x, y, color: station.color, value: station.value, station };
    });

    // Create Delaunay triangulation and Voronoi diagram
    const delaunay = d3.Delaunay.from(points, d => d.x, d => d.y);

    // Use large bounds to ensure all cells extend beyond Finland
    const voronoi = delaunay.voronoi([-500, -500, this.width + 500, this.height + 500]);

    // Create a group for Voronoi cells, clipped to Finland shape
    const voronoiGroup = this.layers.heatmap.append('g')
      .attr('class', 'voronoi-cells')
      .attr('clip-path', 'url(#finland-clip)');

    // Draw each Voronoi cell
    points.forEach((point, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return;

      // Convert cell polygon to path string
      const pathData = 'M' + cell.map(p => p.join(',')).join('L') + 'Z';

      voronoiGroup.append('path')
        .attr('class', 'voronoi-cell')
        .attr('d', pathData)
        .attr('fill', point.color)
        .attr('fill-opacity', 0.85)
        .attr('stroke', 'none')
        .datum(point.station);
    });

    console.log(`Rendered ${points.length} Voronoi cells`);
  },

  /**
   * Add hexagonal grid visualization
   * @param {Array} stations - Array of {lat, lon, color, value}
   * @param {number} hexRadius - Radius of hexagons in pixels (default 25)
   */
  addHexagonGrid(stations, hexRadius = 25) {
    if (!this.layers.heatmap || !this.projection || !this.finlandGeoJSON) return;

    // Clear existing heatmap elements
    this.layers.heatmap.selectAll('*').remove();

    if (stations.length === 0) return;

    // Convert stations to pixel coordinates with values
    const points = stations.map(station => {
      const [x, y] = this.latLonToPixel(station.lat, station.lon);
      return { x, y, color: station.color, value: station.value };
    });

    // Create hexagonal grid covering Finland bounds
    const hexHeight = hexRadius * 2;
    const hexWidth = Math.sqrt(3) * hexRadius;
    const vertSpacing = hexHeight * 0.75;

    // Get projected bounds of Finland
    const topLeft = this.latLonToPixel(this.FINLAND_BOUNDS.north, this.FINLAND_BOUNDS.west);
    const bottomRight = this.latLonToPixel(this.FINLAND_BOUNDS.south, this.FINLAND_BOUNDS.east);

    const minX = Math.min(topLeft[0], bottomRight[0]) - hexWidth;
    const maxX = Math.max(topLeft[0], bottomRight[0]) + hexWidth;
    const minY = Math.min(topLeft[1], bottomRight[1]) - hexHeight;
    const maxY = Math.max(topLeft[1], bottomRight[1]) + hexHeight;

    // Create hexagon path generator
    const hexagonPath = (cx, cy, r) => {
      const angles = [0, 60, 120, 180, 240, 300].map(a => a * Math.PI / 180);
      const pts = angles.map(a => [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      return 'M' + pts.map(p => p.join(',')).join('L') + 'Z';
    };

    // Create a group for hexagons, clipped to Finland shape
    const hexGroup = this.layers.heatmap.append('g')
      .attr('class', 'hexagon-grid')
      .attr('clip-path', 'url(#finland-clip)');

    // Generate hexagons and interpolate values
    let row = 0;
    for (let y = minY; y <= maxY; y += vertSpacing) {
      const xOffset = (row % 2) * (hexWidth / 2);
      for (let x = minX + xOffset; x <= maxX; x += hexWidth) {
        // Find nearest stations and interpolate color using IDW
        const interpolatedColor = this._interpolateColorIDW(x, y, points, 2);
        if (!interpolatedColor) continue;

        hexGroup.append('path')
          .attr('class', 'hex-cell')
          .attr('d', hexagonPath(x, y, hexRadius))
          .attr('fill', interpolatedColor)
          .attr('fill-opacity', 0.85)
          .attr('stroke', 'rgba(255,255,255,0.1)')
          .attr('stroke-width', 0.5);
      }
      row++;
    }

    console.log(`Rendered hexagonal grid`);
  },

  /**
   * Interpolate color at a point using Inverse Distance Weighting
   * @private
   */
  _interpolateColorIDW(x, y, points, power = 2) {
    if (points.length === 0) return null;

    let totalWeight = 0;
    let weightedR = 0, weightedG = 0, weightedB = 0;
    const epsilon = 0.0001;

    points.forEach(point => {
      const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      const weight = 1 / Math.pow(dist + epsilon, power);

      // Parse color
      const rgb = this._parseColor(point.color);
      if (rgb) {
        weightedR += rgb.r * weight;
        weightedG += rgb.g * weight;
        weightedB += rgb.b * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return null;

    const r = Math.round(weightedR / totalWeight);
    const g = Math.round(weightedG / totalWeight);
    const b = Math.round(weightedB / totalWeight);

    return `rgb(${r},${g},${b})`;
  },

  /**
   * Parse color string to RGB object
   * @private
   */
  _parseColor(color) {
    if (!color) return null;

    // Handle rgb() format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    }

    // Handle hex format
    const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      return { r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16), b: parseInt(hexMatch[3], 16) };
    }

    return null;
  },

  /**
   * Add contour lines visualization (isobar-style)
   * @param {Array} stations - Array of {lat, lon, value}
   * @param {Function} colorScale - Function to get color for value
   * @param {Array} thresholds - Array of contour threshold values
   */
  addContourLines(stations, colorScale, thresholds) {
    if (!this.layers.heatmap || !this.projection || !this.finlandGeoJSON) return;

    // Clear existing heatmap elements
    this.layers.heatmap.selectAll('*').remove();

    if (stations.length === 0) return;

    // Create a grid of interpolated values
    const gridSize = 60; // Balanced resolution for quality and performance (3600 points)
    const topLeft = this.latLonToPixel(this.FINLAND_BOUNDS.north, this.FINLAND_BOUNDS.west);
    const bottomRight = this.latLonToPixel(this.FINLAND_BOUNDS.south, this.FINLAND_BOUNDS.east);

    const minX = Math.min(topLeft[0], bottomRight[0]);
    const maxX = Math.max(topLeft[0], bottomRight[0]);
    const minY = Math.min(topLeft[1], bottomRight[1]);
    const maxY = Math.max(topLeft[1], bottomRight[1]);

    const stepX = (maxX - minX) / gridSize;
    const stepY = (maxY - minY) / gridSize;

    // Convert stations to pixel coordinates
    const points = stations.map(station => {
      const [x, y] = this.latLonToPixel(station.lat, station.lon);
      return { x, y, value: station.value };
    });

    // Generate grid values using optimized IDW interpolation (limits to nearest neighbors)
    const values = new Array(gridSize * gridSize);
    for (let j = 0; j < gridSize; j++) {
      for (let i = 0; i < gridSize; i++) {
        const x = minX + i * stepX;
        const y = minY + j * stepY;
        values[j * gridSize + i] = this._interpolateValueIDWOptimized(x, y, points, 2, 15);
      }
    }

    // Create contour generator
    const contours = d3.contours()
      .size([gridSize, gridSize])
      .thresholds(thresholds);

    // Generate contours
    const contourData = contours(values);

    // Create transform to map grid coordinates to screen coordinates
    const transform = d3.geoTransform({
      point: function(x, y) {
        this.stream.point(minX + x * stepX, minY + y * stepY);
      }
    });
    const contourPath = d3.geoPath().projection(transform);

    // Create a group for contours, clipped to Finland shape
    const contourGroup = this.layers.heatmap.append('g')
      .attr('class', 'contour-lines')
      .attr('clip-path', 'url(#finland-clip)');

    // Draw filled contour bands
    contourData.forEach((contour, i) => {
      const color = colorScale.getColor(contour.value);

      contourGroup.append('path')
        .attr('class', 'contour-band')
        .attr('d', contourPath(contour))
        .attr('fill', color)
        .attr('fill-opacity', 0.7)
        .attr('stroke', 'rgba(0,0,0,0.3)')
        .attr('stroke-width', 0.5);
    });

    console.log(`Rendered ${contourData.length} contour bands`);
  },

  /**
   * Interpolate value at a point using IDW
   * @private
   */
  _interpolateValueIDW(x, y, points, power = 2) {
    if (points.length === 0) return 0;

    let totalWeight = 0;
    let weightedValue = 0;
    const epsilon = 0.0001;

    points.forEach(point => {
      const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      const weight = 1 / Math.pow(dist + epsilon, power);

      weightedValue += point.value * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedValue / totalWeight : 0;
  },

  /**
   * Optimized IDW interpolation - only uses nearest neighbors for better performance
   * Uses partial sorting to avoid full sort of all stations
   * @private
   */
  _interpolateValueIDWOptimized(x, y, points, power = 2, maxNeighbors = 15) {
    if (points.length === 0) return 0;

    // For small datasets, use all points
    if (points.length <= maxNeighbors) {
      let totalWeight = 0;
      let weightedValue = 0;
      const epsilon = 0.0001;

      points.forEach(point => {
        const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
        const weight = 1 / Math.pow(dist + epsilon, power);
        weightedValue += point.value * weight;
        totalWeight += weight;
      });

      return totalWeight > 0 ? weightedValue / totalWeight : 0;
    }

    // For larger datasets, find nearest neighbors using partial sort
    const nearestPoints = [];

    // Calculate distances and maintain a max-heap of k nearest neighbors
    points.forEach(point => {
      const distSq = (x - point.x) ** 2 + (y - point.y) ** 2;

      if (nearestPoints.length < maxNeighbors) {
        nearestPoints.push({ distSq, value: point.value });
        if (nearestPoints.length === maxNeighbors) {
          // Sort once when we reach k neighbors
          nearestPoints.sort((a, b) => b.distSq - a.distSq);
        }
      } else if (distSq < nearestPoints[0].distSq) {
        // Replace furthest neighbor
        nearestPoints[0] = { distSq, value: point.value };
        // Bubble down to maintain heap property
        let idx = 0;
        while (idx * 2 + 1 < maxNeighbors) {
          let maxIdx = idx;
          const left = idx * 2 + 1;
          const right = idx * 2 + 2;

          if (left < nearestPoints.length && nearestPoints[left].distSq > nearestPoints[maxIdx].distSq) {
            maxIdx = left;
          }
          if (right < nearestPoints.length && nearestPoints[right].distSq > nearestPoints[maxIdx].distSq) {
            maxIdx = right;
          }

          if (maxIdx === idx) break;

          [nearestPoints[idx], nearestPoints[maxIdx]] = [nearestPoints[maxIdx], nearestPoints[idx]];
          idx = maxIdx;
        }
      }
    });

    // Perform IDW on nearest neighbors only
    let totalWeight = 0;
    let weightedValue = 0;
    const epsilon = 0.0001;

    nearestPoints.forEach(point => {
      const dist = Math.sqrt(point.distSq);
      const weight = 1 / Math.pow(dist + epsilon, power);
      weightedValue += point.value * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedValue / totalWeight : 0;
  },

  /**
   * Add rasterized IDW heatmap using canvas
   * @param {Array} stations - Array of {lat, lon, value}
   * @param {Object} colorScale - Color scale with getColor method
   * @param {number} resolution - Grid resolution (default 150)
   */
  addRasterHeatmap(stations, colorScale, resolution = 150) {
    if (!this.layers.heatmap || !this.projection || !this.finlandGeoJSON) return;

    // Clear existing heatmap elements
    this.layers.heatmap.selectAll('*').remove();

    if (stations.length === 0) return;

    // Get projected bounds of Finland
    const topLeft = this.latLonToPixel(this.FINLAND_BOUNDS.north, this.FINLAND_BOUNDS.west);
    const bottomRight = this.latLonToPixel(this.FINLAND_BOUNDS.south, this.FINLAND_BOUNDS.east);

    const minX = Math.min(topLeft[0], bottomRight[0]);
    const maxX = Math.max(topLeft[0], bottomRight[0]);
    const minY = Math.min(topLeft[1], bottomRight[1]);
    const maxY = Math.max(topLeft[1], bottomRight[1]);

    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);

    // Convert stations to pixel coordinates
    const points = stations.map(station => {
      const [x, y] = this.latLonToPixel(station.lat, station.lon);
      return { x: x - minX, y: y - minY, value: station.value };
    });

    // Create off-screen canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = Math.round(resolution * (height / width));
    const ctx = canvas.getContext('2d');

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;

    // Scale points to canvas coordinates
    const scaledPoints = points.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
      value: p.value
    }));

    // Create ImageData and fill with interpolated values
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Optimized IDW interpolation (nearest neighbors only)
        const value = this._interpolateValueIDWOptimized(x, y, scaledPoints, 2, 15);
        const color = colorScale.getColor(value);
        const rgb = this._parseColor(color);

        const idx = (y * canvas.width + x) * 4;
        if (rgb) {
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 220; // Alpha
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Add canvas as foreignObject in SVG, clipped to Finland
    const fo = this.layers.heatmap.append('foreignObject')
      .attr('x', minX)
      .attr('y', minY)
      .attr('width', width)
      .attr('height', height)
      .attr('clip-path', 'url(#finland-clip)');

    // Create img element from canvas
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.imageRendering = 'auto';

    fo.node().appendChild(img);

    console.log(`Rendered raster heatmap ${canvas.width}x${canvas.height}`);
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
  },

  // Zone latitude boundaries
  ZONE_BOUNDARIES: {
    'Etelä-Suomi': { latMin: 59.5, latMax: 61.5 },
    'Keski-Suomi': { latMin: 61.5, latMax: 64.0 },
    'Pohjois-Suomi': { latMin: 64.0, latMax: 66.0 },
    'Lappi': { latMin: 66.0, latMax: 70.1 }
  },

  /**
   * Highlight a climate zone on the map
   * @param {string} zoneName - Zone name (e.g., "Etelä-Suomi")
   */
  highlightZone(zoneName) {
    if (!this.projection || !this.g) return;

    // Remove existing highlight
    this.clearZoneHighlight();

    const bounds = this.ZONE_BOUNDARIES[zoneName];
    if (!bounds) return;

    // Finland's approximate longitude bounds
    const lonMin = 19.0;
    const lonMax = 31.6;

    // Create rectangle coordinates
    const topLeft = this.projection([lonMin, bounds.latMax]);
    const topRight = this.projection([lonMax, bounds.latMax]);
    const bottomLeft = this.projection([lonMin, bounds.latMin]);
    const bottomRight = this.projection([lonMax, bounds.latMin]);

    if (!topLeft || !bottomRight) return;

    // Create highlight layer if not exists - insert AFTER border layer so it appears on top
    if (!this.layers.zoneHighlight) {
      this.layers.zoneHighlight = this.g.append('g')
        .attr('class', 'layer-zone-highlight');
    }

    // Draw highlight rectangle clipped to Finland shape
    this.layers.zoneHighlight.append('rect')
      .attr('class', 'zone-highlight')
      .attr('x', topLeft[0])
      .attr('y', topLeft[1])
      .attr('width', topRight[0] - topLeft[0])
      .attr('height', bottomLeft[1] - topLeft[1])
      .attr('fill', 'rgba(255, 193, 7, 0.4)')
      .attr('stroke', 'none')
      .attr('clip-path', 'url(#finland-clip)')
      .attr('pointer-events', 'none');

    // Draw zone boundary lines (horizontal lines at lat boundaries)
    const drawBoundaryLine = (lat) => {
      const leftPoint = this.projection([lonMin, lat]);
      const rightPoint = this.projection([lonMax, lat]);
      if (leftPoint && rightPoint) {
        this.layers.zoneHighlight.append('line')
          .attr('class', 'zone-highlight')
          .attr('x1', leftPoint[0])
          .attr('y1', leftPoint[1])
          .attr('x2', rightPoint[0])
          .attr('y2', rightPoint[1])
          .attr('stroke', 'rgba(255, 152, 0, 0.9)')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6,3')
          .attr('clip-path', 'url(#finland-clip)')
          .attr('pointer-events', 'none');
      }
    };

    // Draw boundary lines at zone edges
    drawBoundaryLine(bounds.latMin);
    drawBoundaryLine(bounds.latMax);
  },

  /**
   * Clear zone highlight from map
   */
  clearZoneHighlight() {
    if (this.layers.zoneHighlight) {
      this.layers.zoneHighlight.selectAll('.zone-highlight').remove();
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapManager;
}
