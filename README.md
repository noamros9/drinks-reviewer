# drinks-reviewer

A personal drinks review website for tracking wine, beer, whiskey, and other spirits.

## Stack

- **Frontend**: React + Vite, React Router, CSS custom properties, DM Sans + DM Serif Display (Google Fonts)
- **Backend**: Node.js + Express
- **Data**: JSON files (no database)

## Features

- Browse all drinks at once on the All page, with category filter chips
- Browse reviews by category: Wine, Beer, Whiskey, Others
- Multi-select filter bar on each category page (producer search, type, country with Old/New World groups for wine only, variety with Blend/Single Variety, region); each option shows a contextual count
- Variety filter splits blends — filtering by a single grape matches any drink containing that grape
- ABV range filter (min/max) on all pages including the All page
- Country filter on the All page; filters respect the active category tab
- Hide and reorder columns per category (persisted in localStorage); drag table headers or use the Columns panel
- Color indicators on wine Type and Country columns: type shows red/white/rosé/sparkling/fortified; country shows Old World / New World / Israel / Other
- Whiskey entries have separate Country and Region fields (Scottish regions: Highlands, Islay, Speyside, Island)
- Sortable tables with category-specific fields per drink type
- Bookmarks-inspired UI: frosted-glass nav, neutral Apple-style palette, DM Serif Display headings
- Dark / light mode toggle (persisted across sessions)
- Admin UI to add, edit, and delete entries
- Date picker in dd/mm/yyyy format
- Ranking fields support decimal values (last ranking: 1 decimal, avg ranking: 2 decimals)
- Notion link column opens the full tasting log in a new tab

## Getting Started

```bash
npm install
npm run dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:3001`.

## Data

Real data (73 wine, 57 beer, 18 whiskey, 5 others) lives in `server/data/` and is loaded by default.

Sample/test data lives in `server/data/data_test/` and is used by the test suite automatically.

## Testing

```bash
npm test
```

Runs Jest (API routes) + Vitest (React components). All code must pass tests before committing.
