#!/usr/bin/env python3
"""
Data preprocessing script for Finnish Weather Visualization System.
Aggregates 387k weather observations into optimized JSON format.

Input:  ../weather_data_2022_2025_all.csv (37 MB)
Output: ../data/daily_zone_summary.json (~400 KB gzipped)
        ../data/station_locations.json (~50 KB gzipped)
        ../data/anomalies.json (~25 KB gzipped)
        ../data/winter_starts.json (~8 KB gzipped)
"""

import pandas as pd
import json
import gzip
from pathlib import Path
from datetime import datetime

# Paths relative to script location
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "visualization" / "data"
DATA_DIR.mkdir(exist_ok=True)

print("Finnish Weather Data Preprocessor")
print("=" * 50)

# 1. Load main weather data
print("\n1. Loading weather data (387k rows)...")
df = pd.read_csv(BASE_DIR / "weather_data_2022_2025_all.csv")
print(f"   Loaded {len(df):,} observations")
print(f"   Date range: {df['date'].min()} to {df['date'].max()}")
print(f"   Stations: {df['station_name'].nunique()}")
print(f"   Zones: {df['zone_name'].nunique()}")

# 2. Create station-daily data (no zone averaging)
print("\n2. Creating station-daily data (preserving individual station values)...")
station_daily = df[['date', 'fmisid', 'station_name', 'zone', 'zone_name',
                    'Air temperature', 'Minimum temperature', 'Maximum temperature',
                    'Snow depth', 'Precipitation amount', 'Ground minimum temperature']].copy()

station_daily.rename(columns={
    'Air temperature': 'temp_mean',
    'Minimum temperature': 'temp_min',
    'Maximum temperature': 'temp_max',
    'Snow depth': 'snow_depth',
    'Precipitation amount': 'precipitation',
    'Ground minimum temperature': 'ground_temp_min'
}, inplace=True)

# Round to 1 decimal place
numeric_cols = ['temp_mean', 'temp_min', 'temp_max', 'snow_depth', 'precipitation', 'ground_temp_min']
station_daily[numeric_cols] = station_daily[numeric_cols].round(1)

# Replace NaN with None (which becomes null in JSON)
station_daily = station_daily.replace({float('nan'): None})

print(f"   Created {len(station_daily):,} station-daily records")

# Convert to JSON structure
station_summary = station_daily.to_dict(orient='records')

# Save uncompressed
output_file = DATA_DIR / "daily_station_data.json"
with open(output_file, 'w') as f:
    json.dump(station_summary, f)
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")

# Save gzipped
output_file_gz = DATA_DIR / "daily_station_data.json.gz"
with gzip.open(output_file_gz, 'wt') as f:
    json.dump(station_summary, f)
print(f"   Saved: {output_file_gz} ({output_file_gz.stat().st_size / 1024:.0f} KB)")

# Also keep zone summaries for statistics display
print("\n2b. Creating zone summaries for statistics...")
zone_metrics = df.groupby(['date', 'zone', 'zone_name']).agg({
    'Air temperature': 'mean',
    'Minimum temperature': 'min',
    'Maximum temperature': 'max',
    'Snow depth': 'mean',
    'Precipitation amount': 'sum',
    'Ground minimum temperature': 'min',
    'station_name': 'count'
}).reset_index()

zone_metrics.rename(columns={
    'station_name': 'station_count',
    'Air temperature': 'temp_mean',
    'Minimum temperature': 'temp_min',
    'Maximum temperature': 'temp_max',
    'Snow depth': 'snow_depth',
    'Precipitation amount': 'precipitation',
    'Ground minimum temperature': 'ground_temp_min'
}, inplace=True)

zone_metrics[numeric_cols] = zone_metrics[numeric_cols].round(1)
zone_metrics = zone_metrics.replace({float('nan'): None})
zone_summary = zone_metrics.to_dict(orient='records')

output_file = DATA_DIR / "daily_zone_summary.json"
with open(output_file, 'w') as f:
    json.dump(zone_summary, f)
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")

# 3. Extract station locations
print("\n3. Extracting station locations...")
stations = df[['station_name', 'fmisid', 'latitude', 'longitude', 'zone', 'zone_name']].drop_duplicates()
stations = stations.sort_values(['zone', 'station_name'])

station_data = stations.to_dict(orient='records')

output_file = DATA_DIR / "station_locations.json"
with open(output_file, 'w') as f:
    json.dump(station_data, f)
print(f"   Found {len(stations)} unique stations")
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")

# Save gzipped
output_file_gz = DATA_DIR / "station_locations.json.gz"
with gzip.open(output_file_gz, 'wt') as f:
    json.dump(station_data, f)
print(f"   Saved: {output_file_gz} ({output_file_gz.stat().st_size / 1024:.0f} KB)")

# 4. Process anomalies
print("\n4. Processing weather anomalies...")
anomalies = pd.read_csv(BASE_DIR / "weather_anomalies.csv")
print(f"   Loaded {len(anomalies)} anomaly events")

# Add geospatial information
anomaly_types = anomalies['type'].unique()
print(f"   Anomaly types: {', '.join(anomaly_types)}")

# Convert dates to strings
if 'start_date' in anomalies.columns:
    anomalies['start_date'] = anomalies['start_date'].astype(str)
if 'date' in anomalies.columns:
    anomalies['date'] = anomalies['date'].astype(str)

# Replace NaN with None (which becomes null in JSON)
anomalies = anomalies.replace({float('nan'): None})

anomaly_data = anomalies.to_dict(orient='records')

output_file = DATA_DIR / "anomalies.json"
with open(output_file, 'w') as f:
    json.dump(anomaly_data, f)
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")

# Save gzipped
output_file_gz = DATA_DIR / "anomalies.json.gz"
with gzip.open(output_file_gz, 'wt') as f:
    json.dump(anomaly_data, f)
print(f"   Saved: {output_file_gz} ({output_file_gz.stat().st_size / 1024:.0f} KB)")

# 5. Process winter progression
print("\n5. Processing winter progression data...")
winter = pd.read_csv(BASE_DIR / "winter_start_analysis.csv")
print(f"   Loaded {len(winter)} winter season records")

# Convert dates to strings
winter['winter_start'] = pd.to_datetime(winter['winter_start']).dt.strftime('%Y-%m-%d')
# Handle winter_end which may have NaN values
winter['winter_end'] = pd.to_datetime(winter['winter_end'], errors='coerce').dt.strftime('%Y-%m-%d')
winter['winter_end'] = winter['winter_end'].where(winter['winter_end'].notna(), None)

# Replace all NaN with None (which becomes null in JSON)
winter = winter.replace({float('nan'): None})

winter_data = winter.to_dict(orient='records')

output_file = DATA_DIR / "winter_starts.json"
with open(output_file, 'w') as f:
    json.dump(winter_data, f)
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")

# Save gzipped
output_file_gz = DATA_DIR / "winter_starts.json.gz"
with gzip.open(output_file_gz, 'wt') as f:
    json.dump(winter_data, f)
print(f"   Saved: {output_file_gz} ({output_file_gz.stat().st_size / 1024:.0f} KB)")

# 6. Summary statistics
print("\n" + "=" * 50)
print("PREPROCESSING COMPLETE")
print("=" * 50)
print(f"\nData:")
print(f"  Original: {len(df):,} rows")
print(f"  Station-daily: {len(station_daily):,} rows (individual station data)")
print(f"  Zone summaries: {len(zone_metrics):,} rows (for statistics)")
print(f"\nOutput files created in: {DATA_DIR}")
print(f"  ✓ daily_station_data.json (primary visualization data)")
print(f"  ✓ daily_zone_summary.json (zone statistics)")
print(f"  ✓ station_locations.json")
print(f"  ✓ anomalies.json")
print(f"  ✓ winter_starts.json")
print(f"\nNext steps:")
print(f"  1. Run: python preprocessing/generate_grids.py")
print(f"  2. Start server: python backend/server.py")
print(f"  3. Open: http://localhost:8000")
