# Finnish Weather Visualization System - Implementation Plan

## Overview
Create an interactive web-based visualization system for Finnish meteorological data (387k observations, 282 weather stations, 2022-2025) with time-based animation, dual heatmap modes, multi-metric selection, and special highlighting for winter progression and weather anomalies.

## Project Location
- **Base directory:** `/Users/martti.halme/dev/fmi/`
- **New directory:** `/Users/martti.halme/dev/fmi/visualization/`
- **Data sources:**
  - `weather_data_2022_2025_all.csv` (387k rows)
  - `winter_start_analysis.csv` (winter onset/end)
  - `weather_anomalies.csv` (236 anomaly events)

## Technology Stack
- **Leaflet.js** - Interactive maps
- **D3.js** - Timeline controls, color scales, custom visualizations
- **Plotly.js** - Data tables with sorting/filtering
- **Papa Parse** - Fast CSV parsing
- **Turf.js** - Geospatial calculations
- **simpleheat.js** - GPU-accelerated heatmap rendering
- **Python backend** - Simple HTTP server with polling-based progress updates

## Core Features

### 1. Time-Based Animation
- Daily slider controlling date from 2022-01-01 to 2025-12-31
- Play/pause controls with adjustable speed
- Smooth transitions between days showing weather evolution

### 2. Dual Heatmap Modes (Toggleable)
- **Mode A:** Station-based points (282 colored circles)
- **Mode B:** Interpolated smooth gradient using IDW algorithm
- Toggle switch to alternate between modes

### 3. Multi-Metric Visualization
All 6 weather metrics selectable via dropdown:
- Air temperature (mean)
- Minimum temperature
- Maximum temperature
- Snow depth
- Precipitation amount
- Ground minimum temperature

### 4. Winter Progression Visualization (Both Methods)
- **Animated winter front line:** Dashed line showing southernmost winter boundary
- **Zone gradient coloring:** Blue intensity based on days since winter start
- Synchronized with daily temperature data

### 5. Weather Anomaly Highlighting (All 5 Types Always Visible)
- **Äärimmäinen kylmyys** (Extreme cold: ≤-25°C min temp)
- **Ankara pakkasjakso** (Cold snap: ≤-15°C mean for 3+ days)
- **Hellejakso** (Heat wave: ≥25°C max for 3+ days)
- **Takatalvi** (Return winter: <0°C in spring Mar-May)
- **Äkilliset lämpötilan vaihtelut** (Temperature jumps: ±15°C daily change)

Visual encoding:
- Timeline: Stacked bars (5 rows, one per type)
- Map: Zone highlighting with type-specific colors and icons
- All types shown simultaneously with priority-based layering

### 6. Data Table View
- Plotly-based table showing current filtered data
- Sortable columns (date, zone, station, metrics)
- Filter by date range, zone, metric
- Synchronized with map and timeline

### 7. Historical Data Fetcher (Integrated)
- **Tab in main UI:** "Data Management" alongside visualization
- **Fetch modes:**
  - Manual date range selection (e.g., 2015-2021)
  - **"Refresh Latest"** - Auto-detect missing dates and fetch only gaps
- **Progress tracking (polling every 2s):**
  - Overall progress bar with percentage
  - Current quarter/zone being fetched
  - Statistics (observations, API calls, elapsed time)
  - Activity log (last 10 events)
- **Controls:** Start, Pause, Resume, Cancel
- **Backend:** Simple Python script writes progress to JSON file, frontend polls it
- **Output:** Updates parent CSV files directly (no JSON regeneration needed)

## File Structure (Modular)

```
/Users/martti.halme/dev/fmi/visualization/
├── index.html
├── css/
│   ├── main.css
│   ├── controls.css
│   ├── map.css
│   └── table.css
├── js/
│   ├── main.js                      # App initialization
│   ├── dataLoader.js                # Load CSV/JSON files
│   ├── dataProcessor.js             # Aggregation & filtering
│   ├── mapManager.js                # Leaflet map setup
│   ├── heatmapRenderer.js           # Dual mode rendering
│   ├── interpolation.js             # IDW algorithm
│   ├── timelineController.js        # Slider & animation
│   ├── anomalyOverlay.js            # Anomaly visualization
│   ├── winterProgressionLayer.js    # Winter wave & gradient
│   ├── colorScales.js               # Metric-specific gradients
│   ├── dataTable.js                 # Tabular view
│   ├── uiControls.js                # Metric selector, toggles
│   └── dataFetcher.js               # Historical data fetch UI & SSE client
├── lib/                             # Third-party libraries
│   ├── leaflet.min.js
│   ├── d3.min.js
│   ├── plotly.min.js
│   ├── papaparse.min.js
│   ├── turf.min.js
│   └── simpleheat.js
├── data/                            # Preprocessed JSON files
│   ├── daily_zone_summary.json      # Zone-aggregated daily data
│   ├── station_locations.json       # 282 station coordinates
│   ├── anomalies.json               # 236 anomaly events
│   ├── winter_starts.json           # Winter onset/end dates
│   └── precomputed_grids.json       # Pre-interpolated heatmaps
├── preprocessing/
│   ├── prepare_data.py              # Generate optimized JSONs
│   ├── generate_grids.py            # Pre-compute interpolation grids
│   └── validate_data.py             # Data quality checks
└── backend/
    ├── server.py                    # Simple HTTP server (serves static files)
    ├── fetch_worker.py              # Background worker for FMI API requests
    ├── gap_detector.py              # Detects missing dates in CSV
    └── progress.json                # Progress state file (created at runtime)
```

## Data Processing Strategy

### Python Preprocessing (One-time)
1. **Aggregate weather data:** Reduce 387k rows → ~6k zone-daily summaries
2. **Pre-compute interpolation grids:** Every 7th day × 6 metrics = ~208 grids
3. **Format anomaly data:** Add geospatial zone info
4. **Process winter progression:** Calculate daily winter status per zone
5. **Output optimized JSONs:** ~2-3MB gzipped total

Benefits:
- 67x data reduction (387k → 6k rows)
- Fast initial load (< 3 seconds)
- Smooth animation (30-60 fps)

### Client-Side Processing
- Load aggregated JSON on initialization
- Dynamically interpolate non-precomputed dates using IDW
- Cache computed grids in memory (LRU, max 50 grids)
- Binary search for date-based filtering

## IDW Interpolation Details

**Algorithm:** Inverse Distance Weighting (power = 2)
**Grid resolution:** 50×50 cells
**Search radius:** 150km (captures ~15 stations per point)
**Performance target:** < 200ms per grid computation

```
weight = 1 / distance²
interpolated_value = Σ(weight × station_value) / Σ(weight)
```

**Optimization:** Spatial indexing (quadtree) to limit station search

## Color Scales by Metric

| Metric | Range | Color Scheme |
|--------|-------|--------------|
| Air temperature | -40 to +35°C | Blue → White → Red (diverging) |
| Snow depth | 0 to 150cm | White → Dark green (sequential) |
| Precipitation | 0 to 40mm | Light blue → Dark blue (sequential) |
| Min temperature | -50 to +25°C | Dark blue → Light blue (sequential) |
| Max temperature | -30 to +40°C | Yellow → Red (sequential) |
| Ground min temp | -50 to +20°C | Purple → Orange (diverging) |

## Zone Definitions (from existing data)

| Zone | Latitude Range | Stations | Color |
|------|---------------|----------|-------|
| Etelä-Suomi | < 61.5°N | ~85 | #2E86AB (blue) |
| Keski-Suomi | 61.5° - 64.0°N | ~94 | #A23B72 (purple) |
| Pohjois-Suomi | 64.0° - 66.0°N | ~43 | #F18F01 (orange) |
| Lappi | > 66.0°N | ~53 | #C73E1D (red) |

## Anomaly Visual Encoding

| Type | Timeline Color | Map Overlay | Icon/Style |
|------|---------------|-------------|------------|
| Extreme cold | #2171b5 (dark blue) | Zone pulse | Pulsing circle |
| Cold snap | #6baed6 (light blue) | Zone fill (40% opacity) | Duration bar |
| Heat wave | #de2d26 (red) | Zone fill (40% opacity) | Duration bar |
| Return winter | #756bb1 (purple) | Icon marker | ❄️ snowflake |
| Temperature jump | #fdae6b (orange) | Flash marker | ⚡ lightning |

**Priority system when overlapping (highest to lowest):**
1. Extreme cold
2. Return winter
3. Heat wave
4. Cold snap
5. Temperature jump

## Winter Progression Visualization

### Method 1: Winter Front Line
- Animated dashed line at southernmost winter boundary
- CSS animation: `stroke-dasharray` with moving offset
- Color: #0066cc (blue)
- Updates daily as winter spreads/retreats

### Method 2: Zone Gradient
- Each zone colored by days since winter start
- Gradient: Light blue (day 1) → Deep blue (day 60+)
- 30% opacity overlay on temperature heatmap
- Toggle on/off via checkbox

**Both methods active simultaneously**

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header: Finnish Weather Visualization                   │
│ Tabs: [Visualization] [Data Management]                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ TAB 1: VISUALIZATION                                    │
│                                                         │
│ [Metric: Temp ▼] [Mode: Interpolated ▼]               │
│ [☑ Anomalies] [☑ Winter] [☑ Table]                    │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   Legend     │           MAP VIEW                       │
│   & Status   │      (Leaflet + Heatmap)                │
│              │                                          │
│  Temp Scale  │                                          │
│  Zone Status │                                          │
│  Anomalies   │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│         TIMELINE CONTROLS                               │
│  ◄◄  ▶  ►►    Speed: [===|====]                       │
│                                                         │
│  Anomaly Timeline (5 rows):                            │
│  Extreme: ▂▃▂▂▂▃▃▂▃▃▃▂                               │
│  Cold:    ━━━━━━━━━━━━                               │
│  Heat:    ━━━━━━━━━━━━                               │
│  Return:     ▃  ▃  ▃                                  │
│  Jump:    ▂  ▂▂  ▃ ▂                                 │
│                                                         │
│  [2022-01-01]━━━━●━━━━━━━━━━[2025-12-31]            │
│                2023-06-15                              │
├─────────────────────────────────────────────────────────┤
│         DATA TABLE (toggleable)                         │
│  Date │ Zone │ Station │ Temp │ Snow │ Precip        │
│  ─────┼──────┼─────────┼──────┼──────┼───────        │
│  ...  │ ...  │ ...     │ ...  │ ...  │ ...           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ TAB 2: DATA MANAGEMENT                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Fetch Mode:  ○ Date Range  ● Refresh Latest          │
│                                                         │
│  [2015-01-01] to [2021-12-31]  [Start Fetch]          │
│                                                         │
│  Status: Fetching data...          [Pause] [Resume]    │
│                                                         │
│  Overall Progress:                                     │
│  ████████████░░░░░░░░░░░░  45% (1,023/2,283 days)     │
│                                                         │
│  Current Activity:                                     │
│  Quarter: Q3 2018 (Jul-Sep)  ██████████████ 100%      │
│  Zone: Pohjois-Suomi         █████░░░ 67% (58/87)      │
│                                                         │
│  By Zone Progress:                                     │
│  ✓ Etelä-Suomi    [████████] Complete (356 days)       │
│  ✓ Keski-Suomi    [████████] Complete (356 days)       │
│  → Pohjois-Suomi  [█████░░░] 67% (58/87 days)          │
│  ○ Lappi          [░░░░░░░░] Pending...                │
│                                                         │
│  Statistics:                                           │
│  • Stations found: 267                                 │
│  • Total observations: 142,583                         │
│  • API calls made: 156 / 208                           │
│  • Rate limit delays: 12                               │
│  • Elapsed: 5m 23s                                     │
│                                                         │
│  Activity Log:                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [14:23:49] Fetching Pohjois-Suomi 2018-08-16   │  │
│  │ [14:23:47] Fetched Pohjois-Suomi 2018-08-15    │  │
│  │ [14:23:45] Rate limit: waiting 2s...           │  │
│  │ [14:23:43] Fetched Pohjois-Suomi 2018-08-14    │  │
│  │ [14:23:41] Completed Keski-Suomi Q3 2018       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  Data Coverage:                                        │
│  Current: 2022-01-01 to 2025-12-31 (1,460 days)       │
│  Missing: 45 gaps detected (use Refresh Latest)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Initial load | < 3s | Gzipped JSON, progressive loading |
| Date change | < 100ms | Binary search, cached aggregations |
| Animation frame | 30-60 fps | requestAnimationFrame, canvas rendering |
| IDW interpolation | < 200ms | Spatial indexing, pre-computed grids |
| Table update | < 50ms | Virtual scrolling (Plotly built-in) |

## Implementation Sequence

### Phase 1: Foundation & Data Pipeline (Week 1)
1. Create `/visualization/` directory structure
2. Implement `prepare_data.py` - aggregate 387k → 6k rows
3. Implement `generate_grids.py` - pre-compute 208 interpolation grids
4. Create `index.html` with basic layout
5. Setup Leaflet map with Finland bounds (59.5-70.1°N, 19.0-31.6°E)
6. Implement `dataLoader.js` - load and parse JSON files
7. Create basic timeline slider (no animation yet)

**Output:** Empty map with working date slider, data loaded in memory

### Phase 2: Core Heatmap Visualization (Week 2)
8. Implement `colorScales.js` - 6 metric-specific color gradients
9. Implement `heatmapRenderer.js` Mode A - station point rendering
10. Add metric selector dropdown - switch between 6 metrics
11. Implement `interpolation.js` - IDW algorithm with spatial indexing
12. Implement `heatmapRenderer.js` Mode B - interpolated canvas rendering
13. Add toggle switch between Mode A/B
14. Create color legend component with dynamic updates

**Output:** Working heatmap with both modes, all metrics selectable

### Phase 3: Animation & Timeline (Week 3)
15. Implement `timelineController.js` - play/pause controls
16. Add animation loop with requestAnimationFrame
17. Implement speed slider (50ms - 500ms per frame)
18. Add frame caching (pre-load next 10 frames during animation)
19. Optimize date change performance (< 100ms target)
20. Add keyboard shortcuts (Space = play/pause, arrows = step)

**Output:** Smooth animation showing weather evolution day-by-day

### Phase 4: Anomaly Integration (Week 4)
21. Implement `anomalyOverlay.js` - load and index 236 anomaly events
22. Render 5-row anomaly timeline below main slider
23. Implement zone highlighting for active anomalies
24. Add type-specific icons and colors (5 types)
25. Create anomaly tooltips with details (date, duration, temp)
26. Implement click-to-jump (click anomaly → jump to that date)
27. Add anomaly filter controls (checkboxes per type)

**Output:** All 5 anomaly types visible on timeline and map, synchronized with date

### Phase 5: Winter Progression (Week 5)
28. Implement `winterProgressionLayer.js` - load winter start/end data
29. Calculate daily winter status per zone (in/out of winter)
30. Render animated winter front line (dashed, moving south Oct-Dec)
31. Implement zone gradient coloring (days since winter start)
32. Add winter layer toggle checkbox
33. Synchronize winter overlay with temperature heatmap (30% opacity)
34. Add winter status indicators in legend (which zones currently in winter)

**Output:** Winter "wave" visualization showing progression across Finland

### Phase 6: Data Table & Polish (Week 6)
35. Implement `dataTable.js` - Plotly table component
36. Add table filtering by date range, zone, metric
37. Implement column sorting (click headers)
38. Synchronize table with map date (show current day's data)
39. Add responsive CSS for mobile/tablet (collapsible panels)
40. Performance profiling and optimization (achieve all targets)
41. Add loading indicators and error handling
42. Create usage documentation (keyboard shortcuts, controls)
43. Browser testing (Chrome, Firefox, Safari, Edge)

**Output:** Complete visualization system with table view and polished UX

### Phase 7: Historical Data Fetcher (Week 7)
44. Implement `server.py` - simple HTTP server (serves static + progress.json)
45. Implement `gap_detector.py` - scan CSV files for missing dates
46. Implement `fetch_worker.py` - background worker that writes progress to JSON
47. Create "Data Management" tab in UI
48. Implement date range selector and "Refresh Latest" mode
49. Build polling client in `dataFetcher.js` - fetch progress.json every 2s
50. Add progress bars (overall, quarter, zone-level)
51. Implement Pause/Resume/Cancel controls (writes state to control.json)
52. Add statistics dashboard (observations, API calls, elapsed time)
53. Create scrollable activity log (last 10 events)
54. Show data coverage summary (date range, gap count)
55. Test end-to-end: fetch → update CSV → reload visualization

**Output:** Integrated data fetcher with polling-based progress tracking

## Critical Files to Read/Modify

### Existing Files (Read Only)
1. `/Users/martti.halme/dev/fmi/weather_data_2022_2025_all.csv` - Primary data source
2. `/Users/martti.halme/dev/fmi/weather_anomalies.csv` - 236 anomaly events with types
3. `/Users/martti.halme/dev/fmi/winter_start_analysis.csv` - Winter onset/end dates
4. `/Users/martti.halme/dev/fmi/climate_zones_map.html` - Existing Leaflet setup (reference)
5. `/Users/martti.halme/dev/fmi/analyze_weather_anomalies.py` - Anomaly detection algorithms

### New Files to Create
1. `/Users/martti.halme/dev/fmi/visualization/preprocessing/prepare_data.py` - Data aggregation
2. `/Users/martti.halme/dev/fmi/visualization/preprocessing/generate_grids.py` - IDW pre-computation
3. `/Users/martti.halme/dev/fmi/visualization/index.html` - Main entry point
4. `/Users/martti.halme/dev/fmi/visualization/js/main.js` - Application orchestration
5. `/Users/martti.halme/dev/fmi/visualization/js/heatmapRenderer.js` - Dual-mode rendering
6. `/Users/martti.halme/dev/fmi/visualization/js/interpolation.js` - IDW algorithm
7. `/Users/martti.halme/dev/fmi/visualization/js/timelineController.js` - Animation controls
8. `/Users/martti.halme/dev/fmi/visualization/js/anomalyOverlay.js` - 5 anomaly types
9. `/Users/martti.halme/dev/fmi/visualization/js/winterProgressionLayer.js` - Winter visualization
10. `/Users/martti.halme/dev/fmi/visualization/js/dataFetcher.js` - Data fetching UI & polling client
11. `/Users/martti.halme/dev/fmi/visualization/backend/server.py` - Simple HTTP server
12. `/Users/martti.halme/dev/fmi/visualization/backend/fetch_worker.py` - Background fetch worker
13. `/Users/martti.halme/dev/fmi/visualization/backend/gap_detector.py` - Missing date detection

## Local Development Setup

**Requirements:**
- Python 3.8+ (for preprocessing and backend)
- Dependencies: `pip install pandas fmiopendata`
- Local web server (cannot use `file://` due to CORS)

**Quick Start:**
```bash
cd /Users/martti.halme/dev/fmi/visualization

# 1. Run preprocessing (one-time)
python preprocessing/prepare_data.py
python preprocessing/generate_grids.py

# 2. Start simple HTTP server
python backend/server.py
# This starts the server on http://localhost:8000

# 3. Open browser
open http://localhost:8000
```

**Usage:**
- **Visualization Tab:** Main weather visualization with all features
- **Data Management Tab:** Fetch historical data or refresh latest
  - Select "Refresh Latest" to auto-detect and fill gaps
  - Or manually select date range (e.g., 2015-2021)
  - Click "Start Fetch" → background worker starts
  - Progress updates every 2 seconds (polling)
  - Use Pause/Resume/Cancel as needed
  - When complete, reload page to see new data

## Data Size Estimates

| File | Uncompressed | Gzipped | Description |
|------|--------------|---------|-------------|
| daily_zone_summary.json | 1.2 MB | 400 KB | Zone-daily aggregates |
| station_locations.json | 150 KB | 50 KB | 282 station coords |
| anomalies.json | 80 KB | 25 KB | 236 anomaly events |
| winter_starts.json | 20 KB | 8 KB | Winter onset dates |
| precomputed_grids.json | 4 MB | 1.5 MB | Pre-interpolated grids |
| **Total** | **~5.5 MB** | **~2 MB** | All data files |

**Initial load:** 2 MB over network + ~1 second parsing = **< 3 seconds total**

## Browser Compatibility

**Primary target:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

**Feature detection:**
- Canvas API (required)
- requestAnimationFrame (with fallback to setTimeout)
- ES6 features (const/let, arrow functions, async/await)
- Fetch API (with fallback to XMLHttpRequest)

## Success Criteria

✅ **Functional:**
- All 6 metrics visualizable with both heatmap modes
- Smooth daily animation (30+ fps)
- All 5 anomaly types highlighted correctly
- Winter progression shows both front line and gradient
- Data table synchronized with map
- Historical data fetcher with polling-based progress tracking (2s interval)
- "Refresh Latest" auto-detects and fills missing dates
- Pause/Resume/Cancel controls work correctly

✅ **Performance:**
- Initial load < 3 seconds
- Date change < 100ms
- Animation maintains 30-60 fps
- No memory leaks during extended use

✅ **User Experience:**
- Intuitive controls (no tutorial needed)
- Responsive design (desktop/tablet/mobile)
- Clear visual encoding for anomalies
- Smooth transitions between states

## Future Enhancements (Out of Scope)

- CSV export functionality
- Station-specific detail views
- Comparison mode (side-by-side dates)
- Mobile native apps
- Real-time FMI API integration
- Predictive analytics

---

**Total Estimated Time:** 7 weeks (1 developer)
- Weeks 1-6: Core visualization system
- Week 7: Historical data fetcher integration

**Deliverable:** Self-contained `/visualization/` directory with:
- Interactive weather visualization (all 6 metrics, 2 heatmap modes)
- Anomaly and winter progression highlighting
- Integrated historical data fetcher with progress tracking
- Complete documentation and usage guide
