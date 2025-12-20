import pandas as pd
from fmiopendata.wfs import download_stored_query
from datetime import datetime, timedelta
import time
from pathlib import Path
import sys
import subprocess

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
CSV_FILE = DATA_RAW / "weather_data_2022_2025_all.csv"
PREPROCESS_SCRIPT = PROJECT_ROOT / "visualization" / "preprocessing" / "prepare_data.py"

# Zones (copied from fetch_historical_data.py)
# Etelä-Suomen pohjoinen raja 62.0° (Juupajoen korkeudella)
ZONES = {
    "etela_suomi": {"name": "Etelä-Suomi", "lat_min": 0, "lat_max": 62.0},
    "keski_suomi": {"name": "Keski-Suomi", "lat_min": 62.0, "lat_max": 64.0},
    "pohjois_suomi": {"name": "Pohjois-Suomi", "lat_min": 64.0, "lat_max": 66.0},
    "lappi": {"name": "Lappi", "lat_min": 66.0, "lat_max": 90.0}
}

def get_zone_for_latitude(lat):
    for zone_id, zone_info in ZONES.items():
        if zone_info["lat_min"] <= lat < zone_info["lat_max"]:
            return zone_id
    return None

def fetch_data_for_period(start_date, end_date, bbox="19,59,32,71"):
    print(f"Fetching data: {start_date} - {end_date}")
    try:
        obs = download_stored_query(
            "fmi::observations::weather::daily::multipointcoverage",
            args=[
                f"starttime={start_date}T00:00:00Z",
                f"endtime={end_date}T00:00:00Z",
                f"bbox={bbox}",
            ]
        )
        return obs
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def extract_data_to_dataframe(obs):
    all_data = []
    for timestamp, stations in obs.data.items():
        for station_name, measurements in stations.items():
            meta = obs.location_metadata[station_name]
            lat = meta['latitude']
            lon = meta['longitude']
            fmisid = meta['fmisid']
            zone = get_zone_for_latitude(lat)

            row = {
                'date': timestamp.date(),
                'station_name': station_name,
                'fmisid': fmisid,
                'latitude': lat,
                'longitude': lon,
                'zone': zone,
                'zone_name': ZONES[zone]["name"] if zone else "Tuntematon"
            }

            for param_name, param_data in measurements.items():
                value = param_data['value']
                if param_name == 'Snow depth' and value == -1:
                    value = 0
                if param_name == 'Precipitation amount' and value == -1:
                    value = 0
                row[param_name] = value

            all_data.append(row)
    return pd.DataFrame(all_data)

def main():
    print("Refreshing last 30 days of data...")
    
    # Calculate date range
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=30)
    
    print(f"Date range: {start_date} to {end_date}")
    
    # Fetch data
    obs = fetch_data_for_period(start_date.isoformat(), end_date.isoformat())
    if not obs:
        print("Failed to fetch data.")
        sys.exit(1)
        
    new_df = extract_data_to_dataframe(obs)
    print(f"Fetched {len(new_df)} rows.")
    
    # Load existing data
    if CSV_FILE.exists():
        print(f"Loading existing data from {CSV_FILE}")
        existing_df = pd.read_csv(CSV_FILE)
        # Convert date column to datetime.date
        existing_df['date'] = pd.to_datetime(existing_df['date']).dt.date
        
        # Remove old data for the fetched period to avoid duplicates
        # Actually, we should merge.
        # Let's filter out the fetched range from existing data and append new data
        # Or better: concat and drop duplicates
        
        combined_df = pd.concat([existing_df, new_df])
        # Drop duplicates based on date and station
        # Assuming 'date' and 'fmisid' (or 'station_name') are unique keys
        combined_df.drop_duplicates(subset=['date', 'fmisid'], keep='last', inplace=True)
        
        print(f"Combined data: {len(combined_df)} rows.")
        combined_df.sort_values(by=['date', 'station_name'], inplace=True)
        
        combined_df.to_csv(CSV_FILE, index=False)
        print(f"Updated {CSV_FILE}")
    else:
        print(f"Creating new file {CSV_FILE}")
        new_df.to_csv(CSV_FILE, index=False)

    # Run preprocessing
    print("Running preprocessing...")
    subprocess.run([sys.executable, str(PREPROCESS_SCRIPT)], check=True)
    print("Done.")

if __name__ == "__main__":
    main()
