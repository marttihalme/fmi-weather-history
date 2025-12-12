# Sääkone - FMI Weather History Visualization

Interactive web application for exploring Finnish weather history data. Fetches data from the Finnish Meteorological Institute (FMI) open data API and provides visualization tools for analyzing weather phenomena across Finland's climate zones.

## Features

### Map View (Kartta)
- Interactive heatmap showing temperature distribution across Finland
- Date slider for navigating through historical data
- Timeline showing weather phenomena with brush & zoom
- Click on phenomena to see detailed information with temperature charts
- Station markers with individual measurements

### Year Comparison (Vertaile vuosia)
- Side-by-side comparison of weather patterns across multiple years
- Visualizes cold spells, warm spells, winter start/end dates
- Shows anomalies like extreme cold, heat waves, and sudden temperature changes
- Zone-specific filtering (Etelä-Suomi, Keski-Suomi, Pohjois-Suomi, Lappi)

### Data Management (Datan hallinta)
- Fetch new data from FMI API for any date range
- Run analysis scripts to detect weather phenomena
- View data status and statistics

## Weather Phenomena Tracked

| Phenomenon | Finnish Name | Detection Criteria |
|------------|--------------|-------------------|
| Cold Spell | Pakkasjakso | 3+ consecutive days with mean temp < -10°C |
| Warm Interruption | Lämpökatko | 2+ days during winter with mean temp > 0°C |
| Winter Start | Talven alku | Mean temp permanently below 0°C (5-day moving avg) |
| Winter End | Talven loppu | Mean temp permanently above 0°C in spring |
| Slippery Season | Liukkauskausi | Night temp < 0°C and day temp 0-5°C |
| First Frost | Ensimmäinen yöpakkanen | First night in autumn with temp < 0°C |
| Extreme Cold | Äärimmäinen kylmyys | Daily minimum temp ≤ -25°C |
| Severe Cold Snap | Ankara pakkasjakso | 3+ days with max temp < -15°C |
| Heat Wave | Hellejakso | 3+ days with max temp > +25°C |
| Return of Winter | Takatalvi | Cold spell after spring has begun |
| Sudden Warming | Äkillinen lämpeneminen | Daily mean temp change > ±15°C |

## Climate Zones

| Zone | Latitude | Stations |
|------|----------|----------|
| Etelä-Suomi (South) | < 61.5°N | ~85 |
| Keski-Suomi (Central) | 61.5° - 64°N | ~94 |
| Pohjois-Suomi (North) | 64° - 66°N | ~43 |
| Lappi (Lapland) | > 66°N | ~53 |

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Start the Server

```bash
# Activate venv first, then:
python visualization/server/server.py
```

Server runs at http://localhost:8000

### 3. Open the Application

Navigate to http://localhost:8000 in your browser.

If data files are missing, go to "Datan hallinta" tab and fetch data for your desired date range.

## Project Structure

```
fmi-weather-history/
├── data/
│   ├── raw/                    # Raw CSV data from FMI
│   └── analysis/               # Analysis output files
├── scripts/
│   ├── fetch_historical_data.py  # Fetch data from FMI API
│   ├── analyze_data.py           # Detect weather phenomena
│   └── refresh_recent_data.py    # Update recent data
├── visualization/
│   ├── index.html              # Main application
│   ├── css/                    # Stylesheets
│   ├── js/                     # JavaScript modules
│   │   ├── main.js             # Application entry point
│   │   ├── dataLoader.js       # Data loading and filtering
│   │   ├── mapManager.js       # Map visualization
│   │   ├── timelineController.js # Timeline and phenomena UI
│   │   ├── yearCompare.js      # Year comparison view
│   │   └── ...
│   ├── data/                   # Processed JSON data files
│   ├── preprocessing/          # Data preparation scripts
│   │   ├── prepare_data.py     # Process raw data to JSON
│   │   └── generate_grids.py   # Pre-compute interpolation grids
│   └── server/
│       └── server.py           # HTTP server with API endpoints
├── requirements.txt
└── README.md
```

## Data Files

### visualization/data/

| File | Description |
|------|-------------|
| `daily_zone_summary.json` | Daily aggregated data per zone |
| `daily_station_data.json` | Individual station measurements |
| `station_locations.json` | Station metadata and coordinates |
| `anomalies.json` | Detected weather anomalies |
| `winter_starts.json` | Winter season data with cold/warm spells |
| `first_frost.json` | First frost dates and frost periods |
| `slippery_risk.json` | Slippery road risk periods |
| `precomputed_grids.json` | Pre-computed IDW interpolation grids |

## Available Weather Parameters

- **temp_mean** - Daily mean temperature (°C)
- **temp_min** - Daily minimum temperature (°C)
- **temp_max** - Daily maximum temperature (°C)
- **snow_depth** - Snow depth (cm)
- **precipitation** - Precipitation amount (mm)

## Manual Data Operations

### Fetch Data for Date Range

```bash
python scripts/fetch_historical_data.py --start 2022-01-01 --end 2024-12-31
```

### Run Analysis Scripts

```bash
python scripts/analyze_data.py
```

### Prepare Visualization Data

```bash
python visualization/preprocessing/prepare_data.py
```

### Generate Pre-computed Grids (Optional)

```bash
python visualization/preprocessing/generate_grids.py
```

## Technology Stack

- **Backend**: Python with FMI Open Data API
- **Frontend**: Vanilla JavaScript with D3.js, Plotly.js
- **Server**: Python HTTP server with SSE for progress streaming
- **Data**: JSON files served statically

## API Notes

- FMI API queries are made quarterly to respect API limits
- Special value `-1` in precipitation/snow is converted to `0`
- NaN values are preserved as missing data
- 2-second delay between API requests

## Credits

- **Developer**: Martti Halme, 2025
- **Data Source**: Finnish Meteorological Institute (Ilmatieteenlaitos), Open Data

## License

This project uses open data from FMI under their open data license.
