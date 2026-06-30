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
- Global search across all fields from the nav bar
- Multi-select filter bar — type, country, variety, ABV range, sweetness, tags; live option counts
- Click any cell value to instantly filter by it; dismiss individual filters via chips
- Sort presets (Top Rated, Recently Tasted) or click any column header to sort manually
- Color-coded chips on key columns (wine type, country Old/New World, beer style, sweetness, etc.)
- Hide and reorder columns per category; mobile responsive throughout

**My Collection**
- `/collection` page for in-stock bottles with quantity badges and +/− controls
- Lots model — multiple lots per drink for different prices or vintages
- "Pick for me" randomly selects from in-stock bottles
- "Drank it" opens the drink in Admin pre-filled and decrements the oldest lot on save

**Tasting history**
- Full tasting log per drink — date, rating, and vintage (wine) stored in `tastings[]`
- Derived fields (`avgRanking`, `lastRanking`, `lastTasted`, `tastingCount`, `vintage`) are recomputed from tastings on every change
- Wine table has a per-row vintage switcher (after the Tags column); selecting a vintage filters all derived cells live
- Tastings count column on the wine table
- Vintage filter in the wine filter bar — matches across all tasting vintages; selecting one vintage automatically syncs all per-row dropdowns

**Admin**
- Add, edit, and delete entries across all categories
- Three tabs when editing: **Review**, **Collection**, and **Tastings** (add/remove individual tastings with date, rating, optional vintage)
- Each tasting row supports a per-tasting photo upload; the most recent tasting's image is shown as a large preview to the right of the list
- Create collection-only entries without a review from the Collection tab

## Testing

```bash
npm test                # Jest (API) + Vitest (React)
npm run test:coverage   # Must reach 100% on all metrics
```
