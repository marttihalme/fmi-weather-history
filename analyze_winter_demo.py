"""Demoskripti - Näyttää kuinka talven alkaminen tunnistetaan datasta.

Tämä skripti analysoi termisen talven alkamisen ja päättymisen datasta.
"""
import pandas as pd
import numpy as np

# Määritelmät
WINTER_THRESHOLD = 0.0  # °C
CONSECUTIVE_DAYS = 5    # Päivää peräkkäin

def find_period_start(temps, dates, threshold, consecutive_days, below=True):
    """
    Etsii jakson, jossa lämpötila on jatkuvasti kynnysarvon yli/ali.

    Args:
        temps: Lämpötilat
        dates: Päivämäärät
        threshold: Kynnysarvo (°C)
        consecutive_days: Montako päivää peräkkäin
        below: True = etsitään jaksoa alle kynnysarvon, False = yli
    """
    for i in range(len(temps) - consecutive_days + 1):
        window = temps[i:i + consecutive_days]

        if pd.isna(window).any():
            continue

        if below:
            if all(temp < threshold for temp in window):
                return dates[i]
        else:
            if all(temp >= threshold for temp in window):
                return dates[i]

    return None

print("=" * 80)
print("TERMISEN TALVEN TUNNISTAMINEN DATASTA - DEMO")
print("=" * 80)

print(f"\nTERMINEN TALVI määritellään seuraavasti:")
print(f"  ✓ Talvi ALKAA kun vuorokauden keskilämpötila laskee < {WINTER_THRESHOLD}°C")
print(f"  ✓ Lämpötilan pitää pysyä alle {WINTER_THRESHOLD}°C vähintään {CONSECUTIVE_DAYS} peräkkäistä päivää")
print(f"  ✓ Talvi PÄÄTTYY kun lämpötila nousee >= {WINTER_THRESHOLD}°C {CONSECUTIVE_DAYS} päivän ajaksi")

# Lue data
print(f"\n{'='*80}")
print("DATAN LATAUS")
print("=" * 80)

df = pd.read_csv('weather_data_2022_2025_all.csv')
df['date'] = pd.to_datetime(df['date'])

print(f"✓ Ladattu {len(df)} havaintoa")
print(f"✓ Aikaväli: {df['date'].min().strftime('%d.%m.%Y')} - {df['date'].max().strftime('%d.%m.%Y')}")
print(f"✓ Vyöhykkeitä: {df['zone_name'].nunique()}")
print(f"✓ Asemia: {df['station_name'].nunique()}")

# Analysoi vyöhykkeittäin
print(f"\n{'='*80}")
print("ANALYYSI: TALVEN PÄÄTTYMINEN (KEVÄÄN ALKU) 2024")
print("=" * 80)

zones = sorted(df['zone_name'].unique())

for zone in zones:
    print(f"\n{zone}:")
    print("-" * 80)

    # Suodata vyöhykkeen data
    zone_data = df[df['zone_name'] == zone].copy()

    # Laske päivittäinen keskiarvo kaikista vyöhykkeen asemista
    daily_avg = zone_data.groupby('date').agg({
        'Air temperature': 'mean',
        'station_name': 'count'
    }).rename(columns={'station_name': 'num_stations'})

    print(f"  Asemia vyöhykkeellä: {zone_data['station_name'].nunique()}")
    print(f"  Päivittäisiä keskiarvoja: {len(daily_avg)}")

    # Näytä lämpötilakehitys
    print(f"\n  Lämpötilakehitys (vyöhykkeen keskiarvo):")
    print(f"  {'Päivä':<12} {'Keskim. °C':<12} {'Min °C':<10} {'Max °C':<10} {'Status'}")

    for date, row in daily_avg.head(20).iterrows():
        temp = row['Air temperature']
        zone_day = zone_data[zone_data['date'] == date]
        min_temp = zone_day['Air temperature'].min()
        max_temp = zone_day['Air temperature'].max()

        status = "TALVI ❄️" if temp < WINTER_THRESHOLD else "SUOJA 🌡️"

        print(f"  {date.strftime('%d.%m.%Y'):<12} {temp:>6.1f}°C       "
              f"{min_temp:>6.1f}°C   {max_temp:>6.1f}°C   {status}")

    # Etsi kevään alku (termisen talven päättyminen)
    spring_start = find_period_start(
        daily_avg['Air temperature'].values,
        daily_avg.index,
        WINTER_THRESHOLD,
        CONSECUTIVE_DAYS,
        below=False  # Etsitään jaksoa YLLÄ 0°C
    )

    print(f"\n  ANALYYSI:")
    if spring_start:
        print(f"  ✓ Terminen talvi päättyi (kevät alkoi): {spring_start.strftime('%d.%m.%Y')}")
        print(f"    → Tämä oli ensimmäinen päivä {CONSECUTIVE_DAYS} päivän plussajaksosta")
    else:
        print(f"  ✗ Terminen talvi ei vielä päättynyt tässä datassa")
        print(f"    → Lämpötila ei pysynyt >= {WINTER_THRESHOLD}°C {CONSECUTIVE_DAYS} päivää")

# Yhteenveto
print(f"\n{'='*80}")
print("YHTEENVETO: KUINKA TUNNISTAA TALVEN ALKAMINEN")
print("=" * 80)

print(f"""
1. TERMINEN TALVI ALKAA:
   - Kun vuorokauden KESKILÄMPÖTILA laskee < 0°C
   - Ja pysyy siellä vähintään 5 peräkkäistä päivää
   - Yleensä Etelä-Suomessa: marras-joulukuu
   - Yleensä Lapissa: loka-marraskuu

2. TERMINEN TALVI PÄÄTTYY:
   - Kun vuorokauden keskilämpötila nousee >= 0°C
   - Ja pysyy siellä vähintään 5 peräkkäistä päivää
   - Yleensä Etelä-Suomessa: maalis-huhtikuu
   - Yleensä Lapissa: huhti-toukokuu

3. DATAN KÄSITTELY:
   - Lasketaan PÄIVITTÄINEN KESKIARVO kaikista vyöhykkeen asemista
   - Etsitään ensimmäinen päivä, josta alkaa 5 vrk jakso
   - Tämä on luotettavampi kuin yhden aseman data

4. ANOMALIOIDEN TUNNISTUS:
   - AIKAINEN TALVI: Alkaa >2 viikkoa aikaisemmin kuin keskimäärin
   - MYÖHÄINEN TALVI: Alkaa >2 viikkoa myöhemmin kuin keskimäärin
   - TAKATALVI: Pitkä plussakausi talven keskellä, sitten paluu pakkaselle
   - LYHYT TALVI: Kestää vähemmän aikaa kuin keskimäärin

SEURAAVA ASKEL:
- Hae 15 vuoden data (2010-2025) → python fetch_historical_data.py
- Analysoi talven alkaminen joka vuodelle joka vyöhykkeellä
- Tunnista poikkeavat vuodet ja ilmiöt
""")
