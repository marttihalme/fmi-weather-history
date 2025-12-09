# -*- coding: utf-8 -*-
"""Analysoi ensimmaisen yopakkasen ajankohdan eri vyohykkeilla.

Yopakkanen = yon minimilampotila alle 0C.
Tama analyysi tuottaa tiedon siita milloin ensimmainen yopakkanen
saapuu eri vyohykkeille syksyisin.
"""
import pandas as pd
import numpy as np
from datetime import datetime
import json
from pathlib import Path

# Maarita polut
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
VIZ_DATA = PROJECT_ROOT / "visualization" / "data"

# Yopakkasen parametrit
FROST_THRESHOLD = 0.0  # Yolampotila alle taman = yopakkanen
CONSECUTIVE_DAYS = 1   # Montako perakkaista pakkasyota vaaditaan (1 = ensimmainen yksittainen)


def find_first_frost(daily_data):
    """
    Etsi ensimmainen yopakkanen datasta.

    Args:
        daily_data: DataFrame jossa on 'min_temp' sarake ja date-indeksi

    Returns:
        dict: {date, min_temp} tai None jos ei loydy
    """
    for date, row in daily_data.iterrows():
        if pd.notna(row['min_temp']) and row['min_temp'] < FROST_THRESHOLD:
            return {
                'date': date,
                'min_temp': row['min_temp']
            }
    return None


def find_frost_periods(daily_data, min_duration=2):
    """
    Etsi kaikki pakkasjaksot datasta.

    Returns:
        list: Lista jaksoista [{'start': date, 'end': date, 'duration': int,
                               'min_temp': float, 'avg_min_temp': float}]
    """
    periods = []
    min_temps = daily_data['min_temp'].values
    dates = daily_data.index.tolist()

    i = 0
    while i < len(min_temps):
        if pd.notna(min_temps[i]) and min_temps[i] < FROST_THRESHOLD:
            start_idx = i
            temp_mins = []

            # Etsi jakson loppu
            while i < len(min_temps) and pd.notna(min_temps[i]) and min_temps[i] < FROST_THRESHOLD:
                temp_mins.append(min_temps[i])
                i += 1

            duration = i - start_idx

            if duration >= min_duration:
                periods.append({
                    'start': dates[start_idx],
                    'end': dates[i - 1],
                    'duration': int(duration),
                    'min_temp': float(round(min(temp_mins), 1)),
                    'avg_min_temp': float(round(np.mean(temp_mins), 1))
                })
        else:
            i += 1

    return periods


def analyze_autumn_frost(df, zone_name, year):
    """
    Analysoi yhden syksyn yopakkaset vyohykkeelle.

    Args:
        df: DataFrame kaikella datalla
        zone_name: Vyohykkeen nimi
        year: Vuosi (syksy = elokuu-joulukuu)

    Returns:
        dict: Analyysin tulokset tai None jos ei dataa
    """
    # Hae syksyn data (1.8. - 31.12.)
    start_date = pd.Timestamp(f'{year}-08-01')
    end_date = pd.Timestamp(f'{year}-12-31')

    mask = (df['zone_name'] == zone_name) & \
           (df['date'] >= start_date) & \
           (df['date'] <= end_date)

    zone_data = df[mask].copy()

    if len(zone_data) < 30:  # Vahintaan kuukausi dataa
        return None

    # Laske paivittaiset keskiarvot
    daily = zone_data.groupby('date').agg({
        'Minimum temperature': 'mean',
        'Maximum temperature': 'mean'
    }).rename(columns={
        'Minimum temperature': 'min_temp',
        'Maximum temperature': 'max_temp'
    })

    # Etsi ensimmainen yopakkanen
    first_frost = find_first_frost(daily)

    if not first_frost:
        return None

    # Etsi kaikki pakkasjaksot
    frost_periods = find_frost_periods(daily)

    # Laske tilastot
    frost_nights = (daily['min_temp'] < FROST_THRESHOLD).sum()

    # Laske keskimaarainen minimilampotila pakkasoinä
    frost_temps = daily[daily['min_temp'] < FROST_THRESHOLD]['min_temp']
    avg_frost_temp = frost_temps.mean() if len(frost_temps) > 0 else None
    coldest_temp = frost_temps.min() if len(frost_temps) > 0 else None

    return {
        'zone': zone_name,
        'year': int(year),
        'first_frost_date': first_frost['date'],
        'first_frost_temp': float(round(first_frost['min_temp'], 1)),
        'frost_nights_total': int(frost_nights),
        'avg_frost_temp': float(round(avg_frost_temp, 1)) if avg_frost_temp else None,
        'coldest_temp': float(round(coldest_temp, 1)) if coldest_temp else None,
        'frost_periods': frost_periods
    }


def main():
    print("=" * 70)
    print("ENSIMMAISEN YOPAKKASEN ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Yopakkanen: minimilampotila < {FROST_THRESHOLD}C")
    print(f"  - Analysoitava kausi: elokuu-joulukuu")

    # Lue data - etsi dynaamisesti uusin tiedosto
    csv_files = list(DATA_RAW.glob('weather_data_*_all.csv'))
    if not csv_files:
        print(f"VIRHE: Ei loydy weather_data_*_all.csv tiedostoa kansiosta {DATA_RAW}")
        return
    csv_file = max(csv_files, key=lambda f: f.stat().st_mtime)
    print(f"\nLuetaan tiedosto: {csv_file}")

    df = pd.read_csv(csv_file)
    df['date'] = pd.to_datetime(df['date'])

    print(f"  Havaintoja: {len(df)}")
    print(f"  Aikavali: {df['date'].min().date()} - {df['date'].max().date()}")

    # Analysoi vyohykkeittain ja vuosittain
    zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi']
    # Hae vuodet datasta dynaamisesti
    years = sorted(df['date'].dt.year.unique())

    all_results = []

    print("\n" + "=" * 70)
    print("ANALYYSI VYOHYKKEITTAIN")
    print("=" * 70)

    for zone in zones:
        print(f"\n{'-' * 70}")
        print(f"  {zone}")
        print(f"{'-' * 70}")

        for year in years:
            result = analyze_autumn_frost(df, zone, year)

            if result:
                all_results.append(result)

                first_frost_str = result['first_frost_date'].strftime('%d.%m.%Y')

                print(f"\n  Syksy {year}:")
                print(f"    Ensimmainen yopakkanen:      {first_frost_str}")
                print(f"    Lampotila:                   {result['first_frost_temp']:.1f}C")
                print(f"    Pakkasöita yhteensa:         {result['frost_nights_total']}")
                print(f"    Keskimaarainen pakkasyo:     {result['avg_frost_temp']}C")
                print(f"    Kylmin yo:                   {result['coldest_temp']}C")
                print(f"    Pakkasjaksoja:               {len(result['frost_periods'])}")
            else:
                print(f"\n  Syksy {year}: Ei riittavasti dataa")

    # Tallenna tulokset JSON-muodossa visualisointia varten
    if all_results:
        json_data = []

        for r in all_results:
            json_entry = {
                'zone': r['zone'],
                'year': r['year'],
                'first_frost_date': r['first_frost_date'].strftime('%Y-%m-%d'),
                'first_frost_temp': r['first_frost_temp'],
                'frost_nights_total': r['frost_nights_total'],
                'avg_frost_temp': r['avg_frost_temp'],
                'coldest_temp': r['coldest_temp'],
                'frost_periods': [
                    {
                        'start': p['start'].strftime('%Y-%m-%d'),
                        'end': p['end'].strftime('%Y-%m-%d'),
                        'duration': p['duration'],
                        'min_temp': p['min_temp'],
                        'avg_min_temp': p['avg_min_temp']
                    } for p in r['frost_periods']
                ]
            }
            json_data.append(json_entry)

        output_json = VIZ_DATA / 'first_frost.json'
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"\n JSON tallennettu: {output_json}")

        # Yhteenveto
        print("\n" + "=" * 70)
        print("YHTEENVETO - ENSIMMAINEN YOPAKKANEN")
        print("=" * 70)

        for zone in zones:
            zone_results = [r for r in all_results if r['zone'] == zone]
            if zone_results:
                avg_day = np.mean([
                    r['first_frost_date'].timetuple().tm_yday
                    for r in zone_results
                ])
                # Muunna paivanumero takaisin paivamaaraksi (kayttaen vuotta 2024)
                avg_date = datetime(2024, 1, 1) + pd.Timedelta(days=int(avg_day) - 1)

                print(f"\n{zone}:")
                print(f"  Keskimaarainen ensimmainen yopakkanen: {avg_date.strftime('%d.%m')}")

                for r in zone_results:
                    print(f"    {r['year']}: {r['first_frost_date'].strftime('%d.%m')} ({r['first_frost_temp']:.1f}C)")


if __name__ == "__main__":
    main()
