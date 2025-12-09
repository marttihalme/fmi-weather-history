"""Analysoi liukkausriskin alkaminen eri vyöhykkeillä.

Liukkausriski syntyy jäätymis-sulamis-syklissä:
- Yöllä pakkasta (min temp < 0°C)
- Päivällä plussa (max temp > 0°C)
- Erityisen vaarallista kun lämpötilat lähellä nollaa

Tämä analyysi tuottaa tiedon siitä milloin talvirenkaiden vaihto
on ajankohtaista eri vyöhykkeillä.
"""
import pandas as pd
import numpy as np
from datetime import datetime
import json
from pathlib import Path

# Määritä polut
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
VIZ_DATA = PROJECT_ROOT / "visualization" / "data"

# Liukkausriskin parametrit
FREEZE_THAW_MIN = 0.0  # Yölämpötila alle tämän
FREEZE_THAW_MAX = 0.0  # Päivälämpötila yli tämän
HIGH_RISK_MIN_RANGE = (-5, 0)  # Korkea riski kun yölämpötila tässä välissä
HIGH_RISK_MAX_RANGE = (0, 5)   # Korkea riski kun päivälämpötila tässä välissä
SEASON_START_THRESHOLD = 3     # Montako riskipäivää 7:stä = kausi alkaa


def calculate_daily_slippery_risk(min_temp, max_temp):
    """
    Laske liukkausriski yksittäiselle päivälle.

    Returns:
        float: 0 = ei riskiä, 1 = riski, 1.5 = korkea riski
    """
    if pd.isna(min_temp) or pd.isna(max_temp):
        return 0

    # Jäätymis-sulamis-sykli: yöllä pakkasta, päivällä sulaa
    if min_temp < FREEZE_THAW_MIN and max_temp > FREEZE_THAW_MAX:
        # Korkea riski kun molemmat lähellä nollaa
        if (HIGH_RISK_MIN_RANGE[0] < min_temp < HIGH_RISK_MIN_RANGE[1] and
            HIGH_RISK_MAX_RANGE[0] < max_temp < HIGH_RISK_MAX_RANGE[1]):
            return 1.5
        return 1.0

    # Pelkkä nollakeli (koko päivä lähellä nollaa) - lievempi riski
    if -2 < min_temp < 2 and -2 < max_temp < 2:
        return 0.5

    return 0


def find_slippery_season_start(daily_data, min_days=SEASON_START_THRESHOLD, window=7):
    """
    Etsi liukkauskauden alkamispäivä.

    Kriteeri: ensimmäinen päivä jonka jälkeen window päivän aikana
    vähintään min_days päivää on riskipäiviä.
    """
    risks = daily_data['risk'].values
    dates = daily_data.index.tolist()

    for i in range(len(risks) - window + 1):
        window_risks = risks[i:i+window]
        risk_days = sum(1 for r in window_risks if r > 0)
        if risk_days >= min_days:
            return dates[i]

    return None


def find_slippery_periods(daily_data, min_duration=2):
    """
    Etsi kaikki liukkausjaksot datasta.

    Returns:
        list: Lista jaksoista [{'start': date, 'end': date, 'duration': int,
                               'high_risk_days': int, 'avg_min_temp': float, 'avg_max_temp': float}]
    """
    periods = []
    risks = daily_data['risk'].values
    dates = daily_data.index.tolist()
    min_temps = daily_data['min_temp'].values
    max_temps = daily_data['max_temp'].values

    i = 0
    while i < len(risks):
        if risks[i] > 0:
            start_idx = i
            high_risk_count = 0
            temp_mins = []
            temp_maxs = []

            # Etsi jakson loppu
            while i < len(risks) and risks[i] > 0:
                if risks[i] >= 1.5:
                    high_risk_count += 1
                if not pd.isna(min_temps[i]):
                    temp_mins.append(min_temps[i])
                if not pd.isna(max_temps[i]):
                    temp_maxs.append(max_temps[i])
                i += 1

            duration = i - start_idx

            if duration >= min_duration:
                periods.append({
                    'start': dates[start_idx],
                    'end': dates[i - 1],
                    'duration': int(duration),
                    'high_risk_days': int(high_risk_count),
                    'avg_min_temp': round(np.mean(temp_mins), 1) if temp_mins else None,
                    'avg_max_temp': round(np.mean(temp_maxs), 1) if temp_maxs else None
                })
        else:
            i += 1

    return periods


def analyze_autumn_slippery_risk(df, zone_name, year):
    """
    Analysoi yhden syksyn liukkausriskit vyöhykkeelle.

    Args:
        df: DataFrame kaikella datalla
        zone_name: Vyöhykkeen nimi
        year: Vuosi (syksy = syyskuu-joulukuu)

    Returns:
        dict: Analyysin tulokset tai None jos ei dataa
    """
    # Hae syksyn data (1.9. - 15.12.)
    start_date = pd.Timestamp(f'{year}-09-01')
    end_date = pd.Timestamp(f'{year}-12-15')

    mask = (df['zone_name'] == zone_name) & \
           (df['date'] >= start_date) & \
           (df['date'] <= end_date)

    zone_data = df[mask].copy()

    if len(zone_data) < 30:  # Vähintään kuukausi dataa
        return None

    # Laske päivittäiset keskiarvot
    daily = zone_data.groupby('date').agg({
        'Minimum temperature': 'mean',
        'Maximum temperature': 'mean',
        'Snow depth': 'mean'
    }).rename(columns={
        'Minimum temperature': 'min_temp',
        'Maximum temperature': 'max_temp',
        'Snow depth': 'snow_depth'
    })

    # Laske riski jokaiselle päivälle
    daily['risk'] = daily.apply(
        lambda row: calculate_daily_slippery_risk(row['min_temp'], row['max_temp']),
        axis=1
    )

    # Etsi liukkauskauden alku
    season_start = find_slippery_season_start(daily)

    if not season_start:
        return None

    # Etsi kaikki liukkausjaksot
    slippery_periods = find_slippery_periods(daily)

    # Laske tilastot
    risk_days = (daily['risk'] > 0).sum()
    high_risk_days = (daily['risk'] >= 1.5).sum()

    # Etsi ensimmäinen lumi + liukkaus yhdistelmä
    snow_and_risk = daily[(daily['snow_depth'] > 0) & (daily['risk'] > 0)]
    first_snow_risk = snow_and_risk.index.min() if len(snow_and_risk) > 0 else None

    return {
        'zone': zone_name,
        'year': year,
        'season_start': season_start,
        'first_snow_and_risk': first_snow_risk,
        'risk_days_total': int(risk_days),
        'high_risk_days': int(high_risk_days),
        'slippery_periods': slippery_periods
    }


def main():
    print("=" * 70)
    print("LIUKKAUSRISKIN ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Jäätymis-sulamis: yöllä < {FREEZE_THAW_MIN}°C, päivällä > {FREEZE_THAW_MAX}°C")
    print(f"  - Korkea riski: yö {HIGH_RISK_MIN_RANGE}, päivä {HIGH_RISK_MAX_RANGE}")
    print(f"  - Kausi alkaa: {SEASON_START_THRESHOLD}/7 riskipäivää")

    # Lue data - etsi dynaamisesti uusin tiedosto
    csv_files = list(DATA_RAW.glob('weather_data_*_all.csv'))
    if not csv_files:
        print(f"VIRHE: Ei löydy weather_data_*_all.csv tiedostoa kansiosta {DATA_RAW}")
        return
    csv_file = max(csv_files, key=lambda f: f.stat().st_mtime)
    print(f"\nLuetaan tiedosto: {csv_file}")

    df = pd.read_csv(csv_file)
    df['date'] = pd.to_datetime(df['date'])

    print(f"  ✓ {len(df)} havaintoa")
    print(f"  ✓ Aikaväli: {df['date'].min()} - {df['date'].max()}")

    # Analysoi vyöhykkeittäin ja vuosittain
    zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi']
    # Hae vuodet datasta dynaamisesti
    years = sorted(df['date'].dt.year.unique())

    all_results = []

    print("\n" + "=" * 70)
    print("ANALYYSI VYÖHYKKEITTÄIN")
    print("=" * 70)

    for zone in zones:
        print(f"\n{'─' * 70}")
        print(f"  {zone}")
        print(f"{'─' * 70}")

        for year in years:
            result = analyze_autumn_slippery_risk(df, zone, year)

            if result:
                all_results.append(result)

                season_start_str = result['season_start'].strftime('%d.%m.%Y')
                snow_risk_str = result['first_snow_and_risk'].strftime('%d.%m.%Y') if result['first_snow_and_risk'] else '-'

                print(f"\n  Syksy {year}:")
                print(f"    Liukkauskausi alkaa:         {season_start_str}")
                print(f"    Lumi + liukkaus:             {snow_risk_str}")
                print(f"    Riskipäiviä yhteensä:        {result['risk_days_total']}")
                print(f"    Korkean riskin päiviä:       {result['high_risk_days']}")
                print(f"    Liukkausjaksoja:             {len(result['slippery_periods'])}")
            else:
                print(f"\n  Syksy {year}: Ei riittävästi dataa")

    # Tallenna tulokset JSON-muodossa visualisointia varten
    if all_results:
        json_data = []

        for r in all_results:
            json_entry = {
                'zone': r['zone'],
                'year': int(r['year']),
                'season_start': r['season_start'].strftime('%Y-%m-%d'),
                'first_snow_and_risk': r['first_snow_and_risk'].strftime('%Y-%m-%d') if r['first_snow_and_risk'] else None,
                'risk_days_total': int(r['risk_days_total']),
                'high_risk_days': int(r['high_risk_days']),
                'slippery_periods': [
                    {
                        'start': p['start'].strftime('%Y-%m-%d'),
                        'end': p['end'].strftime('%Y-%m-%d'),
                        'duration': int(p['duration']),
                        'high_risk_days': int(p['high_risk_days']),
                        'avg_min_temp': p['avg_min_temp'],
                        'avg_max_temp': p['avg_max_temp']
                    } for p in r['slippery_periods']
                ]
            }
            json_data.append(json_entry)

        output_json = VIZ_DATA / 'slippery_risk.json'
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"\n✓ JSON tallennettu: {output_json}")

        # Yhteenveto
        print("\n" + "=" * 70)
        print("YHTEENVETO - LIUKKAUSKAUDEN ALKAMINEN")
        print("=" * 70)

        for zone in zones:
            zone_results = [r for r in all_results if r['zone'] == zone]
            if zone_results:
                avg_start_day = np.mean([
                    r['season_start'].timetuple().tm_yday
                    for r in zone_results
                ])
                # Muunna päivänumero takaisin päivämääräksi (käyttäen vuotta 2024)
                avg_date = datetime(2024, 1, 1) + pd.Timedelta(days=int(avg_start_day) - 1)

                print(f"\n{zone}:")
                print(f"  Keskimääräinen liukkauskauden alku: {avg_date.strftime('%d.%m')}")

                for r in zone_results:
                    print(f"    {r['year']}: {r['season_start'].strftime('%d.%m')} ({r['risk_days_total']} riskipäivää)")


if __name__ == "__main__":
    main()
