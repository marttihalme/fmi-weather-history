# FMI Säädatan keräys ja analyysi

Projekti kerää historiallista säädataa Ilmatieteen laitokselta ja analysoi talven alkamista sekä sääanomalioita Suomen eri ilmastovyöhykkeillä. Tällä hetkellä haetaan 3 vuoden data (2022-2025), mutta sitä voidaan laajentaa.

## Pikaohje

### 1. Asenna riippuvuudet

```bash
# Luo virtuaaliympäristö
python3 -m venv venv

# Aktivoi virtuaaliympäristö
source venv/bin/activate

# Asenna riippuvuudet
pip install -r requirements.txt
```

**HUOM:** Joka kerta kun avaat uuden terminaali-istunnon, muista aktivoida venv:
```bash
source venv/bin/activate
```

### 2. Testaa datan keräys (suositus ensin!)

```bash
# Aktivoi venv (jos et vielä aktivoinut)
source venv/bin/activate

# Testaa pienellä aineistolla (2024 Q1, ~25,000 havaintoa)
python test_fetch.py
```

Tämä hakee 3 kuukauden datan kaikilta 275 asemalta ja tallentaa `test_2024_q1.csv`:ksi.

### 3. Kerää historiadata (3 vuotta: 2022-2025)

```bash
# Aktivoi venv
source venv/bin/activate

# Hae 3 vuoden data (~300,000 havaintoa, kestää ~30-60 min)
python fetch_historical_data.py
```

Tämä:
- Hakee datan ajalta 2022-2025 (3 vuotta)
- Jakaa asemat neljään vyöhykkeeseen (leveysasteen mukaan)
- Tallentaa kokonaisdatan + vyöhykekohtaiset tiedostot
- Voidaan myöhemmin laajentaa pidemmälle historiaan

### 4. Analysoi talven alkaminen

```bash
# Aktivoi venv
source venv/bin/activate

# Demo-analyysi testidatalla
python analyze_winter_demo.py

# Täysi analyysi (kun historiadata on haettu)
python analyze_winter_start.py
```

### 5. Tutustu tuloksiin

Tulostiedostot:
- `weather_data_2022_2025_all.csv` - Kaikki data yhdessä
- `weather_data_2022_2025_etela_suomi.csv` - Etelä-Suomen data
- `weather_data_2022_2025_keski_suomi.csv` - Keski-Suomen data
- `weather_data_2022_2025_pohjois_suomi.csv` - Pohjois-Suomen data
- `weather_data_2022_2025_lappi.csv` - Lapin data
- `winter_start_analysis.csv` - Talven alkamispäivät per vyöhyke/vuosi

## Ilmastovyöhykkeet

Käytössä on **leveysastevyöhykkeet** (Vaihtoehto 1):

| Vyöhyke | Leveysaste | Asemia |
|---------|------------|--------|
| Etelä-Suomi | < 61.5°N | ~85 |
| Keski-Suomi | 61.5° - 64°N | ~94 |
| Pohjois-Suomi | 64° - 66°N | ~43 |
| Lappi | > 66°N | ~53 |

## Saatavilla olevat parametrit

- **Air temperature** - Vuorokauden keskilämpötila (°C)
- **Minimum temperature** - Vuorokauden minimilämpötila (°C)
- **Maximum temperature** - Vuorokauden maksimilämpötila (°C)
- **Snow depth** - Lumensyvyys (cm)
- **Precipitation amount** - Sademäärä (mm)
- **Ground minimum temperature** - Maanpinnan minimilämpötila (°C)

## Seuraavat vaiheet

1. **Datan validointi** - Tarkista puuttuvat arvot ja laatuongelmat
2. **Talven alkamisen analyysi** - Laske termisen talven alkamispäivät
3. **Anomalioiden tunnistus** - Tunnista myrskyt, takatalvet, ääri-ilmiöt
4. **Visualisointi** - Luo graafit ja raportit

## Lisätietoja

Katso yksityiskohtainen dokumentaatio: [plan.md](plan.md)

## Huomiot

- API-kyselyt tehdään neljännesvuosittain API-rajoitusten takia
- Erikoisarvo `-1` sateessa/lumessa muunnetaan `0`:ksi
- NaN-arvot säilytetään puuttuvina arvoina
- Skripti lisää 2 sekunnin viiveen kyselyjen väliin
