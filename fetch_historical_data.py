"""Kerää 15 vuoden historiadata FMI:stä vyöhykkeittäin (2010-2025)."""
import pandas as pd
from fmiopendata.wfs import download_stored_query
from datetime import datetime, timedelta
import time

# Vyöhykemäärittelyt (leveysasteen mukaan)
ZONES = {
    "etela_suomi": {"name": "Etelä-Suomi", "lat_min": 0, "lat_max": 61.5},
    "keski_suomi": {"name": "Keski-Suomi", "lat_min": 61.5, "lat_max": 64.0},
    "pohjois_suomi": {"name": "Pohjois-Suomi", "lat_min": 64.0, "lat_max": 66.0},
    "lappi": {"name": "Lappi", "lat_min": 66.0, "lat_max": 90.0}
}

# Aikaväli: 2022-2025 (3 vuotta - voidaan laajentaa myöhemmin)
START_YEAR = 2015
END_YEAR = 2025

def get_zone_for_latitude(lat):
    """Palauttaa vyöhykkeen nimen leveysasteen perusteella."""
    for zone_id, zone_info in ZONES.items():
        if zone_info["lat_min"] <= lat < zone_info["lat_max"]:
            return zone_id
    return None

def fetch_data_for_period(start_date, end_date, bbox="19,59,32,71"):
    """Hakee datan annetulle aikajaksolle."""
    print(f"  Haetaan data: {start_date} - {end_date}")

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
        print(f"    Virhe: {e}")
        return None

def extract_data_to_dataframe(obs):
    """Muuntaa FMI-datan pandas DataFrameksi."""
    all_data = []

    # Data-rakenne: obs.data[timestamp][station_name][parameter]
    for timestamp, stations in obs.data.items():
        for station_name, measurements in stations.items():
            # Hae aseman metatiedot
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

            # Lisää mittausarvot
            for param_name, param_data in measurements.items():
                value = param_data['value']
                # Käsittele erikoisarvot
                if param_name == 'Snow depth' and value == -1:
                    value = 0
                if param_name == 'Precipitation amount' and value == -1:
                    value = 0
                row[param_name] = value

            all_data.append(row)

    return pd.DataFrame(all_data)

def main():
    print("=" * 70)
    print(f"FMI HISTORIADATA {START_YEAR}-{END_YEAR} - Vyöhykkeittäinen keräys")
    print("=" * 70)

    all_dataframes = []

    # Haetaan data vuosittain (API:n rajoitusten takia)
    for year in range(START_YEAR, END_YEAR + 1):
        print(f"\nVuosi {year}:")

        # Jaa vuosi neljään neljännekseen (API ei tykkää liian suurista kyselyistä)
        quarters = [
            (f"{year}-01-01", f"{year}-03-31"),
            (f"{year}-04-01", f"{year}-06-30"),
            (f"{year}-07-01", f"{year}-09-30"),
            (f"{year}-10-01", f"{year}-12-31")
        ]

        for start, end in quarters:
            obs = fetch_data_for_period(start, end)

            if obs:
                df = extract_data_to_dataframe(obs)
                all_dataframes.append(df)
                print(f"    ✓ Haettiin {len(df)} riviä")

            # Viive API-kuorman vähentämiseksi
            time.sleep(2)

    # Yhdistä kaikki DataFramet
    print("\n" + "=" * 70)
    print("Yhdistetään data...")
    final_df = pd.concat(all_dataframes, ignore_index=True)

    print(f"Yhteensä {len(final_df)} havaintoa")
    print(f"Aikaväli: {final_df['date'].min()} - {final_df['date'].max()}")

    # Tallenna kokonaisdata
    output_file = f"weather_data_{START_YEAR}_{END_YEAR}_all.csv"
    final_df.to_csv(output_file, index=False)
    print(f"\n✓ Tallennettu: {output_file}")

    # Tallenna vyöhykkeittäin
    print("\nTallennetaan vyöhykkeittäin:")
    for zone_id, zone_info in ZONES.items():
        zone_df = final_df[final_df['zone'] == zone_id]
        zone_file = f"weather_data_{START_YEAR}_{END_YEAR}_{zone_id}.csv"
        zone_df.to_csv(zone_file, index=False)

        station_count = zone_df['station_name'].nunique()
        print(f"  {zone_info['name']:20} {len(zone_df):8} riviä, {station_count:3} asemaa → {zone_file}")

    # Tilastot
    print("\n" + "=" * 70)
    print("YHTEENVETO:")
    print("=" * 70)
    print(f"Kokonaismäärä:     {len(final_df):8} havaintoa")
    print(f"Asemia yhteensä:   {final_df['station_name'].nunique():8}")
    print(f"Aikaväli:          {final_df['date'].min()} - {final_df['date'].max()}")
    print(f"Saatavilla olevat parametrit:")
    for col in final_df.columns:
        if col not in ['date', 'station_name', 'fmisid', 'latitude', 'longitude', 'zone', 'zone_name']:
            print(f"  - {col}")

    print("\n✓ Valmis!")

if __name__ == "__main__":
    main()
