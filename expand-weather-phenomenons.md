# Plan: Enhanced Anomaly Exploration Features

## Overview
Add comprehensive phenomenon tracking to the Exploration view's Active Anomalies list, displaying all 13 timeline phenomena types (not just 5 anomaly types). Add clickable detail panels with temperature charts and station measurements, plus deep linking support.

---

## Feature 1: Show All 13 Active Phenomena in List

### Current State
- **File**: [timelineController.js](visualization/js/timelineController.js) lines 1934-2068
- **Current Behavior**: Only shows 5 anomaly types from `anomalies.json`
- **Timeline Displays**: 13 phenomenon types from 4 different data sources

### 13 Phenomenon Types to Display

| # | Type | Data Source | Fields |
|---|------|-------------|--------|
| 1 | Cold Spells | `winterStarts` | `cold_spells[]{start, end, duration, min_temp}` |
| 2 | Warm Spells | `winterStarts` | `warm_spells[]{start, end, duration, max_temp}` |
| 3 | Winter Start | `winterStarts` | `season_start` |
| 4 | Winter End | `winterStarts` | `season_end` |
| 5 | Slippery Season Start | `slipperyRisk` | `season_start` |
| 6 | Slippery Risk Periods | `slipperyRisk` | `slippery_periods[]{start, end, high_risk_days, temps}` |
| 7 | First Frost | `firstFrost` | `first_frost_date` |
| 8 | Frost Periods | `firstFrost` | `frost_periods[]{start, end, min_temp, avg_min_temp}` |
| 9-13 | 5 Anomaly Types | `anomalies` | Existing structure (already implemented) |

### Implementation Steps

#### Step 1: Add DataLoader Filter Methods
**File**: [dataLoader.js](visualization/js/dataLoader.js)
**Location**: After `getAnomaliesForDate()` (line 359)

Add 8 new methods following the pattern of `getAnomaliesForDate()`:
- `getColdSpellsForDate(date)` - Filter cold spells by date range
- `getWarmSpellsForDate(date)` - Filter warm spells by date range
- `getWinterStartsForDate(date)` - Filter winter starts by exact date
- `getWinterEndsForDate(date)` - Filter winter ends by exact date
- `getSlipperySeasonStartsForDate(date)` - Filter slippery season starts
- `getSlipperyPeriodsForDate(date)` - Filter slippery risk periods
- `getFirstFrostForDate(date)` - Filter first frost markers
- `getFrostPeriodsForDate(date)` - Filter frost periods by date range

Each method:
- Returns array of normalized objects with `{type, zone, dates, temps, duration}`
- Checks if date falls within period (for periods) or matches exact date (for markers)
- Handles missing data gracefully

#### Step 2: Add Phenomenon Configuration
**File**: [timelineController.js](visualization/js/timelineController.js)
**Location**: After `visibility` object (~line 46)

Add `phenomenonConfig` object mapping types to display properties:
- Icon (emoji or symbol)
- CSS class for styling
- Label (Finnish display name)
- Color (matching timeline colors)

#### Step 3: Rewrite Active List Method
**File**: [timelineController.js](visualization/js/timelineController.js)
**Location**: Replace `updateActiveAnomaliesList()` (lines 1934-2068)

New implementation:
1. Collect all 13 phenomenon types for current date using new DataLoader methods
2. Normalize all data into consistent format
3. Sort phenomena logically (winter markers → frost → temperature → slippery)
4. Render cards using new `renderPhenomenonCard()` method
5. Attach click handlers for Feature 2

#### Step 4: Add CSS Styles
**File**: [main.css](visualization/css/main.css)
**Location**: After existing anomaly card styles

Add border colors and styles for 8 new phenomenon types:
- `.cold-spell`, `.warm-spell`
- `.winter-start`, `.winter-end`
- `.slippery-start`, `.slippery-period`
- `.first-frost`, `.frost-period`

---

## Feature 2: Clickable Phenomenon Detail Panel

### User Experience Flow
1. User clicks a phenomenon card in the Active list
2. Card expands with highlighted state
3. Detail panel appears below card showing:
   - Summary information (duration, temperatures, etc.)
   - Temperature progression chart (D3 line chart)
   - Individual station measurements for the zone
4. User clicks card again, close button, or outside to close
5. URL updates for deep linking (e.g., `?date=2023-01-15&phenomenon=cold-spell&zone=Etelä-Suomi`)

### Implementation Steps

#### Step 1: Add Detail Panel HTML
**File**: [index.html](visualization/index.html)
**Location**: Inside `#info-sidebar`, after `#active-anomalies-list-right` (line 156)

Add container:
```html
<div id="phenomenon-detail-panel" class="hidden">
  <div class="detail-panel-header">
    <h4 id="detail-panel-title"></h4>
    <button id="close-detail-panel">×</button>
  </div>
  <div id="detail-panel-content"></div>
</div>
```

#### Step 2: Add Click Handler System
**File**: [timelineController.js](visualization/js/timelineController.js)

Add new methods:
- `attachPhenomenonClickHandlers()` - Attach click events to cards
- `showPhenomenonDetails(type, zone, card)` - Display detail content
- `buildSummarySection(phenomenon)` - Build summary HTML
- `renderTemperatureChart(phenomenon)` - D3 chart for temp progression
- `renderStationMeasurements(phenomenon)` - Display station data
- `getPhenomenonDataFromCard(card)` - Extract data from clicked card

**Temperature Chart Details**:
- D3 line chart with 3 lines (min/mean/max temps)
- X-axis: dates in period (format: dd.mm)
- Y-axis: temperature in °C
- Shaded area between min/max
- Legend showing line colors
- Dimensions: ~240x150px (fits sidebar)

**Station Measurements**:
- Get station data for current date and zone
- Display station name, min/mean/max temps
- Grid layout with clear temp indicators

#### Step 3: Add Detail Panel Styling
**File**: [main.css](visualization/css/main.css)

Add comprehensive styles:
- `.detail-panel-header` - Header with title and close button
- `.detail-section` - Container for each section (summary, chart, stations)
- `.summary-grid` - Two-column grid for summary items
- `#phenomenon-temp-chart` - Chart container and axis styling
- `.stations-grid` - Station list layout
- `.phenomenon-card.expanded` - Highlighted state for active card

#### Step 4: Add URL Query Parameter Support
**File**: [main.js](visualization/js/main.js)

Add methods:
- `parseURLParameters()` - Read URL params on load, set date and expand phenomenon
- `updateURLForPhenomenon(type, zone, date)` - Update URL when expanding
- `clearPhenomenonFromURL()` - Clear params when closing

Update flow:
- Call `parseURLParameters()` in `App.initialize()` after data loads
- Call `updateURLForPhenomenon()` when card is clicked
- Call `clearPhenomenonFromURL()` when detail panel closes

**URL Format**: `?date=YYYY-MM-DD&phenomenon=TYPE&zone=ZONE`

Example: `?date=2023-01-15&phenomenon=cold_spell&zone=Etelä-Suomi`

#### Step 5: Add Helper Method
**File**: [timelineController.js](visualization/js/timelineController.js)

Add `setCurrentDate(dateStr)` method:
- Validate date is in available range
- Update slider position
- Update date display
- Trigger data reload and timeline refresh
- Required for deep linking to work

---

## Edge Cases & Error Handling

### Data Validation
- Check for null/undefined data sources before filtering
- Handle missing fields in phenomenon objects
- Show "Ei dataa saatavilla" for empty results

### Date Range Handling
- Validate dates are within available range
- Handle phenomena spanning multiple seasons/years
- Prevent NaN errors from invalid date strings

### UI Edge Cases
- Only one card can be expanded at a time (close others on expand)
- Handle long lists gracefully (already scrollable)
- Chart renders properly even with gaps in data
- Empty state for stations when none match zone

### Performance
- Limit chart to reasonable date ranges
- Cache DataLoader queries where possible
- Debounce handlers if needed

### Deep Linking
- Validate all URL parameters before using
- Handle missing phenomenon gracefully (show message)
- Preserve other URL parameters if present

---

## Critical Files to Modify

1. **[dataLoader.js](visualization/js/dataLoader.js)** (~200 lines)
   - Add 8 new filter methods for phenomenon types

2. **[timelineController.js](visualization/js/timelineController.js)** (~400 lines)
   - Add `phenomenonConfig` object
   - Rewrite `updateActiveAnomaliesList()`
   - Add `renderPhenomenonCard()`
   - Add detail panel methods (6 methods)
   - Add `setCurrentDate()` helper

3. **[main.css](visualization/css/main.css)** (~150 lines)
   - CSS for 8 new phenomenon types
   - Detail panel structure and styling
   - Chart styling
   - Station list styling

4. **[index.html](visualization/index.html)** (~10 lines)
   - Add detail panel HTML structure

5. **[main.js](visualization/js/main.js)** (~60 lines)
   - Add URL parameter handling
   - Integrate parseURLParameters() call

---

## Testing Checklist

### Feature 1: All Phenomena Display
- [ ] All 13 phenomenon types appear when active
- [ ] Each type has correct icon and label
- [ ] Phenomena sorted logically (winter → frost → temp → slippery)
- [ ] All zones display their phenomena
- [ ] "Ei ilmiöitä" message when none exist
- [ ] Existing 5 anomaly types still work

### Feature 2: Detail Panel
- [ ] Click expands card and shows panel
- [ ] Only one card expanded at a time
- [ ] Close button works
- [ ] Click outside closes panel
- [ ] Summary shows correct data
- [ ] Temp chart renders with min/mean/max lines
- [ ] Chart has proper axes and legend
- [ ] Station list shows zone-filtered data
- [ ] Empty states handled gracefully

### Deep Linking
- [ ] URL updates when expanding phenomenon
- [ ] Opening URL auto-expands correct phenomenon
- [ ] Invalid parameters handled gracefully
- [ ] URL clears when closing panel
- [ ] Date parameter works independently

---

## Summary

This implementation adds comprehensive phenomenon tracking to the Exploration view, displaying all timeline phenomena (not just anomalies) in the Active list. Users can click any phenomenon to see detailed temperature charts and station measurements, with URL support for sharing specific phenomena.
