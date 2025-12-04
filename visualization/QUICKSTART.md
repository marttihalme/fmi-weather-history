# Quick Start Guide

## 3-Step Setup

### 1. Preprocess Data (One-time)

```bash
cd /Users/martti.halme/dev/fmi-weather-history

# Activate virtual environment (if using one)
source venv/bin/activate

# Generate aggregated JSON files (~2 minutes)
python visualization/preprocessing/prepare_data.py

# OPTIONAL: Pre-compute interpolation grids (~20-30 minutes)
# You can skip this - the app will use real-time interpolation
python visualization/preprocessing/generate_grids.py
```

### 2. Start Server

```bash
python visualization/backend/server.py
```

You should see:
```
Finnish Weather Visualization - HTTP Server
============================================================
Serving from: /Users/martti.halme/dev/fmi-weather-history/visualization
Server URL: http://localhost:8000

✓ Server running at http://localhost:8000
✓ Open in browser: http://localhost:8000/index.html
```

### 3. Open Browser

Navigate to: **http://localhost:8000/index.html**

## First-Time Usage

1. **Select a metric** (default: Air Temperature)
2. **Choose heatmap mode**:
   - **Stations**: Fast, shows station points
   - **Interpolated**: Smooth gradient (slower without precomputed grids)
3. **Use the timeline**:
   - Drag slider to change date
   - Click ▶ to animate
4. **Explore the map**:
   - Zoom/pan
   - Click markers for details

## Troubleshooting

### "Data files missing"
Run: `python visualization/preprocessing/prepare_data.py`

### Slow performance
- Use "Stations" mode instead of "Interpolated"
- Wait for `generate_grids.py` to complete (if running)
- Close other browser tabs

### Port already in use
Change PORT in `backend/server.py` or:
```bash
lsof -ti:8000 | xargs kill -9
python visualization/backend/server.py
```

## Controls

**Timeline:**
- ◄◄ First day
- ◄ Previous day
- ▶ Play/Pause (Space key)
- ► Next day
- ►► Last day

**Map:**
- Mouse drag: Pan
- Scroll: Zoom
- Click marker: Show details

**Keyboard:**
- Space: Play/Pause
- ← →: Previous/Next day
- Home/End: First/Last day

## What to Expect

- **Data range**: 2022-01-01 to 2025-12-02
- **Stations**: 294 weather stations across Finland
- **Observations**: 387,591 total measurements
- **Metrics**: 6 different weather parameters
- **Anomalies**: 234 weather events highlighted
- **Zones**: 4 climate zones (South, Central, North, Lapland)

## Next Steps

1. Read [README.md](README.md) for full documentation
2. Explore different metrics and time periods
3. Check anomaly timeline for extreme weather events
4. Use data table view for detailed analysis

Enjoy exploring Finnish weather patterns!
