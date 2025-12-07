"""Analysoi talven alkamisen päivämäärät eri vyöhykkeillä.

Terminen talvi alkaa, kun vuorokauden keskilämpötila
laskee pysyvästi 0°C alapuolelle (yleensä vaaditaan 5 vrk putki).

Tämä versio käsittelee myös katkonaiset talvet ja laskee:
- Kaikki pakkasjaksot kaudella
- Talvikauden kokonaiskattavuus (% pakkaspäivistä)
- Katkonaisuusindeksi
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
from pathlib import Path

# Määritä polut
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_ANALYSIS = PROJECT_ROOT / "data" / "analysis"

# Määritelmä: Terminen talvi alkaa, kun lämpötila pysyy alle 0°C vähintään N päivää
WINTER_THRESHOLD_TEMP = 0.0  # °C
CONSECUTIVE_DAYS = 5  # Kuinka monta peräkkäistä päivää pakkasen pitää kestää
MIN_COLD_SPELL_DAYS = 3  # Minimi pakkasjakson pituus tilastointiin


def find_all_cold_spells(temps, dates, min_days=MIN_COLD_SPELL_DAYS):
    """
    Etsii kaikki pakkasjaksot datasta.

    Palauttaa listan pakkasjaksoista:
    [{'start': date, 'end': date, 'duration': int, 'min_temp': float}, ...]
    """
    if len(temps) < min_days:
        return []

    cold_spells = []
    i = 0

    while i < len(temps):
        # Ohita NaN-arvot
        if pd.isna(temps[i]):
            i += 1
            continue

        # Etsi pakkasjakson alku
        if temps[i] < WINTER_THRESHOLD_TEMP:
            start_idx = i
            min_temp = temps[i]

            # Etsi jakson loppu
            while i < len(temps) and not pd.isna(temps[i]) and temps[i] < WINTER_THRESHOLD_TEMP:
                min_temp = min(min_temp, temps[i])
                i += 1

            duration = i - start_idx

            # Tallenna vain riittävän pitkät jaksot
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
    """
    Etsii kaikki lämpimät jaksot (katkot talvessa) datasta.

    Palauttaa listan lämpöjaksoista:
    [{'start': date, 'end': date, 'duration': int, 'max_temp': float}, ...]
    """
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


def analyze_winter_season(daily_avg, year):
    """
    Analysoi yhden talvikauden kokonaisuutena.

    Palauttaa kattavan analyysin talvikaudesta mukaan lukien:
    - Talvikauden rajat
    - Kaikki pakkasjaksot
    - Lämpökatkot
    - Tilastot (kattavuus, katkonaisuus)
    """
    temps = daily_avg.values
    dates = daily_avg.index.tolist()

    # Etsi kaikki pakkasjaksot
    cold_spells = find_all_cold_spells(temps, dates)

    if not cold_spells:
        return None

    # Talvikauden rajat: ensimmäisestä viimeiseen merkittävään pakkasjaksoon
    # Merkittävä = vähintään CONSECUTIVE_DAYS päivää
    significant_spells = [s for s in cold_spells if s['duration'] >= CONSECUTIVE_DAYS]

    if not significant_spells:
        return None

    season_start = significant_spells[0]['start']
    season_end = significant_spells[-1]['end']

    # Laske pakkaspäivät talvikauden aikana
    season_mask = (daily_avg.index >= season_start) & (daily_avg.index <= season_end)
    season_temps = daily_avg[season_mask]

    total_days = len(season_temps)
    frost_days = (season_temps < WINTER_THRESHOLD_TEMP).sum()

    # Kattavuusprosentti
    coverage = round(frost_days / total_days * 100, 1) if total_days > 0 else 0

    # Etsi lämpökatkot talvikauden sisällä
    warm_spells_in_season = find_all_warm_spells(
        season_temps.values,
        season_temps.index.tolist()
    )

    # Katkonaisuusindeksi: 0 = yhtenäinen, 1 = hyvin katkonainen
    # Perustuu lämpökatkojen määrään ja kestoon suhteessa talvikauteen
    warm_days_in_season = sum(s['duration'] for s in warm_spells_in_season)
    fragmentation = round(warm_days_in_season / total_days, 2) if total_days > 0 else 0

    # Pisin pakkasjakso
    longest_cold = max(cold_spells, key=lambda x: x['duration'])

    # Kylmin lämpötila
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

    for year in years:
        # Hae data 1.9.year - 31.5.(year+1)
        start_date = pd.Timestamp(f'{year}-09-01')
        end_date = pd.Timestamp(f'{year+1}-05-31')

        season_data = zone_data[
            (zone_data['date'] >= start_date) &
            (zone_data['date'] <= end_date)
        ]

        if len(season_data) < 50:
            continue

        # Ryhmittele päivämäärän mukaan ja laske keskiarvo
        daily_avg = season_data.groupby('date')['Air temperature'].mean()

        if len(daily_avg) < CONSECUTIVE_DAYS:
            continue

        # Analysoi talvikausi
        season_analysis = analyze_winter_season(daily_avg, year)

        if season_analysis:
            season_analysis['zone'] = zone_name
            results.append(season_analysis)

    return results


def main():
    print("=" * 70)
    print("TERMISEN TALVEN ANALYYSI (KATKONAISET TALVET)")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Pakkasraja: < {WINTER_THRESHOLD_TEMP}°C")
    print(f"  - Merkittävä pakkasjakso: vähintään {CONSECUTIVE_DAYS} päivää")
    print(f"  - Tilastoitava jakso: vähintään {MIN_COLD_SPELL_DAYS} päivää")
    print(f"  - Lasketaan vyöhykkeen keskiarvo kaikista asemista")

    # Lue data
    csv_file = DATA_RAW / 'weather_data_2022_2025_all.csv'
    print(f"\nLuetaan tiedosto: {csv_file}")

    df = pd.read_csv(csv_file)
    df['date'] = pd.to_datetime(df['date'])

    print(f"  ✓ {len(df)} havaintoa")
    print(f"  ✓ Aikaväli: {df['date'].min()} - {df['date'].max()}")

    # Analysoi vyöhykkeittäin
    print("\n" + "=" * 70)
    print("ANALYYSI VYÖHYKKEITTÄIN")
    print("=" * 70)

    zones = df['zone_name'].unique()
    all_results = []

    for zone in sorted(zones):
        print(f"\n{'─' * 70}")
        print(f"  {zone}")
        print(f"{'─' * 70}")

        zone_results = analyze_winter_by_zone(df, zone)

        if zone_results:
            all_results.extend(zone_results)

            for r in zone_results:
                print(f"\n  {r['season']}:")
                print(f"    Talvikausi: {r['season_start'].strftime('%d.%m.%Y')} - {r['season_end'].strftime('%d.%m.%Y')}")
                print(f"    Kesto: {r['total_days']} päivää, joista pakkasta {r['frost_days']} ({r['coverage_pct']}%)")
                print(f"    Pakkasjaksoja: {r['cold_spells_count']}, lämpökatkoja: {r['warm_interruptions']}")
                print(f"    Pisin pakkasjakso: {r['longest_cold_spell_days']} päivää (alkaen {r['longest_cold_spell_start'].strftime('%d.%m.%Y')})")
                print(f"    Kylmin lämpötila: {r['coldest_temp']}°C")
                print(f"    Katkonaisuusindeksi: {r['fragmentation_index']:.2f}", end="")

                if r['fragmentation_index'] < 0.1:
                    print(" (yhtenäinen talvi)")
                elif r['fragmentation_index'] < 0.3:
                    print(" (lievästi katkonainen)")
                else:
                    print(" (katkonainen talvi)")
        else:
            print(f"  Ei riittävästi dataa analyysiin")

    # Tallenna tulokset
    if all_results:
        # CSV-versio (yksinkertaistettu)
        csv_data = []
        for r in all_results:
            csv_data.append({
                'zone': r['zone'],
                'season': r['season'],
                'season_start': r['season_start'].strftime('%Y-%m-%d'),
                'season_end': r['season_end'].strftime('%Y-%m-%d'),
                'total_days': r['total_days'],
                'frost_days': r['frost_days'],
                'coverage_pct': r['coverage_pct'],
                'fragmentation_index': r['fragmentation_index'],
                'cold_spells_count': r['cold_spells_count'],
                'warm_interruptions': r['warm_interruptions'],
                'longest_cold_spell_days': r['longest_cold_spell_days'],
                'coldest_temp': r['coldest_temp']
            })

        csv_df = pd.DataFrame(csv_data)
        output_csv = DATA_ANALYSIS / 'winter_start_analysis.csv'
        csv_df.to_csv(output_csv, index=False)
        print(f"\n✓ CSV tallennettu: {output_csv}")

        # JSON-versio (täysi data visualisointia varten)
        json_data = []
        for r in all_results:
            json_entry = {
                'zone': r['zone'],
                'season': r['season'],
                'season_start': r['season_start'].strftime('%Y-%m-%d'),
                'season_end': r['season_end'].strftime('%Y-%m-%d'),
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
            json_data.append(json_entry)

        output_json = DATA_ANALYSIS / 'winter_analysis_detailed.json'
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"✓ JSON tallennettu: {output_json}")

        # Yhteenveto
        # Yhteenveto
        print("\n" + "=" * 70)
        print("YHTEENVETO")
        print("=" * 70)

        for zone in sorted(set(r['zone'] for r in all_results)):
            zone_data = [r for r in all_results if r['zone'] == zone]

            avg_coverage = np.mean([r['coverage_pct'] for r in zone_data])
            avg_fragmentation = np.mean([r['fragmentation_index'] for r in zone_data])
            avg_duration = np.mean([r['total_days'] for r in zone_data])

            print(f"\n{zone}:")
            print(f"  Keskimääräinen talvikauden pituus: {avg_duration:.0f} päivää")
            print(f"  Keskimääräinen pakkaskattavuus: {avg_coverage:.1f}%")
            print(f"  Keskimääräinen katkonaisuus: {avg_fragmentation:.2f}")


if __name__ == "__main__":
    main()
