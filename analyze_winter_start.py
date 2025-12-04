"""Analysoi talven alkamisen päivämäärät eri vyöhykkeillä.

Terminen talvi alkaa, kun vuorokauden keskilämpötila
laskee pysyvästi 0°C alapuolelle (yleensä vaaditaan 5 vrk putki).
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Määritelmä: Terminen talvi alkaa, kun lämpötila pysyy alle 0°C vähintään N päivää
WINTER_THRESHOLD_TEMP = 0.0  # °C
CONSECUTIVE_DAYS = 5  # Kuinka monta peräkkäistä päivää pakkasen pitää kestää

def find_winter_start(temps, dates, consecutive_days=CONSECUTIVE_DAYS):
    """
    Etsii termisen talven alkamispäivän.

    Palauttaa ensimmäisen päivän, josta alkaa vähintään N päivän
    pakkasjakso (keskilämpötila < 0°C).
    """
    if len(temps) < consecutive_days:
        return None

    for i in range(len(temps) - consecutive_days + 1):
        # Tarkista onko seuraavat N päivää kaikki alle 0°C
        window = temps[i:i + consecutive_days]

        # Ohita NaN-arvot
        if pd.isna(window).any():
            continue

        if all(temp < WINTER_THRESHOLD_TEMP for temp in window):
            return dates[i]

    return None

def find_winter_end(temps, dates, consecutive_days=CONSECUTIVE_DAYS):
    """
    Etsii termisen talven päättymispäivän (kevään alkamisen).

    Palauttaa ensimmäisen päivän, josta alkaa vähintään N päivän
    plussakausi (keskilämpötila >= 0°C).
    """
    if len(temps) < consecutive_days:
        return None

    for i in range(len(temps) - consecutive_days + 1):
        window = temps[i:i + consecutive_days]

        if pd.isna(window).any():
            continue

        if all(temp >= WINTER_THRESHOLD_TEMP for temp in window):
            return dates[i]

    return None

def analyze_winter_by_zone(df, zone_name):
    """Analysoi talven alkamisen yhdelle vyöhykkeelle."""
    zone_data = df[df['zone_name'] == zone_name].copy()

    if len(zone_data) == 0:
        return None

    # Järjestä päivämäärän mukaan
    zone_data = zone_data.sort_values('date')

    # Ryhmittele vuoden mukaan (talvikausi = loka-touko)
    # Tämä on monimutkaisempi, koska talvi ylittää vuodenvaihteen
    results = []

    # Käsitellään syys-talvikausi per vuosi
    years = zone_data['date'].dt.year.unique()

    for year in years:
        # Hae data 1.9.year - 31.5.(year+1)
        start_date = pd.Timestamp(f'{year}-09-01')
        end_date = pd.Timestamp(f'{year+1}-05-31')

        season_data = zone_data[
            (zone_data['date'] >= start_date) &
            (zone_data['date'] <= end_date)
        ]

        if len(season_data) < 50:  # Liian vähän dataa
            continue

        # Ryhmittele päivämäärän mukaan ja laske keskiarvo per päivä (kaikista asemista)
        daily_avg = season_data.groupby('date')['Air temperature'].mean()

        if len(daily_avg) < CONSECUTIVE_DAYS:
            continue

        # Etsi talven alku
        winter_start = find_winter_start(
            daily_avg.values,
            daily_avg.index
        )

        # Etsi talven loppu (vain jos talvi alkoi)
        winter_end = None
        if winter_start:
            # Hae data talven alusta eteenpäin
            after_start = daily_avg[daily_avg.index >= winter_start]
            winter_end = find_winter_end(
                after_start.values,
                after_start.index
            )

        if winter_start:
            results.append({
                'zone': zone_name,
                'season': f'{year}/{year+1}',
                'winter_start': winter_start,
                'winter_end': winter_end,
                'winter_start_day_of_year': winter_start.timetuple().tm_yday,
                'winter_duration_days': (winter_end - winter_start).days if winter_end else None
            })

    return pd.DataFrame(results)

def main():
    print("=" * 70)
    print("TERMISEN TALVEN ALKAMISEN ANALYYSI")
    print("=" * 70)
    print(f"\nKriteerit:")
    print(f"  - Lämpötila: < {WINTER_THRESHOLD_TEMP}°C")
    print(f"  - Kesto: vähintään {CONSECUTIVE_DAYS} peräkkäistä päivää")
    print(f"  - Lasketaan vyöhykkeen keskiarvo kaikista asemista")

    # Lue data
    csv_file = 'weather_data_2022_2025_all.csv'
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
        print(f"\n{zone}:")
        zone_results = analyze_winter_by_zone(df, zone)

        if zone_results is not None and len(zone_results) > 0:
            all_results.append(zone_results)

            for _, row in zone_results.iterrows():
                print(f"  {row['season']:>10}: Talvi alkoi {row['winter_start'].strftime('%d.%m.%Y')} "
                      f"(päivä {row['winter_start_day_of_year']}/365)", end="")
                if pd.notna(row['winter_end']):
                    print(f", päättyi {row['winter_end'].strftime('%d.%m.%Y')} "
                          f"({int(row['winter_duration_days'])} päivää)")
                else:
                    print(f", ei vielä päättynyt")
        else:
            print(f"  Ei riittävästi dataa analyysiin")

    # Yhdistä tulokset
    if all_results:
        final_results = pd.concat(all_results, ignore_index=True)

        # Tallenna tulokset
        output_file = 'winter_start_analysis.csv'
        final_results.to_csv(output_file, index=False)
        print(f"\n✓ Tulokset tallennettu: {output_file}")

        # Yhteenveto
        print("\n" + "=" * 70)
        print("YHTEENVETO")
        print("=" * 70)

        for zone in sorted(final_results['zone'].unique()):
            zone_data = final_results[final_results['zone'] == zone]
            avg_day = zone_data['winter_start_day_of_year'].mean()
            min_day = zone_data['winter_start_day_of_year'].min()
            max_day = zone_data['winter_start_day_of_year'].max()

            print(f"\n{zone}:")
            print(f"  Keskimäärin: päivä {avg_day:.0f} (vaihtelu {min_day}-{max_day})")
            print(f"  Aikaisin: {zone_data.loc[zone_data['winter_start_day_of_year'].idxmin(), 'winter_start'].strftime('%d.%m.%Y')}")
            print(f"  Myöhäisin: {zone_data.loc[zone_data['winter_start_day_of_year'].idxmax(), 'winter_start'].strftime('%d.%m.%Y')}")

if __name__ == "__main__":
    main()
