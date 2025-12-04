# Pikaohje - FMI Säädatan keräys

## Virtuaaliympäristön käyttö

### Ensimmäinen kerta (asennus)
```bash
cd /Users/martti.halme/dev/fmi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Joka kerta kun käytät skriptejä
```bash
cd /Users/martti.halme/dev/fmi
source venv/bin/activate
```

**Tunnista että venv on aktiivinen:** Komentorivillä näkyy `(venv)` alkuosa:
```
(venv) martti@computer:~/dev/fmi$
```

### Poistu venv:stä
```bash
deactivate
```

---

## Skriptien ajaminen

### 1. Testaa ensin (nopea, 3 kuukautta)
```bash
source venv/bin/activate
python test_fetch.py
```

### 2. Hae 3 vuoden historiadata
```bash
source venv/bin/activate
python fetch_historical_data.py
```
Kestää ~30-60 minuuttia.

### 3. Analysoi talven alkaminen
```bash
source venv/bin/activate
python analyze_winter_demo.py
```

---

## Yleisiä ongelmia

### "ModuleNotFoundError: No module named 'fmiopendata'"
→ Et ole aktivoinut venv:iä. Aja: `source venv/bin/activate`

### "python: command not found"
→ Käytä `python3` komennon sijaan: `python3 test_fetch.py`

### API-virhe tai timeout
→ FMI:n API voi olla ruuhkautunut. Odota hetki ja yritä uudelleen.

---

## Datan laajentaminen

Jos haluat hakea pidemmän historian (esim. 10 vuotta):

1. Avaa `fetch_historical_data.py`
2. Muuta rivi 16: `START_YEAR = 2022` → `START_YEAR = 2015` (tai haluamasi vuosi)
3. Tallenna ja aja skripti uudelleen

**HUOM:** Jokainen lisävuosi lisää ~100,000 havaintoa ja ~10 min aikaa.
