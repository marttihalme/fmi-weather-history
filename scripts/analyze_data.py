# -*- coding: utf-8 -*-
"""Yhdistetty säädata-analyysi.

Tämä skripti yhdistää kaikki säädata-analyysit:
1. Nollaraja alittuu (yöpakkanen) - ensimmäinen syksyn pakkasjakso
2. Terminen talvi - talvikauden pakkasjaksot ja katkonaisuus
3. Liukkausriski - jäätymis-sulamis-syklit
4. Sääanomaliat - äärimmäiset sääilmiöt

Tuottaa:
- visualization/data/first_frost.json
- visualization/data/slippery_risk.json
- data/analysis/winter_analysis_detailed.json
- data/analysis/weather_anomalies.csv
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import functools
from pathlib import Path

# Force unbuffered output for real-time progress
print = functools.partial(print, flush=True)

# ============================================================================
# POLKUMÄÄRITTELYT
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_ANALYSIS = PROJECT_ROOT / "data" / "analysis"
VIZ_DATA = PROJECT_ROOT / "visualization" / "data"

# Varmista että kansiot on olemassa
DATA_ANALYSIS.mkdir(parents=True, exist_ok=True)
VIZ_DATA.mkdir(parents=True, exist_ok=True)

# ============================================================================
# PARAMETRIT
# ============================================================================

# Nollaraja alittuu (yöpakkanen)
FROST_THRESHOLD = 0.0
FROST_MIN_DURATION = 2

# Terminen talvi
WINTER_THRESHOLD_TEMP = 0.0
WINTER_CONSECUTIVE_DAYS = 5
MIN_COLD_SPELL_DAYS = 3

# Liukkausriski
FREEZE_THAW_MIN = 0.0
FREEZE_THAW_MAX = 0.0
HIGH_RISK_MIN_RANGE = (-5, 0)
HIGH_RISK_MAX_RANGE = (0, 5)
SEASON_START_THRESHOLD = 3

# Sääanomaliat
COLD_SNAP_THRESHOLD = -15.0
HEAT_WAVE_THRESHOLD = 25.0
TEMPERATURE_JUMP = 15.0
EXTREME_COLD = -25.0
ANOMALY_CONSECUTIVE_DAYS = 3


# ============================================================================
# APUFUNKTIOT
# ============================================================================

def load_weather_data():
    """Lataa säädata dynaamisesti uusimmasta tiedostosta."""
    # Prefer the new standard filename
    standard_file = DATA_RAW / 'weather_data_all.csv'
    if standard_file.exists():
        csv_file = standard_file
    else:
        csv_files = list(DATA_RAW.glob('weather_data_*_all.csv'))
        if not csv_files:
            raise FileNotFoundError(f"Ei loydy weather_data_*.csv tiedostoa kansiosta {DATA_RAW}")
        csv_file = max(csv_files, key=lambda f: f.stat().st_mtime)
    print(f"Luetaan tiedosto: {csv_file.name}")

    df = pd.read_csv(csv_file)
    df['date'] = pd.to_datetime(df['date'])

    print(f"  [OK] {len(df):,} havaintoa")
    print(f"  [OK] Aikavali: {df['date'].min().date()} - {df['date'].max().date()}")

    return df


# ============================================================================
# 1. NOLLARAJA ALITTUU (YÖPAKKANEN)
# ============================================================================

def find_first_frost(daily_data):
    """Etsi ensimmäinen yöpakkanen datasta."""
    for date, row in daily_data.iterrows():
        if pd.notna(row['min_temp']) and row['min_temp'] < FROST_THRESHOLD:
            return {'date': date, 'min_temp': row['min_temp']}
    return None


def find_frost_periods(daily_data, min_duration=FROST_MIN_DURATION):
    """Etsi kaikki yöpakkasjaksot datasta."""
    periods = []
    min_temps = daily_data['min_temp'].values
    dates = daily_data.index.tolist()

    i = 0
    while i < len(min_temps):
        if pd.notna(min_temps[i]) and min_temps[i] < FROST_THRESHOLD:
            start_idx = i
            temp_mins = []

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
    """Analysoi yhden syksyn yöpakkaset vyöhykkeelle."""
    start_date = pd.Timestamp(f'{year}-08-01')
    end_date = pd.Timestamp(f'{year}-12-31')

    mask = (df['zone_name'] == zone_name) & \
           (df['date'] >= start_date) & \
           (df['date'] <= end_date)

    zone_data = df[mask].copy()

    if len(zone_data) < 30:
        return None

    daily = zone_data.groupby('date').agg({
        'Minimum temperature': 'mean',
        'Maximum temperature': 'mean'
    }).rename(columns={
        'Minimum temperature': 'min_temp',
        'Maximum temperature': 'max_temp'
    })

    first_frost = find_first_frost(daily)

    if not first_frost:
        return None

    frost_periods = find_frost_periods(daily)
    frost_nights = (daily['min_temp'] < FROST_THRESHOLD).sum()

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


def run_first_frost_analysis(df):
    """Suorita nollaraja alittuu -analyysi."""
    print("\n" + "=" * 70)
    print("NOLLARAJA ALITTUU -ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Nollaraja alittuu: yön minimilämpötila < {FROST_THRESHOLD}°C")
    print(f"  - Analysoitava kausi: elokuu-joulukuu")

    zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi']
    years = sorted(df['date'].dt.year.unique())

    all_results = []

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
                print(f"    Ensimmäinen yöpakkanen:      {first_frost_str}")
                print(f"    Lämpötila:                   {result['first_frost_temp']:.1f}°C")
                print(f"    Pakkasöitä yhteensä:         {result['frost_nights_total']}")
                print(f"    Pakkasjaksoja:               {len(result['frost_periods'])}")

    # Tallenna JSON
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
        print(f"\n[OK] JSON tallennettu: {output_json}")


# ============================================================================
# 2. TERMINEN TALVI
# ============================================================================

def find_all_cold_spells(temps, dates, min_days=MIN_COLD_SPELL_DAYS):
    """Etsi kaikki pakkasjaksot datasta."""
    if len(temps) < min_days:
        return []

    cold_spells = []
    i = 0

    while i < len(temps):
        if pd.isna(temps[i]):
            i += 1
            continue

        if temps[i] < WINTER_THRESHOLD_TEMP:
            start_idx = i
            min_temp = temps[i]

            while i < len(temps) and not pd.isna(temps[i]) and temps[i] < WINTER_THRESHOLD_TEMP:
                min_temp = min(min_temp, temps[i])
                i += 1

            duration = i - start_idx

            if duration >= min_days:
                cold_spells.append({
                    'start': dates[start_idx],
                    'end': dates[i - 1],
                    'duration': duration,
                    'min_temp': round(min_temp, 1)
                })
        else:
            i += 1

    return cold_spells


def find_all_warm_spells(temps, dates, min_days=MIN_COLD_SPELL_DAYS):
    """Etsi kaikki lämpimät jaksot (katkot talvessa)."""
    if len(temps) < min_days:
        return []

    warm_spells = []
    i = 0

    while i < len(temps):
        if pd.isna(temps[i]):
            i += 1
            continue

        if temps[i] >= WINTER_THRESHOLD_TEMP:
            start_idx = i
            max_temp = temps[i]

            while i < len(temps) and not pd.isna(temps[i]) and temps[i] >= WINTER_THRESHOLD_TEMP:
                max_temp = max(max_temp, temps[i])
                i += 1

            duration = i - start_idx

            if duration >= min_days:
                warm_spells.append({
                    'start': dates[start_idx],
                    'end': dates[i - 1],
                    'duration': duration,
                    'max_temp': round(max_temp, 1)
                })
        else:
            i += 1

    return warm_spells


def analyze_winter_season(daily_avg, year, is_current_season=False):
    """Analysoi yhden talvikauden."""
    temps = daily_avg.values
    dates = daily_avg.index.tolist()

    cold_spells = find_all_cold_spells(temps, dates)

    if not cold_spells:
        return None

    significant_spells = [s for s in cold_spells if s['duration'] >= WINTER_CONSECUTIVE_DAYS]

    if not significant_spells:
        return None

    season_start = significant_spells[0]['start']
    # Käynnissä olevalle kaudelle ei aseteta päättymispäivää
    last_spell_end = significant_spells[-1]['end']
    season_end = None if is_current_season else last_spell_end

    # Käytä viimeisen pakkasjakson loppua tilastojen laskentaan
    season_mask = (daily_avg.index >= season_start) & (daily_avg.index <= last_spell_end)
    season_temps = daily_avg[season_mask]

    total_days = len(season_temps)
    frost_days = (season_temps < WINTER_THRESHOLD_TEMP).sum()

    coverage = round(frost_days / total_days * 100, 1) if total_days > 0 else 0

    warm_spells_in_season = find_all_warm_spells(
        season_temps.values,
        season_temps.index.tolist()
    )

    warm_days_in_season = sum(s['duration'] for s in warm_spells_in_season)
    fragmentation = round(warm_days_in_season / total_days, 2) if total_days > 0 else 0

    longest_cold = max(cold_spells, key=lambda x: x['duration'])
    coldest_temp = min(s['min_temp'] for s in cold_spells)

    return {
        'season': f'{year}/{year+1}',
        'season_start': season_start,
        'season_end': season_end,
        'total_days': total_days,
        'frost_days': int(frost_days),
        'coverage_pct': coverage,
        'fragmentation_index': fragmentation,
        'cold_spells_count': len(cold_spells),
        'warm_interruptions': len(warm_spells_in_season),
        'longest_cold_spell_days': longest_cold['duration'],
        'longest_cold_spell_start': longest_cold['start'],
        'coldest_temp': coldest_temp,
        'cold_spells': cold_spells,
        'warm_spells': warm_spells_in_season
    }


def analyze_winter_by_zone(df, zone_name):
    """Analysoi talvikaudet yhdelle vyöhykkeelle."""
    zone_data = df[df['zone_name'] == zone_name].copy()

    if len(zone_data) == 0:
        return None

    zone_data = zone_data.sort_values('date')
    results = []
    years = zone_data['date'].dt.year.unique()

    # Määritä nykyinen kausi (syys-toukokuu)
    today = pd.Timestamp.now()
    if today.month >= 9:
        current_season_year = today.year
    else:
        current_season_year = today.year - 1

    for year in years:
        start_date = pd.Timestamp(f'{year}-09-01')
        end_date = pd.Timestamp(f'{year+1}-05-31')

        season_data = zone_data[
            (zone_data['date'] >= start_date) &
            (zone_data['date'] <= end_date)
        ]

        if len(season_data) < 50:
            continue

        daily_avg = season_data.groupby('date')['Air temperature'].mean()

        if len(daily_avg) < WINTER_CONSECUTIVE_DAYS:
            continue

        # Onko tämä käynnissä oleva kausi?
        is_current = (year == current_season_year)
        season_analysis = analyze_winter_season(daily_avg, year, is_current_season=is_current)

        if season_analysis:
            season_analysis['zone'] = zone_name
            results.append(season_analysis)

    return results


def run_winter_analysis(df):
    """Suorita termisen talven analyysi."""
    print("\n" + "=" * 70)
    print("TERMISEN TALVEN ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Pakkasraja: < {WINTER_THRESHOLD_TEMP}°C")
    print(f"  - Merkittävä pakkasjakso: vähintään {WINTER_CONSECUTIVE_DAYS} päivää")

    zones = sorted(df['zone_name'].unique())
    all_results = []

    for zone in zones:
        print(f"\n{'-' * 70}")
        print(f"  {zone}")
        print(f"{'-' * 70}")

        zone_results = analyze_winter_by_zone(df, zone)

        if zone_results:
            all_results.extend(zone_results)

            for r in zone_results:
                print(f"\n  {r['season']}:")
                end_str = r['season_end'].strftime('%d.%m.%Y') if r['season_end'] else 'käynnissä'
                print(f"    Talvikausi: {r['season_start'].strftime('%d.%m.%Y')} - {end_str}")
                print(f"    Pakkaspäiviä: {r['frost_days']}/{r['total_days']} ({r['coverage_pct']}%)")
                print(f"    Pakkasjaksoja: {r['cold_spells_count']}")

    # Tallenna JSON
    if all_results:
        json_data = []
        for r in all_results:
            json_entry = {
                'zone': r['zone'],
                'season': r['season'],
                'season_start': r['season_start'].strftime('%Y-%m-%d'),
                'season_end': r['season_end'].strftime('%Y-%m-%d') if r['season_end'] else None,
                'total_days': r['total_days'],
                'frost_days': r['frost_days'],
                'coverage_pct': r['coverage_pct'],
                'fragmentation_index': r['fragmentation_index'],
                'cold_spells_count': r['cold_spells_count'],
                'warm_interruptions': r['warm_interruptions'],
                'longest_cold_spell_days': r['longest_cold_spell_days'],
                'coldest_temp': r['coldest_temp'],
                'cold_spells': [
                    {
                        'start': s['start'].strftime('%Y-%m-%d'),
                        'end': s['end'].strftime('%Y-%m-%d'),
                        'duration': s['duration'],
                        'min_temp': s['min_temp']
                    } for s in r['cold_spells']
                ],
                'warm_spells': [
                    {
                        'start': s['start'].strftime('%Y-%m-%d'),
                        'end': s['end'].strftime('%Y-%m-%d'),
                        'duration': s['duration'],
                        'max_temp': s['max_temp']
                    } for s in r['warm_spells']
                ]
            }
            json_data.append(json_entry)

        output_json = DATA_ANALYSIS / 'winter_analysis_detailed.json'
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"\n[OK] JSON tallennettu: {output_json}")


# ============================================================================
# 3. LIUKKAUSRISKI
# ============================================================================

def calculate_daily_slippery_risk(min_temp, max_temp):
    """Laske liukkausriski yksittäiselle päivälle."""
    if pd.isna(min_temp) or pd.isna(max_temp):
        return 0

    if min_temp < FREEZE_THAW_MIN and max_temp > FREEZE_THAW_MAX:
        if (HIGH_RISK_MIN_RANGE[0] < min_temp < HIGH_RISK_MIN_RANGE[1] and
            HIGH_RISK_MAX_RANGE[0] < max_temp < HIGH_RISK_MAX_RANGE[1]):
            return 1.5
        return 1.0

    if -2 < min_temp < 2 and -2 < max_temp < 2:
        return 0.5

    return 0


def find_slippery_season_start(daily_data, min_days=SEASON_START_THRESHOLD, window=7):
    """Etsi liukkauskauden alkamispäivä."""
    risks = daily_data['risk'].values
    dates = daily_data.index.tolist()

    for i in range(len(risks) - window + 1):
        window_risks = risks[i:i+window]
        risk_days = sum(1 for r in window_risks if r > 0)
        if risk_days >= min_days:
            return dates[i]

    return None


def find_slippery_periods(daily_data, min_duration=2):
    """Etsi kaikki liukkausjaksot."""
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
    """Analysoi yhden syksyn liukkausriskit."""
    start_date = pd.Timestamp(f'{year}-09-01')
    end_date = pd.Timestamp(f'{year}-12-15')

    mask = (df['zone_name'] == zone_name) & \
           (df['date'] >= start_date) & \
           (df['date'] <= end_date)

    zone_data = df[mask].copy()

    if len(zone_data) < 30:
        return None

    daily = zone_data.groupby('date').agg({
        'Minimum temperature': 'mean',
        'Maximum temperature': 'mean',
        'Snow depth': 'mean'
    }).rename(columns={
        'Minimum temperature': 'min_temp',
        'Maximum temperature': 'max_temp',
        'Snow depth': 'snow_depth'
    })

    daily['risk'] = daily.apply(
        lambda row: calculate_daily_slippery_risk(row['min_temp'], row['max_temp']),
        axis=1
    )

    season_start = find_slippery_season_start(daily)

    if not season_start:
        return None

    slippery_periods = find_slippery_periods(daily)

    risk_days = (daily['risk'] > 0).sum()
    high_risk_days = (daily['risk'] >= 1.5).sum()

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


def run_slippery_risk_analysis(df):
    """Suorita liukkausriskin analyysi."""
    print("\n" + "=" * 70)
    print("LIUKKAUSRISKIN ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Jäätymis-sulamis: yöllä < {FREEZE_THAW_MIN}°C, päivällä > {FREEZE_THAW_MAX}°C")

    zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi']
    years = sorted(df['date'].dt.year.unique())

    all_results = []

    for zone in zones:
        print(f"\n{'-' * 70}")
        print(f"  {zone}")
        print(f"{'-' * 70}")

        for year in years:
            result = analyze_autumn_slippery_risk(df, zone, year)

            if result:
                all_results.append(result)

                season_start_str = result['season_start'].strftime('%d.%m.%Y')

                print(f"\n  Syksy {year}:")
                print(f"    Liukkauskausi alkaa:         {season_start_str}")
                print(f"    Riskipäiviä yhteensä:        {result['risk_days_total']}")

    # Tallenna JSON
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
        print(f"\n[OK] JSON tallennettu: {output_json}")


# ============================================================================
# 4. SÄÄANOMALIAT
# ============================================================================

def find_extreme_cold(df, zone_name):
    """Tunnista äärimmäisen kylmät jaksot."""
    zone_data = df[df['zone_name'] == zone_name].copy()
    daily_min = zone_data.groupby('date')['Minimum temperature'].min().reset_index()

    extreme_cold = []
    i = 0
    while i < len(daily_min):
        if daily_min.iloc[i]['Minimum temperature'] <= EXTREME_COLD:
            start_date = daily_min.iloc[i]['date']
            min_temp = daily_min.iloc[i]['Minimum temperature']

            j = i
            while j < len(daily_min) and daily_min.iloc[j]['Minimum temperature'] <= EXTREME_COLD:
                min_temp = min(min_temp, daily_min.iloc[j]['Minimum temperature'])
                j += 1

            duration = j - i

            extreme_cold.append({
                'zone': zone_name,
                'start_date': start_date,
                'duration_days': duration,
                'min_temperature': min_temp,
                'type': 'Äärimmäinen kylmyys'
            })
            i = j
        else:
            i += 1

    return extreme_cold


def find_cold_snaps(df, zone_name):
    """Tunnista ankarat pakkasjakso."""
    zone_data = df[df['zone_name'] == zone_name].copy()
    daily_avg = zone_data.groupby('date')['Air temperature'].mean().reset_index()

    cold_snaps = []
    i = 0
    while i < len(daily_avg) - ANOMALY_CONSECUTIVE_DAYS + 1:
        window = daily_avg.iloc[i:i+ANOMALY_CONSECUTIVE_DAYS]['Air temperature']

        if all(temp <= COLD_SNAP_THRESHOLD for temp in window):
            start_date = daily_avg.iloc[i]['date']
            min_temp = window.min()

            j = i
            while j < len(daily_avg) and daily_avg.iloc[j]['Air temperature'] <= COLD_SNAP_THRESHOLD:
                min_temp = min(min_temp, daily_avg.iloc[j]['Air temperature'])
                j += 1

            duration = j - i

            cold_snaps.append({
                'zone': zone_name,
                'start_date': start_date,
                'duration_days': duration,
                'min_temperature': min_temp,
                'type': 'Ankara pakkasjakso'
            })
            i = j
        else:
            i += 1

    return cold_snaps


def find_heat_waves(df, zone_name):
    """Tunnista hellejaksot."""
    zone_data = df[df['zone_name'] == zone_name].copy()
    daily_max = zone_data.groupby('date')['Maximum temperature'].max().reset_index()

    heat_waves = []
    i = 0
    while i < len(daily_max) - ANOMALY_CONSECUTIVE_DAYS + 1:
        window = daily_max.iloc[i:i+ANOMALY_CONSECUTIVE_DAYS]['Maximum temperature']

        if all(temp >= HEAT_WAVE_THRESHOLD for temp in window):
            start_date = daily_max.iloc[i]['date']
            max_temp = window.max()

            j = i
            while j < len(daily_max) and daily_max.iloc[j]['Maximum temperature'] >= HEAT_WAVE_THRESHOLD:
                max_temp = max(max_temp, daily_max.iloc[j]['Maximum temperature'])
                j += 1

            duration = j - i

            heat_waves.append({
                'zone': zone_name,
                'start_date': start_date,
                'duration_days': duration,
                'max_temperature': max_temp,
                'type': 'Hellejakso'
            })
            i = j
        else:
            i += 1

    return heat_waves


def find_return_winters(df, zone_name):
    """Tunnista takatalvet (pakkasjakso kevään jälkeen)."""
    zone_data = df[df['zone_name'] == zone_name].copy()
    zone_data = zone_data.sort_values('date')

    daily_avg = zone_data.groupby('date')['Air temperature'].mean().reset_index()

    return_winters = []

    years = daily_avg['date'].dt.year.unique()

    for year in years:
        spring_start = pd.Timestamp(f'{year}-03-01')
        spring_end = pd.Timestamp(f'{year}-05-31')

        spring_data = daily_avg[
            (daily_avg['date'] >= spring_start) &
            (daily_avg['date'] <= spring_end)
        ].copy()

        if len(spring_data) < 10:
            continue

        spring_started = False
        spring_start_date = None

        for i in range(len(spring_data) - 5 + 1):
            window = spring_data.iloc[i:i+5]['Air temperature']
            if all(temp >= 0 for temp in window):
                spring_started = True
                spring_start_date = spring_data.iloc[i]['date']
                break

        if not spring_started:
            continue

        after_spring = spring_data[spring_data['date'] > spring_start_date]

        i = 0
        while i < len(after_spring) - ANOMALY_CONSECUTIVE_DAYS + 1:
            window = after_spring.iloc[i:i+ANOMALY_CONSECUTIVE_DAYS]['Air temperature']

            if all(temp < 0 for temp in window):
                start_date = after_spring.iloc[i]['date']
                min_temp = window.min()

                j = i
                while j < len(after_spring) and after_spring.iloc[j]['Air temperature'] < 0:
                    min_temp = min(min_temp, after_spring.iloc[j]['Air temperature'])
                    j += 1

                duration = j - i

                return_winters.append({
                    'zone': zone_name,
                    'year': year,
                    'start_date': start_date,
                    'duration_days': duration,
                    'min_temperature': min_temp,
                    'type': 'Takatalvi'
                })
                i = j
            else:
                i += 1

    return return_winters


def find_temperature_jumps(df, zone_name):
    """Tunnista äkilliset lämpötilan vaihtelut."""
    zone_data = df[df['zone_name'] == zone_name].copy()
    daily_avg = zone_data.groupby('date')['Air temperature'].mean().reset_index()
    daily_avg = daily_avg.sort_values('date')

    jumps = []

    for i in range(len(daily_avg) - 1):
        temp_change = daily_avg.iloc[i+1]['Air temperature'] - daily_avg.iloc[i]['Air temperature']

        if abs(temp_change) >= TEMPERATURE_JUMP:
            jumps.append({
                'zone': zone_name,
                'date': daily_avg.iloc[i]['date'],
                'next_date': daily_avg.iloc[i+1]['date'],
                'temp_from': daily_avg.iloc[i]['Air temperature'],
                'temp_to': daily_avg.iloc[i+1]['Air temperature'],
                'change': temp_change,
                'type': 'Äkillinen lämpeneminen' if temp_change > 0 else 'Äkillinen jäähtyminen'
            })

    return jumps


def run_weather_anomalies_analysis(df):
    """Suorita sääanomalioiden analyysi."""
    print("\n" + "=" * 70)
    print("SÄÄANOMALIOIDEN ANALYYSI")
    print("=" * 70)

    print(f"\nKriteerit:")
    print(f"  • Äärimmäinen kylmyys: <= {EXTREME_COLD}°C")
    print(f"  • Ankara pakkasjakso: <= {COLD_SNAP_THRESHOLD}°C vähintään {ANOMALY_CONSECUTIVE_DAYS} päivää")

    zones = sorted(df['zone_name'].unique())
    all_anomalies = []

    for zone in zones:
        print(f"\n{'-' * 70}")
        print(f"  {zone}")
        print(f"{'-' * 70}")

        extreme_cold = find_extreme_cold(df, zone)
        if extreme_cold:
            print(f"  Äärimmäinen kylmyys: {len(extreme_cold)} kpl")
            all_anomalies.extend(extreme_cold)

        cold_snaps = find_cold_snaps(df, zone)
        if cold_snaps:
            print(f"  Ankarat pakkasjakso: {len(cold_snaps)} kpl")
            all_anomalies.extend(cold_snaps)

        heat_waves = find_heat_waves(df, zone)
        if heat_waves:
            print(f"  Hellejaksot: {len(heat_waves)} kpl")
            all_anomalies.extend(heat_waves)

        return_winters = find_return_winters(df, zone)
        if return_winters:
            print(f"  Takatalvet: {len(return_winters)} kpl")
            all_anomalies.extend(return_winters)

        jumps = find_temperature_jumps(df, zone)
        if jumps:
            print(f"  Äkilliset lämpötilan vaihtelut: {len(jumps)} kpl")
            all_anomalies.extend(jumps)

    # Tallenna CSV
    if all_anomalies:
        results_df = pd.DataFrame(all_anomalies)
        output_file = DATA_ANALYSIS / 'weather_anomalies.csv'
        results_df.to_csv(output_file, index=False)
        print(f"\n[OK] CSV tallennettu: {output_file}")
        print(f"[OK] Yhteensa {len(all_anomalies)} anomaliaa tunnistettu")


# ============================================================================
# 5. ENSILUMI
# ============================================================================

SNOW_THRESHOLD = 1.0  # cm, pieni kynnys jotta satunnainen mittausvirhe ei häiritse


def analyze_autumn_first_snow(df, zone_name, year):
    """Analysoi syksyn ensilumi vyöhykkeelle."""
    start_date = pd.Timestamp(f'{year}-09-01')
    end_date = pd.Timestamp(f'{year}-12-31')

    mask = (df['zone_name'] == zone_name) & \
           (df['date'] >= start_date) & \
           (df['date'] <= end_date)

    zone_data = df[mask].copy()

    if len(zone_data) < 30:
        return None

    daily = zone_data.groupby('date').agg({
        'Snow depth': 'mean'
    }).rename(columns={
        'Snow depth': 'snow_depth'
    })

    # Etsi ensimmäinen päivä kun lunta maassa
    first_snow = None
    for date, row in daily.iterrows():
        if pd.notna(row['snow_depth']) and row['snow_depth'] >= SNOW_THRESHOLD:
            first_snow = {'date': date, 'snow_depth': row['snow_depth']}
            break

    if not first_snow:
        return None

    # Laske lumipäivien määrä syksyllä
    snow_days = (daily['snow_depth'] >= SNOW_THRESHOLD).sum()

    # Maksimilumensyvyys syksyllä
    max_snow = daily['snow_depth'].max()

    return {
        'zone': zone_name,
        'year': int(year),
        'first_snow_date': first_snow['date'],
        'first_snow_depth': float(round(first_snow['snow_depth'], 1)),
        'snow_days_total': int(snow_days),
        'max_snow_depth': float(round(max_snow, 1)) if pd.notna(max_snow) else None
    }


def run_first_snow_analysis(df):
    """Suorita ensilumi-analyysi."""
    print("\n" + "=" * 70)
    print("ENSILUMI-ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Ensilumi: lumensyvyys >= {SNOW_THRESHOLD} cm")
    print(f"  - Analysoitava kausi: syyskuu-joulukuu")

    zones = ['Etelä-Suomi', 'Keski-Suomi', 'Pohjois-Suomi', 'Lappi']
    years = sorted(df['date'].dt.year.unique())

    all_results = []

    for zone in zones:
        print(f"\n{'-' * 70}")
        print(f"  {zone}")
        print(f"{'-' * 70}")

        for year in years:
            result = analyze_autumn_first_snow(df, zone, year)

            if result:
                all_results.append(result)

                first_snow_str = result['first_snow_date'].strftime('%d.%m.%Y')

                print(f"\n  Syksy {year}:")
                print(f"    Ensilumi:                    {first_snow_str}")
                print(f"    Lumensyvyys:                 {result['first_snow_depth']:.1f} cm")
                print(f"    Lumipäiviä yhteensä:         {result['snow_days_total']}")
                print(f"    Maksimilumi:                 {result['max_snow_depth']:.1f} cm")

    # Tallenna JSON
    if all_results:
        json_data = []
        for r in all_results:
            json_entry = {
                'zone': r['zone'],
                'year': r['year'],
                'first_snow_date': r['first_snow_date'].strftime('%Y-%m-%d'),
                'first_snow_depth': r['first_snow_depth'],
                'snow_days_total': r['snow_days_total'],
                'max_snow_depth': r['max_snow_depth']
            }
            json_data.append(json_entry)

        output_json = VIZ_DATA / 'first_snow.json'
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"\n[OK] JSON tallennettu: {output_json}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("YHDISTETTY SÄÄDATA-ANALYYSI")
    print("=" * 70)

    # Lataa data
    df = load_weather_data()

    # Suorita analyysit
    run_first_frost_analysis(df)
    run_winter_analysis(df)
    run_slippery_risk_analysis(df)
    run_weather_anomalies_analysis(df)
    run_first_snow_analysis(df)

    print("\n" + "=" * 70)
    print("KAIKKI ANALYYSIT VALMIIT")
    print("=" * 70)


if __name__ == "__main__":
    main()
