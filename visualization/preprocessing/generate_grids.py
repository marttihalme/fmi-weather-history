#!/usr/bin/env python3
"""
Pre-compute IDW interpolation grids for smooth heatmap rendering.
Generates grids for every 7th day to reduce file size (~208 grids total).

# Input:  ../data/daily_zone_summary.json
#         ../data/raw/weather_data_2022_2025_all.csv (for station-level data)
# Output: ../data/precomputed_grids.json (~1.5 MB gzipped)
"""

import pandas as pd
import json
import gzip
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from math import sqrt

# Paths
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "visualization" / "data"

# Grid configuration
GRID_RESOLUTION = 50  # 50x50 grid
SEARCH_RADIUS_KM = 150  # km
POWER = 2  # IDW power parameter
SAMPLE_INTERVAL = 7  # Generate grid every 7 days

# Finland bounds
LAT_MIN, LAT_MAX = 59.5, 70.1
LON_MIN, LON_MAX = 19.0, 31.6

print("IDW Grid Pre-computation")
print("=" * 50)

# Haversine distance calculation
def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two coordinates"""
    R = 6371  # Earth radius in km

    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

# IDW interpolation
def idw_interpolate(stations_df, grid_lat, grid_lon, metric, search_radius_km=SEARCH_RADIUS_KM, power=POWER):
    """
    Inverse Distance Weighting interpolation for a single grid point

    Args:
        stations_df: DataFrame with columns [latitude, longitude, metric_value]
        grid_lat, grid_lon: Grid point coordinates
        metric: Column name of the metric to interpolate
        search_radius_km: Maximum distance to consider stations
        power: IDW power parameter (typically 2)

    Returns:
        Interpolated value or None if no stations within radius
    """
    # Calculate distances to all stations
    distances = []
    values = []

    for _, station in stations_df.iterrows():
        if pd.isna(station[metric]):
            continue

        dist = haversine_distance(grid_lat, grid_lon, station['latitude'], station['longitude'])

        if dist < search_radius_km:
            # Handle exact match (distance = 0)
            if dist < 0.01:  # Very close (< 10m)
                return station[metric]

            distances.append(dist)
            values.append(station[metric])

    # Need at least one station
    if len(distances) == 0:
        return None

    # IDW calculation: weight = 1 / distance^power
    weights = [1.0 / (d ** power) for d in distances]
    total_weight = sum(weights)

    interpolated = sum(w * v for w, v in zip(weights, values)) / total_weight
    return round(interpolated, 1)

# Create grid coordinates
print(f"\n1. Creating {GRID_RESOLUTION}x{GRID_RESOLUTION} grid...")
lats = np.linspace(LAT_MIN, LAT_MAX, GRID_RESOLUTION)
lons = np.linspace(LON_MIN, LON_MAX, GRID_RESOLUTION)

grid_points = []
for lat in lats:
    for lon in lons:
        grid_points.append({'lat': round(lat, 4), 'lon': round(lon, 4)})

print(f"   Grid points: {len(grid_points)}")
print(f"   Latitude range: {LAT_MIN}° to {LAT_MAX}°")
print(f"   Longitude range: {LON_MIN}° to {LON_MAX}°")

# Load station data
print("\n2. Loading weather data...")
df = pd.read_csv(BASE_DIR / "data" / "raw" / "weather_data_2022_2025_all.csv")
df['date'] = pd.to_datetime(df['date'])

print(f"   Loaded {len(df):,} observations")
print(f"   Date range: {df['date'].min().date()} to {df['date'].max().date()}")

# Metrics to interpolate
metrics = [
    ('Air temperature', 'temp_mean'),
    ('Minimum temperature', 'temp_min'),
    ('Maximum temperature', 'temp_max'),
    ('Snow depth', 'snow_depth'),
    ('Precipitation amount', 'precipitation'),
    ('Ground minimum temperature', 'ground_temp_min')
]

# Generate sample dates (every 7th day)
start_date = df['date'].min()
end_date = df['date'].max()
sample_dates = []
current_date = start_date

while current_date <= end_date:
    sample_dates.append(current_date)
    current_date += timedelta(days=SAMPLE_INTERVAL)

print(f"\n3. Sampling dates (every {SAMPLE_INTERVAL} days)...")
print(f"   Sample dates: {len(sample_dates)}")
print(f"   Total grids to generate: {len(sample_dates) * len(metrics)}")

# Pre-compute grids
print(f"\n4. Computing IDW grids...")
all_grids = []
total_grids = len(sample_dates) * len(metrics)
grid_count = 0

for date in sample_dates:
    date_str = date.strftime('%Y-%m-%d')
    day_data = df[df['date'] == date]

    if len(day_data) == 0:
        continue

    for metric_col, metric_name in metrics:
        grid_count += 1

        # Interpolate grid
        grid_values = []
        for point in grid_points:
            value = idw_interpolate(day_data, point['lat'], point['lon'], metric_col)
            grid_values.append(value)

        # Store grid
        all_grids.append({
            'date': date_str,
            'metric': metric_name,
            'resolution': GRID_RESOLUTION,
            'bounds': {
                'lat_min': LAT_MIN,
                'lat_max': LAT_MAX,
                'lon_min': LON_MIN,
                'lon_max': LON_MAX
            },
            'values': grid_values  # Flat array of length GRID_RESOLUTION^2
        })

        if grid_count % 10 == 0 or grid_count == total_grids:
            progress = (grid_count / total_grids) * 100
            print(f"   Progress: {grid_count}/{total_grids} ({progress:.1f}%) - {date_str} {metric_name}")

# Save grids
print(f"\n5. Saving pre-computed grids...")

# Save uncompressed JSON
output_file = DATA_DIR / "precomputed_grids.json"
with open(output_file, 'w') as f:
    json.dump(all_grids, f)
size_mb = output_file.stat().st_size / (1024 * 1024)
print(f"   Saved: {output_file} ({size_mb:.1f} MB)")

# Save gzipped JSON
output_file_gz = DATA_DIR / "precomputed_grids.json.gz"
with gzip.open(output_file_gz, 'wt') as f:
    json.dump(all_grids, f)
size_mb = output_file_gz.stat().st_size / (1024 * 1024)
print(f"   Saved: {output_file_gz} ({size_mb:.1f} MB)")

# Summary
print("\n" + "=" * 50)
print("GRID PRE-COMPUTATION COMPLETE")
print("=" * 50)
print(f"\nStatistics:")
print(f"  Grid resolution: {GRID_RESOLUTION}x{GRID_RESOLUTION} ({GRID_RESOLUTION**2} points per grid)")
print(f"  Search radius: {SEARCH_RADIUS_KM} km")
print(f"  IDW power: {POWER}")
print(f"  Sample interval: Every {SAMPLE_INTERVAL} days")
print(f"  Total grids: {len(all_grids)}")
print(f"  Metrics: {len(metrics)}")
print(f"  Date range: {sample_dates[0].date()} to {sample_dates[-1].date()}")
print(f"\nOutput:")
print(f"  ✓ precomputed_grids.json.gz")
print(f"\nNext steps:")
print(f"  1. Start server: python backend/server.py")
print(f"  2. Open browser: http://localhost:8000")
