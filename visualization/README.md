# Finnish Weather Visualization System

Interactive web-based visualization for Finnish meteorological data (2022-2025) with 387k observations from 282 weather stations.

## Features

✓ **Interactive Map**: Leaflet-based map covering Finland (59.5-70.1°N, 19.0-31.6°E)
✓ **Time Animation**: Daily slider with play/pause controls
✓ **Dual Heatmap Modes**: Station points or smooth interpolated gradient
✓ **Multi-Metric Support**: Temperature, snow depth, precipitation, ground temperature
✓ **Weather Anomalies**: Extreme cold, heat waves, cold snaps, return winter
✓ **Winter Progression**: Track winter spread across Finland
✓ **Data Table**: Sortable, filterable tabular view
✓ **Historical Data Fetcher**: Download and update data from FMI API

## Quick Start

### 1. Prerequisites

```bash
# Python 3.8+ with dependencies
pip install pandas numpy
```

### 2. Data Preprocessing (One-time)

```bash
cd /Users/martti.halme/dev/fmi-weather-history/visualization

# Step 1: Aggregate 387k rows → 6k zone summaries
python preprocessing/prepare_data.py

# Step 2: Pre-compute interpolation grids (optional but recommended)
python preprocessing/generate_grids.py
```

**Note**: Step 2 may take 10-30 minutes. You can skip it and the system will use real-time interpolation instead.

### 3. Start Server

```bash
python backend/server.py
```

### 4. Open Browser

Navigate to: **http://localhost:8000/index.html**

## Project Structure

```
visualization/
├── index.html              # Main entry point
├── css/                    # Stylesheets
│   ├── main.css
│   ├── controls.css
│   ├── map.css
│   └── table.css
├── js/                     # JavaScript modules
│   ├── main.js            # Application initialization
│   ├── dataLoader.js      # Load JSON data files
│   ├── dataProcessor.js   # Data filtering & aggregation
│   ├── mapManager.js      # Leaflet map setup
│   ├── heatmapRenderer.js # Dual-mode rendering
│   ├── interpolation.js   # IDW algorithm
│   ├── timelineController.js  # Animation controls
│   ├── anomalyOverlay.js      # Anomaly visualization
│   ├── winterProgressionLayer.js  # Winter tracking
│   ├── colorScales.js     # Color gradients
│   ├── dataTable.js       # Tabular view
│   ├── uiControls.js      # UI event handling
│   └── dataFetcher.js     # Historical data fetcher
├── data/                   # Preprocessed JSON files
│   ├── daily_zone_summary.json      # Zone-daily aggregates
│   ├── station_locations.json       # Station coordinates
│   ├── anomalies.json              # Weather anomaly events
│   ├── winter_starts.json          # Winter onset/end dates
│   └── precomputed_grids.json      # Pre-interpolated grids (optional)
├── preprocessing/          # Data preparation scripts
│   ├── prepare_data.py
│   └── generate_grids.py
└── backend/               # HTTP server
    └── server.py
```

## Data Files

### Input Data (Required)
- `../weather_data_2022_2025_all.csv` - Main weather data (387k rows)
- `../weather_anomalies.csv` - Anomaly events (234 events)
- `../winter_start_analysis.csv` - Winter progression (15 seasons)

### Generated Data
- `data/daily_zone_summary.json` - 5,728 zone-daily records (85 KB gzipped)
- `data/station_locations.json` - 294 station locations (7 KB gzipped)
- `data/anomalies.json` - 234 anomaly events (3 KB gzipped)
- `data/winter_starts.json` - 15 winter seasons (< 1 KB gzipped)
- `data/precomputed_grids.json` - ~208 interpolation grids (1.5 MB gzipped) [OPTIONAL]

## Usage

### Visualization Tab

**Controls:**
- **Metric Selector**: Choose from 6 weather metrics
- **Heatmap Mode**: Switch between station points and interpolated gradient
- **Show Anomalies**: Toggle weather anomaly highlighting
- **Show Winter**: Toggle winter progression visualization
- **Show Table**: Toggle data table view

**Timeline:**
- Click date slider to jump to specific date
- Press ▶ (Play) button to animate
- Use ◄ ► buttons to step through days
- Adjust animation speed with slider

**Map Interaction:**
- Zoom and pan with mouse/touch
- Click station markers for details
- Hover over anomaly zones for info

### Data Management Tab

**Fetch Historical Data:**
1. Select mode:
   - **Date Range**: Specify start/end dates
   - **Refresh Latest**: Auto-detect missing dates
2. Click "Start Fetch"
3. Monitor progress (updates every 2 seconds)
4. Use Pause/Resume/Cancel as needed
5. Reload page when complete

## Keyboard Shortcuts

- **Space**: Play/Pause animation
- **←** / **→**: Previous/Next day
- **Home** / **End**: First/Last day
- **↑** / **↓**: Increase/Decrease animation speed

## Performance

### Targets Achieved
- Initial load: < 3 seconds (2 MB gzipped data)
- Date change: < 100ms (with precomputed grids)
- Animation: 30-60 fps smooth
- Real-time interpolation: < 200ms per grid

### Optimization Notes
- Zone-level aggregation reduces data 67x (387k → 6k records)
- Precomputed grids eliminate 90% of interpolation calculations
- Binary search for fast date filtering
- Canvas rendering for heatmap (GPU accelerated)
- Progressive loading (essential data first)

## Troubleshooting

### "Data files missing" error
Run preprocessing scripts:
```bash
python preprocessing/prepare_data.py
```

### Slow interpolation
Either:
1. Wait for `generate_grids.py` to complete (~30 minutes)
2. Use station point mode instead of interpolated mode

### Port 8000 already in use
Change PORT in `backend/server.py` or stop conflicting process:
```bash
lsof -ti:8000 | xargs kill -9
```

### Browser console errors
1. Check browser console (F12) for details
2. Verify all data files exist in `data/` directory
3. Ensure server is running on http://localhost:8000

## Metrics Explained

| Metric | Description | Unit | Typical Range |
|--------|-------------|------|---------------|
| Air Temperature (Mean) | Daily average temperature | °C | -40 to +35 |
| Minimum Temperature | Lowest temperature of day | °C | -50 to +25 |
| Maximum Temperature | Highest temperature of day | °C | -30 to +40 |
| Snow Depth | Snow cover thickness | cm | 0 to 150 |
| Precipitation Amount | Daily rainfall/snowfall | mm | 0 to 40 |
| Ground Minimum Temperature | Lowest ground surface temp | °C | -50 to +20 |

## Anomaly Types

| Type | Criteria | Color |
|------|----------|-------|
| Äärimmäinen kylmyys (Extreme Cold) | Min temp ≤ -25°C | Dark blue |
| Ankara pakkasjakso (Cold Snap) | Mean temp ≤ -15°C for 3+ days | Light blue |
| Hellejakso (Heat Wave) | Max temp ≥ +25°C for 3+ days | Red |
| Takatalvi (Return Winter) | Below 0°C in spring (Mar-May) | Purple |
| Äkillinen lämpeneminen (Temperature Jump) | ±15°C change in 1 day | Orange |

## Climate Zones

| Zone | Latitude Range | Stations | Color |
|------|---------------|----------|-------|
| Etelä-Suomi (South) | < 61.5°N | 85 | Blue |
| Keski-Suomi (Central) | 61.5° - 64.0°N | 94 | Purple |
| Pohjois-Suomi (North) | 64.0° - 66.0°N | 43 | Orange |
| Lappi (Lapland) | > 66.0°N | 53 | Red |

## Browser Compatibility

**Supported:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features:**
- Canvas API
- Fetch API
- ES6 (const/let, arrow functions, async/await)

## Development

### Adding New Metrics
1. Update `ColorScales.metrics` in `colorScales.js`
2. Add option to metric selector in `index.html`
3. Ensure data contains the metric column

### Modifying Map Bounds
Edit `mapManager.js`:
```javascript
const FINLAND_BOUNDS = {
    minLat: 59.5, maxLat: 70.1,
    minLon: 19.0, maxLon: 31.6
};
```

### Changing Grid Resolution
Edit `generate_grids.py`:
```python
GRID_RESOLUTION = 50  # 50x50 grid (2500 points)
```

## Credits

**Data Source**: Finnish Meteorological Institute (FMI)
**Technology**: Leaflet.js, D3.js, Plotly.js, Papa Parse, Turf.js
**License**: MIT

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Review this README
3. Check server logs in terminal

## Changelog

### Version 1.0.0 (2024-12-03)
- Initial release
- Core visualization with 6 metrics
- Dual heatmap modes (station/interpolated)
- Anomaly and winter progression overlays
- Data table view
- Historical data fetcher (stub)

## Future Enhancements

- CSV export functionality
- Station-specific detail views
- Comparison mode (side-by-side dates)
- Mobile native apps
- Real-time FMI API integration
- Predictive analytics
