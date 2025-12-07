"""Analysoi sääanomalioita ja ääri-ilmiöitä.

Tunnistaa:
- Takatalvet (pakkasjakso kevään jälkeen)
- Lämpöaallot
- Poikkeuksellisen kylmät jaksot
- Äkilliset lämpötilan vaihtelut
- Lumipeitteen poikkeamat
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

# Määritä polut
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_ANALYSIS = PROJECT_ROOT / "data" / "analysis"

# Kriteerit
COLD_SNAP_THRESHOLD = -15.0  # °C (ankara pakkanen)
HEAT_WAVE_THRESHOLD = 25.0   # °C (hellejakso)
TEMPERATURE_JUMP = 15.0      # °C (äkillinen lämpötilan nousu/lasku)
EXTREME_COLD = -25.0         # °C (äärimmäinen kylmyys)
CONSECUTIVE_DAYS = 3         # Kuinka monta päivää ääri-ilmiön pitää kestää

def find_extreme_cold(df, zone_name):
    """Tunnista äärimmäisen kylmät jaksot (< -25°C)."""
    zone_data = df[df['zone_name'] == zone_name].copy()

    # Ryhmittele päivän mukaan ja laske min lämpötila
    daily_min = zone_data.groupby('date')['Minimum temperature'].min().reset_index()

    extreme_cold = []
    i = 0
    while i < len(daily_min):
        if daily_min.iloc[i]['Minimum temperature'] <= EXTREME_COLD:
            start_date = daily_min.iloc[i]['date']
            min_temp = daily_min.iloc[i]['Minimum temperature']

            # Laske jakson pituus
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

    # Ryhmittele päivän mukaan ja laske keskiarvo
    daily_avg = zone_data.groupby('date')['Air temperature'].mean().reset_index()

    cold_snaps = []
    i = 0
    while i < len(daily_avg) - CONSECUTIVE_DAYS + 1:
        window = daily_avg.iloc[i:i+CONSECUTIVE_DAYS]['Air temperature']

        if all(temp <= COLD_SNAP_THRESHOLD for temp in window):
            start_date = daily_avg.iloc[i]['date']
            min_temp = window.min()

            # Laske koko jakson pituus
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
    """Tunnista hellejaksot (maksimilämpötila >= 25°C vähintään 3 päivää)."""
    zone_data = df[df['zone_name'] == zone_name].copy()

    # Ryhmittele päivän mukaan ja ota maksimilämpötila
    daily_max = zone_data.groupby('date')['Maximum temperature'].max().reset_index()

    heat_waves = []
    i = 0
    while i < len(daily_max) - CONSECUTIVE_DAYS + 1:
        window = daily_max.iloc[i:i+CONSECUTIVE_DAYS]['Maximum temperature']

        if all(temp >= HEAT_WAVE_THRESHOLD for temp in window):
            start_date = daily_max.iloc[i]['date']
            max_temp = window.max()

            # Laske koko jakson pituus
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
    """Tunnista takatalvet (pakkasjakso kevään jälkeen).

    Takatalvi = lämpötila laskee alle 0°C vähintään 3 päiväksi
    maaliskuun jälkeen, kun kevät on jo alkanut.
    """
    zone_data = df[df['zone_name'] == zone_name].copy()
    zone_data = zone_data.sort_values('date')

    # Ryhmittele päivän mukaan
    daily_avg = zone_data.groupby('date')['Air temperature'].mean().reset_index()

    return_winters = []

    # Käy läpi vuodet
    years = daily_avg['date'].dt.year.unique()

    for year in years:
        # Hae kevään data (1.3. - 31.5.)
        spring_start = pd.Timestamp(f'{year}-03-01')
        spring_end = pd.Timestamp(f'{year}-05-31')

        spring_data = daily_avg[
            (daily_avg['date'] >= spring_start) &
            (daily_avg['date'] <= spring_end)
        ].copy()

        if len(spring_data) < 10:
            continue

        # Etsi ensin onko kevät alkanut (5 päivää yli 0°C)
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

        # Etsi takatalvet kevään alun jälkeen
        after_spring = spring_data[spring_data['date'] > spring_start_date]

        i = 0
        while i < len(after_spring) - CONSECUTIVE_DAYS + 1:
            window = after_spring.iloc[i:i+CONSECUTIVE_DAYS]['Air temperature']

            if all(temp < 0 for temp in window):
                start_date = after_spring.iloc[i]['date']
                min_temp = window.min()

                # Laske koko jakson pituus
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

    # Ryhmittele päivän mukaan
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

def main():
    print("=" * 80)
    print("SÄÄANOMALIOIDEN JA ÄÄRI-ILMIÖIDEN ANALYYSI")
    print("=" * 80)

    print(f"\nKriteerit:")
    print(f"  • Äärimmäinen kylmyys: Min lämpötila <= {EXTREME_COLD}°C")
    print(f"  • Ankara pakkasjakso: Lämpötila <= {COLD_SNAP_THRESHOLD}°C vähintään {CONSECUTIVE_DAYS} päivää")
    print(f"  • Hellejakso: Max lämpötila >= {HEAT_WAVE_THRESHOLD}°C vähintään {CONSECUTIVE_DAYS} päivää")
    print(f"  • Takatalvi: Pakkasjakso (< 0°C) kevään jälkeen (maalis-toukokuu)")
    print(f"  • Äkillinen lämpötilan vaihtelu: >= {TEMPERATURE_JUMP}°C muutos vuorokaudessa")

    # Lue data
    csv_file = DATA_RAW / 'weather_data_2022_2025_all.csv'
    print(f"\nLuetaan tiedosto: {csv_file}")

    df = pd.read_csv(csv_file)
    df['date'] = pd.to_datetime(df['date'])

    print(f"  ✓ {len(df)} havaintoa")
    print(f"  ✓ Aikaväli: {df['date'].min().strftime('%d.%m.%Y')} - {df['date'].max().strftime('%d.%m.%Y')}")

    zones = sorted(df['zone_name'].unique())

    all_anomalies = []

    # Analysoi vyöhykkeittäin
    for zone in zones:
        print(f"\n" + "=" * 80)
        print(f"VYÖHYKE: {zone}")
        print("=" * 80)

        # Äärimmäinen kylmyys
        extreme_cold = find_extreme_cold(df, zone)
        if extreme_cold:
            print(f"\nÄÄRIMMÄINEN KYLMYYS ({len(extreme_cold)} kpl):")
            for cold in extreme_cold:
                print(f"  • {cold['start_date'].strftime('%d.%m.%Y')}: "
                      f"{cold['duration_days']} päivää, alin {cold['min_temperature']:.1f}°C")
            all_anomalies.extend(extreme_cold)

        # Ankarat pakkasjakso
        cold_snaps = find_cold_snaps(df, zone)
        if cold_snaps:
            print(f"\nANKARAT PAKKASJAKSOT ({len(cold_snaps)} kpl):")
            for snap in cold_snaps:
                print(f"  • {snap['start_date'].strftime('%d.%m.%Y')}: "
                      f"{snap['duration_days']} päivää, alin {snap['min_temperature']:.1f}°C")
            all_anomalies.extend(cold_snaps)

        # Hellejaksot
        heat_waves = find_heat_waves(df, zone)
        if heat_waves:
            print(f"\nHELLEJAKSOT ({len(heat_waves)} kpl):")
            for wave in heat_waves:
                print(f"  • {wave['start_date'].strftime('%d.%m.%Y')}: "
                      f"{wave['duration_days']} päivää, ylin {wave['max_temperature']:.1f}°C")
            all_anomalies.extend(heat_waves)

        # Takatalvet
        return_winters = find_return_winters(df, zone)
        if return_winters:
            print(f"\nTAKATALVET ({len(return_winters)} kpl):")
            for rw in return_winters:
                print(f"  • {rw['start_date'].strftime('%d.%m.%Y')} ({rw['year']}): "
                      f"{rw['duration_days']} päivää, alin {rw['min_temperature']:.1f}°C")
            all_anomalies.extend(return_winters)

        # Äkilliset lämpötilan vaihtelut
        jumps = find_temperature_jumps(df, zone)
        if jumps:
            # Näytä vain merkittävimmät (suurimmat muutokset)
            jumps_sorted = sorted(jumps, key=lambda x: abs(x['change']), reverse=True)
            print(f"\nÄKILLISET LÄMPÖTILAN VAIHTELUT (top 5/{len(jumps)} kpl):")
            for jump in jumps_sorted[:5]:
                print(f"  • {jump['date'].strftime('%d.%m.%Y')}: "
                      f"{jump['temp_from']:.1f}°C → {jump['temp_to']:.1f}°C "
                      f"({jump['change']:+.1f}°C)")
            all_anomalies.extend(jumps)

    # Tallenna tulokset
    if all_anomalies:
        results_df = pd.DataFrame(all_anomalies)
        output_file = DATA_ANALYSIS / 'weather_anomalies.csv'
        results_df.to_csv(output_file, index=False)
        print(f"\n" + "=" * 80)
        print(f"✓ Tulokset tallennettu: {output_file}")
        print(f"✓ Yhteensä {len(all_anomalies)} anomaliaa tunnistettu")
        print("=" * 80)

        # Yhteenveto
        print(f"\nYHTEENVETO:")
        anomaly_types = results_df['type'].value_counts()
        for anomaly_type, count in anomaly_types.items():
            print(f"  • {anomaly_type}: {count} kpl")

if __name__ == "__main__":
    main()
