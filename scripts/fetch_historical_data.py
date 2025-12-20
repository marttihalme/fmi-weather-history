"""Kerää historiadata FMI:stä vyöhykkeittäin."""
import pandas as pd
from fmiopendata.wfs import download_stored_query
from datetime import datetime, timedelta
import time
import functools
from pathlib import Path
import argparse
import os

# Force unbuffered output for real-time progress
print = functools.partial(print, flush=True)

# Määritä polut
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"

# Vyöhykemäärittelyt (leveysasteen mukaan)
# Etelä-Suomen pohjoinen raja 62.0° (Juupajoen korkeudella)
ZONES = {
    "etela_suomi": {"name": "Etelä-Suomi", "lat_min": 0, "lat_max": 62.0},
    "keski_suomi": {"name": "Keski-Suomi", "lat_min": 62.0, "lat_max": 64.0},
    "pohjois_suomi": {"name": "Pohjois-Suomi", "lat_min": 64.0, "lat_max": 66.0},
    "lappi": {"name": "Lappi", "lat_min": 66.0, "lat_max": 90.0}
}

# Oletusaikaväli
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

def generate_quarters(start_date, end_date):
    """Generoi neljännekset annetulle aikavälille."""
    quarters = []
    current = start_date

    while current <= end_date:
        # Määritä neljänneksen loppu
        if current.month <= 3:
            quarter_end = datetime(current.year, 3, 31)
        elif current.month <= 6:
            quarter_end = datetime(current.year, 6, 30)
        elif current.month <= 9:
            quarter_end = datetime(current.year, 9, 30)
        else:
            quarter_end = datetime(current.year, 12, 31)

        # Varmista ettei ylitetä loppupäivää
        if quarter_end > end_date:
            quarter_end = end_date

        quarters.append((
            current.strftime("%Y-%m-%d"),
            quarter_end.strftime("%Y-%m-%d")
        ))

        # Siirry seuraavaan neljännekseen
        current = quarter_end + timedelta(days=1)

    return quarters


def main():
    # Komentoriviargumentit
    parser = argparse.ArgumentParser(description='Hae säädataa FMI:stä')
    parser.add_argument('--start', type=str, help='Alkupäivä (YYYY-MM-DD)')
    parser.add_argument('--end', type=str, help='Loppupäivä (YYYY-MM-DD)')
    parser.add_argument('--merge', action='store_true', help='Yhdistä olemassa olevaan dataan')
    args = parser.parse_args()

    # Määritä aikaväli
    if args.start and args.end:
        start_date = datetime.strptime(args.start, "%Y-%m-%d")
        end_date = datetime.strptime(args.end, "%Y-%m-%d")
        start_year = start_date.year
        end_year = end_date.year
        date_range_str = f"{args.start} - {args.end}"
    else:
        # Käytä oletusarvoja
        start_date = datetime(START_YEAR, 1, 1)
        end_date = datetime(END_YEAR, 12, 31)
        start_year = START_YEAR
        end_year = END_YEAR
        date_range_str = f"{START_YEAR}-{END_YEAR}"

    print("=" * 70)
    print(f"FMI HISTORIADATA {date_range_str} - Vyöhykkeittäinen keräys")
    print("=" * 70)

    all_dataframes = []

    # Generoi neljännekset
    quarters = generate_quarters(start_date, end_date)
    print(f"\nHaetaan {len(quarters)} jaksoa...")

    for i, (start, end) in enumerate(quarters, 1):
        print(f"\nJakso {i}/{len(quarters)}: {start} - {end}")
        obs = fetch_data_for_period(start, end)

        if obs:
            df = extract_data_to_dataframe(obs)
            all_dataframes.append(df)
            print(f"    [ok] Haettiin {len(df)} riviä")

        # Viive API-kuorman vähentämiseksi
        time.sleep(2)

    if not all_dataframes:
        print("\nEi dataa haettu!")
        return

    # Yhdistä kaikki DataFramet
    print("\n" + "=" * 70)
    print("Yhdistetään data...")
    new_df = pd.concat(all_dataframes, ignore_index=True)

    print(f"Haettu {len(new_df)} havaintoa")

    # Luo data/raw -kansio jos ei ole
    DATA_RAW.mkdir(parents=True, exist_ok=True)

    # Käytä yhtä vakiotiedostonimeä
    output_file = DATA_RAW / "weather_data_all.csv"

    # Merge-tila: yhdistä olemassa olevaan dataan
    if args.merge and output_file.exists():
        print(f"Ladataan olemassa oleva data: {output_file}")
        existing_df = pd.read_csv(output_file)

        # Varmista että date on string-muodossa YYYY-MM-DD
        existing_df['date'] = pd.to_datetime(existing_df['date']).dt.strftime('%Y-%m-%d')
        new_df['date'] = pd.to_datetime(new_df['date']).dt.strftime('%Y-%m-%d')

        print(f"Olemassa oleva data: {len(existing_df)} havaintoa")
        print(f"  Aikaväli: {existing_df['date'].min()} - {existing_df['date'].max()}")
        print(f"Uusi data: {len(new_df)} havaintoa")
        print(f"  Aikaväli: {new_df['date'].min()} - {new_df['date'].max()}")

        # Poista vanhasta datasta VAIN ne päivät jotka ovat uuden haun aikavälillä
        # Näin säilytetään data joka ei ole haun aikavälillä
        new_date_min = new_df['date'].min()
        new_date_max = new_df['date'].max()

        # Säilytä vanhasta datasta kaikki joka on haetun aikavälin ULKOPUOLELLA
        preserved_df = existing_df[
            (existing_df['date'] < new_date_min) | (existing_df['date'] > new_date_max)
        ].copy()

        print(f"Säilytetään aikavälin ulkopuolelta: {len(preserved_df)} havaintoa")

        # Yhdistä säilytetty vanha data + uusi data
        final_df = pd.concat([preserved_df, new_df], ignore_index=True)
        final_df.drop_duplicates(subset=['date', 'fmisid'], keep='last', inplace=True)
        final_df.sort_values(by=['date', 'station_name'], inplace=True)

        print(f"Yhdistetty data: {len(final_df)} havaintoa")
    else:
        final_df = new_df

    print(f"Yhteensä {len(final_df)} havaintoa")
    print(f"Aikaväli: {final_df['date'].min()} - {final_df['date'].max()}")

    # Tallenna kokonaisdata
    final_df.to_csv(output_file, index=False)
    print(f"\n[ok] Tallennettu: {output_file}")

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

    print("\n[ok] Valmis!")

if __name__ == "__main__":
    main()
