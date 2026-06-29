# drinks-reviewer

Personal drinks journal for wine, beer, whiskey, and spirits.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, React Router, CSS custom properties |
| Backend | Node.js + Express |
| Data | JSON files (no database) |

## Getting Started

```bash
npm install
npm run dev
```

Client → `http://localhost:5173` · Server → `http://localhost:3001`

## Features

**Browsing & filtering**
- Category pages (Wine, Beer, Whiskey, Others) and an All Drinks view
- Multi-select filter bar per page — type, country, variety, ABV range, tags; each option shows a live count
- Click any cell value to instantly filter by it
- Active filter chips with one-click removal
- Sort presets: Top Rated and Recently Tasted; click any column header to sort manually
- Global search across all fields from the nav bar

**Table**
- Category-specific columns with color-coded chips (wine type, country Old/New World, beer style, sweetness, etc.)
- Hide and reorder columns per category, persisted in localStorage
- Mobile responsive — collapsible nav, filter pill, horizontal table scroll

**My Collection**
- `/collection` page for in-stock bottles; quantity badges with +/− controls
- Lots model — multiple lots per drink for different prices or vintages
- "Pick for me" randomly selects from in-stock bottles
- "Drank it" button pre-fills Admin with the drink and decrements the oldest lot on save

**Admin**
- Add, edit, and delete entries across all categories
- Two tabs: **Review** (tasting notes, ratings, sweetness, tags) and **Collection** (lot management)
- Create collection-only entries (no review required) directly from the Collection tab

**Tags & Sweetness**
- Freeform tags on any entry — chip UI with autocomplete; clickable chips filter the table
- Sweetness field on wine (Dry / Off-Dry / Sweet / Extra-Dry) — filterable, shown as a color chip

## Testing

```bash
npm test                # Jest (API) + Vitest (React)
npm run test:coverage   # Must reach 100% on all metrics
```
