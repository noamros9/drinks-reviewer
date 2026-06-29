# drinks-reviewer

A personal drinks review website for tracking wine, beer, whiskey, and other spirits.

## Stack

- **Frontend**: React + Vite, React Router, CSS custom properties, DM Sans + DM Serif Display (Google Fonts)
- **Backend**: Node.js + Express
- **Data**: JSON files (no database)

## Features

- Global search box in the nav bar — type and press Enter to search all fields across all categories at once; results shown on the All Drinks page
- Browse all drinks at once on the All page, with category filter chips
- Browse reviews by category: Wine, Beer, Whiskey, Others
- Multi-select filter bar on each category page (producer search, type, country with Old/New World groups for wine only, variety with Blend/Single Variety, region); each option shows a contextual count
- Click any producer, type, country, variety, or region cell in a table to instantly add that value to the active filters; producer and country cells are also clickable on the All Drinks page
- Active filter chips below the filter bar show every active filter at a glance; click × on any chip to remove just that value; global search query also appears as a dismissible chip on the All page
- Sort presets in the page header: "Top rated" (avg ranking descending) and "Recently tasted" (last tasted date descending); clicking any column header deactivates the preset
- Mobile responsive layout (≤768px): hamburger menu collapses nav links and search into a drawer; filter bar collapses behind a "Filters" pill; table scrolls horizontally with tighter padding
- Variety filter splits blends — filtering by a single grape matches any drink containing that grape
- ABV range filter (min/max) on all pages including the All page
- Country filter on the All page; filters respect the active category tab
- Hide and reorder columns per category (persisted in localStorage); drag table headers or use the Columns panel
- Monday-style color chips on category/type columns: Category (All & Collection pages) shows Wine/Beer/Whiskey/Others each with a distinct pastel; Wine page Type column shows Red/White/Rosé/Sparkling/Fortified chips; Wine Country chips group by Old World / New World / Israel / Other; Beer Style chips group into Ale / Lager / Stout; Whiskey Style chips distinguish Single Malt and Bourbon; Others Category chips color Rum / Vodka / Liqueur separately
- Whiskey entries have separate Country and Region fields (Scottish regions: Highlands, Islay, Speyside, Island)
- Sortable tables with category-specific fields per drink type
- Bookmarks-inspired UI: frosted-glass nav, neutral Apple-style palette, DM Serif Display headings
- Dark / light mode toggle (persisted across sessions)
- **My Collection** page (`/collection`) tracks in-stock bottles across all categories; quantity badge per row with +/− controls; "Pick for me" randomly selects a drink from your collection; same Country, ABV, and column filters as the All Drinks page
- Collection uses a **lots model** — multiple lots per drink for different prices or vintages; price recorded per lot at time of purchase
- Admin page has two always-visible tabs: **Review** (add/edit tasting notes and ratings) and **Collection** (manage lots in edit mode; add a drink directly to collection without a review in create mode)
- "Drank it" button on the Collection page opens the drink in Admin → Review tab pre-filled; saving marks it as reviewed and decrements the oldest lot by one
- Admin **Collection tab (create mode)** accepts Category, Producer, Name, Country, ABV, Quantity, and Price — creates a `collectionOnly` entry visible only in My Collection until reviewed
- Admin edit page includes a **My Collection section** to add lots (quantity + price) or remove them
- Admin UI to add, edit, and delete entries
- Date picker in dd/mm/yyyy format
- Ranking fields support decimal values (last ranking: 1 decimal, avg ranking: 2 decimals)
- Notion link column opens the full tasting log in a new tab
- **Sweetness** field on wine entries (Dry / Off-Dry / Sweet / Extra-Dry); filterable via the filter bar
- **Custom tags** on all drink categories — freeform labels per entry, added in Admin; Tags column on all category pages (not All or Collection); click any tag chip to filter by it; autocomplete from existing tags

## Server

- All API routes return JSON errors (never HTML stack traces) on data failures
- POST and PUT accept only known fields per category — unknown keys are ignored
- Concurrent writes are serialised per category to prevent race conditions

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
npm test          # Jest (API routes) + Vitest (React components)
npm run test:coverage  # Vitest with v8 coverage — must reach 100% on all metrics
```

All code must pass tests before committing. The project enforces 100% statement, branch, function, and line coverage on all React source files.
