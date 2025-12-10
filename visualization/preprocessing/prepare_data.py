#!/usr/bin/env python3
"""
Data preprocessing script for Finnish Weather Visualization System.
Aggregates 387k weather observations into optimized JSON format.

Input:  ../data/raw/weather_data_2022_2025_all.csv (37 MB)
Output: ../data/daily_zone_summary.json (~400 KB gzipped)
        ../data/station_locations.json (~50 KB gzipped)
        ../data/anomalies.json (~25 KB gzipped)
        ../data/winter_starts.json (~8 KB gzipped)
"""

import pandas as pd
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# Paths relative to script location
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "visualization" / "data"
DATA_DIR.mkdir(exist_ok=True)

print("Finnish Weather Data Preprocessor")
print("=" * 50)

# 1. Load main weather data - find the actual file dynamically
print("\n1. Loading weather data...")
raw_dir = BASE_DIR / "data" / "raw"
csv_files = list(raw_dir.glob("weather_data_*_all.csv"))
if not csv_files:
    raise FileNotFoundError(f"No weather_data_*_all.csv found in {raw_dir}")
# Use the most recent file if multiple exist
csv_file = max(csv_files, key=lambda f: f.stat().st_mtime)
print(f"   Using: {csv_file.name}")
df = pd.read_csv(csv_file)
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

# GZ files removed - server handles gzip compression automatically

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


# 4. Process anomalies (optional source)
print("\n4. Processing weather anomalies...")
anomaly_csv = BASE_DIR / "data" / "analysis" / "weather_anomalies.csv"
anomaly_data = None

if anomaly_csv.exists():
    anomalies = pd.read_csv(anomaly_csv)
    print(f"   Loaded {len(anomalies)} anomaly events")

    anomaly_types = anomalies['type'].unique()
    print(f"   Anomaly types: {', '.join(anomaly_types)}")

    if 'start_date' in anomalies.columns:
        anomalies['start_date'] = anomalies['start_date'].astype(str)
    if 'date' in anomalies.columns:
        anomalies['date'] = anomalies['date'].astype(str)

    anomalies = anomalies.replace({float('nan'): None})
    anomaly_data = anomalies.to_dict(orient='records')
else:
    print("   Warning: weather_anomalies.csv not found")
    existing_anomalies = DATA_DIR / "anomalies.json"
    if existing_anomalies.exists():
        with open(existing_anomalies, 'r') as f:
            anomaly_data = json.load(f)
        print(f"   Reusing existing anomalies.json ({len(anomaly_data)} records)")
    else:
        print("   No existing anomalies data found; continuing without anomalies")
        anomaly_data = []

output_file = DATA_DIR / "anomalies.json"
with open(output_file, 'w') as f:
    json.dump(anomaly_data, f)
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")


# 5. Process winter progression (detailed with cold/warm spells)
print("\n5. Processing winter progression data...")

# Load detailed winter analysis JSON (includes cold_spells and warm_spells)
winter_detailed_file = BASE_DIR / "data" / "analysis" / "winter_analysis_detailed.json"
if winter_detailed_file.exists():
    with open(winter_detailed_file, 'r', encoding='utf-8') as f:
        winter_data = json.load(f)
    print(f"   Loaded {len(winter_data)} winter season records (detailed)")

    # Count total spells
    total_cold_spells = sum(len(w.get('cold_spells', [])) for w in winter_data)
    total_warm_spells = sum(len(w.get('warm_spells', [])) for w in winter_data)
    print(f"   Total cold spells: {total_cold_spells}")
    print(f"   Total warm interruptions: {total_warm_spells}")
else:
    # Fallback to CSV if detailed JSON doesn't exist
    print("   Warning: winter_analysis_detailed.json not found, using CSV fallback")
    winter = pd.read_csv(BASE_DIR / "winter_start_analysis.csv")
    winter['season_start'] = pd.to_datetime(winter['season_start']).dt.strftime('%Y-%m-%d')
    winter['season_end'] = pd.to_datetime(winter['season_end'], errors='coerce').dt.strftime('%Y-%m-%d')
    winter['season_end'] = winter['season_end'].where(winter['season_end'].notna(), None)
    winter = winter.replace({float('nan'): None})
    winter_data = winter.to_dict(orient='records')

output_file = DATA_DIR / "winter_starts.json"
with open(output_file, 'w') as f:
    json.dump(winter_data, f)
print(f"   Saved: {output_file} ({output_file.stat().st_size / 1024:.0f} KB)")


# 6. Summary statistics
print("\n" + "=" * 50)
print("PREPROCESSING COMPLETE")
print("=" * 50)
print(f"\nData:")
print(f"  Original: {len(df):,} rows")
print(f"  Station-daily: {len(station_daily):,} rows (individual station data)")
print(f"  Zone summaries: {len(zone_metrics):,} rows (for statistics)")
print(f"\nOutput files created in: {DATA_DIR}")
print(f"  [ok] daily_station_data.json (primary visualization data)")
print(f"  [ok] daily_zone_summary.json (zone statistics)")
print(f"  [ok] station_locations.json")
print(f"  [ok] anomalies.json")
print(f"  [ok] winter_starts.json")
print(f"\nNext steps:")
print(f"  1. Run: python preprocessing/generate_grids.py")
print(f"  2. Start server: python backend/server.py")
print(f"  3. Open: http://localhost:8000")

# 7. Run all analysis scripts
print("\n" + "=" * 50)
print("RUNNING ANALYSIS SCRIPTS")
print("=" * 50)

analysis_scripts = [
    'analyze_data.py'
]

SCRIPTS_DIR = BASE_DIR / "scripts"

for script in analysis_scripts:
    script_path = SCRIPTS_DIR / script
    if script_path.exists():
        print(f"\n► Running {script}...")
        try:
            result = subprocess.run(
                [sys.executable, str(script_path)],
                cwd=str(SCRIPTS_DIR),
                capture_output=False,
                timeout=300
            )
            if result.returncode == 0:
                print(f"  ✓ {script} completed successfully")
            else:
                print(f"  ✗ {script} failed with code {result.returncode}")
        except subprocess.TimeoutExpired:
            print(f"  ✗ {script} timed out")
        except Exception as e:
            print(f"  ✗ Error running {script}: {e}")
    else:
        print(f"\n✗ Script not found: {script_path}")

print("\n" + "=" * 50)
print("ALL PROCESSING COMPLETE")
print("=" * 50)
