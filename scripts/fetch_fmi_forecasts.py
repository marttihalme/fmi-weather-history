"""
Fetch long-term forecasts from FMI website and store history.
Stores raw text content without interpretation - the text is displayed as-is in frontend.
"""

import requests
from bs4 import BeautifulSoup
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import re

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
FORECASTS_FILE = PROJECT_ROOT / "visualization" / "data" / "fmi_forecasts.json"


def fetch_page():
    """Fetch the FMI long-term forecast page."""
    url = "https://www.ilmatieteenlaitos.fi/pitkan-ennusteen-seuranta"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.text


def parse_forecasts(html):
    """
    Parse monthly and seasonal forecasts from the page.
    Returns raw text content - no interpretation.
    """
    soup = BeautifulSoup(html, 'html.parser')

    result = {
        "monthly": None,
        "seasonal": None,
        "page_modified": None
    }

    # Try to find article-modified-times element
    modified_el = soup.find('p', class_='article-modified-times')
    if modified_el:
        result["page_modified"] = modified_el.get_text(strip=True)

    # Find the main content area
    # The forecasts are in divs with specific structure
    main_content = soup.find('main') or soup.find('div', {'id': 'skip-to-main-content'}) or soup

    # Find all h2 headings to locate sections
    headings = main_content.find_all(['h2', 'h3'])

    for heading in headings:
        heading_text = heading.get_text(strip=True).lower()

        # Monthly forecast section
        if 'kuukausiennuste' in heading_text:
            section = extract_section_content(heading)
            if section:
                result["monthly"] = section

        # Seasonal forecast section
        elif 'vuodenaikaisennuste' in heading_text:
            section = extract_section_content(heading)
            if section:
                result["seasonal"] = section

    return result


def extract_section_content(heading_element):
    """
    Extract the content following a heading element.
    Returns structured data with raw text.
    """
    content = {
        "title": heading_element.get_text(strip=True),
        "raw_html": "",
        "text_content": "",
        "period_text": None
    }

    # Collect all content until next heading of same or higher level
    current = heading_element.find_next_sibling()
    html_parts = []
    text_parts = []

    while current:
        # Stop at next major heading
        if current.name in ['h2', 'h3']:
            break

        # Skip "Pitkat ennusteet vaativat tulkintaa" section
        text = current.get_text(strip=True).lower()
        if 'vaativat tulkintaa' in text or 'tulkintaohjeet' in text:
            break

        html_parts.append(str(current))
        text_parts.append(current.get_text(separator=' ', strip=True))
        current = current.find_next_sibling()

    content["raw_html"] = '\n'.join(html_parts)
    content["text_content"] = '\n'.join(filter(None, text_parts))

    # Try to extract period from text (this is the most reliable field)
    full_text = content["text_content"]

    # Look for period patterns like "22.12.2025 - 19.1.2026" or "tammikuu - maaliskuu"
    period_patterns = [
        r'\d{1,2}\.\d{1,2}\.\d{4}\s*[-–]\s*\d{1,2}\.\d{1,2}\.\d{4}',  # 22.12.2025 - 19.1.2026
        r'(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu\w*\s*[-–]\s*(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu\w*',  # tammikuu - maaliskuu
    ]

    for pattern in period_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            content["period_text"] = match.group(0).strip()
            break

    return content


def compute_content_hash(forecasts):
    """Compute hash of forecast content to detect changes."""
    content_str = json.dumps(forecasts, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(content_str.encode('utf-8')).hexdigest()[:12]


def load_existing_data():
    """Load existing forecast history."""
    if FORECASTS_FILE.exists():
        with open(FORECASTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"last_updated": None, "forecasts": []}


def save_data(data):
    """Save forecast data to file."""
    FORECASTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(FORECASTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    print("Fetching FMI long-term forecasts...")

    try:
        html = fetch_page()
        print("Page fetched successfully.")
    except Exception as e:
        print(f"Error fetching page: {e}")
        return 1

    forecasts = parse_forecasts(html)

    if not forecasts["monthly"] and not forecasts["seasonal"]:
        print("Warning: Could not parse any forecasts from the page.")
        print("The page structure may have changed.")
        return 1

    print(f"Parsed forecasts:")
    if forecasts["monthly"]:
        print(f"  - Monthly: {forecasts['monthly']['title']}")
        if forecasts["monthly"]["period_text"]:
            print(f"    Period: {forecasts['monthly']['period_text']}")
    if forecasts["seasonal"]:
        print(f"  - Seasonal: {forecasts['seasonal']['title']}")
        if forecasts["seasonal"]["period_text"]:
            print(f"    Period: {forecasts['seasonal']['period_text']}")

    # Compute hash of current content
    content_hash = compute_content_hash(forecasts)
    print(f"Content hash: {content_hash}")

    # Load existing data
    data = load_existing_data()

    # Check if content has changed
    if data["forecasts"]:
        last_hash = data["forecasts"][0].get("content_hash", "")
        if last_hash == content_hash:
            print("Content unchanged, not adding new entry.")
            # Still update last_updated timestamp
            data["last_updated"] = datetime.now(timezone.utc).isoformat()
            save_data(data)
            return 0

    # Add new entry
    new_entry = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "content_hash": content_hash,
        "page_modified": forecasts.get("page_modified"),
        "monthly": forecasts["monthly"],
        "seasonal": forecasts["seasonal"]
    }

    # Insert at beginning (newest first)
    data["forecasts"].insert(0, new_entry)
    data["last_updated"] = new_entry["fetched_at"]

    # Keep last 52 entries (about 1 year of weekly updates)
    data["forecasts"] = data["forecasts"][:52]

    save_data(data)
    print(f"Saved new forecast entry. Total entries: {len(data['forecasts'])}")

    return 0


if __name__ == "__main__":
    exit(main())
