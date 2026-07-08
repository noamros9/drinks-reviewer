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

- Category pages (Wine, Beer, Whiskey, Others), All Drinks, and Collection views
- Filter bar, global search, column sorting, hide/reorder columns
- Full tasting log per drink — date, rating, vintage; derived stats recomputed automatically
- Per-row vintage switcher on the wine table; vintage filter bar syncs all rows
- Collection management — multiple lots, quantity controls, "Pick for me", "Drank it"
- Admin: add/edit/delete entries, manage tastings and collection lots, photo uploads per tasting
- Comparison view — select 2-5 drinks on a category page to compare fields, weighted rating, avg lot price, and tasting history side by side; deep-linkable at `/compare?category=&ids=`
- Analytics page — Rating tab (distribution histogram, percentile bands, rating trend over time, per-category comparison, consistency leaderboard), ABV tab (distribution histogram, ABV vs. rating scatter plot, avg ABV by category), Geographic tab (sortable country ranking table, zoomable world map choropleth with wine/whiskey region markers, Old World vs New World breakdown, region leaderboard), Time & Pace tab (discovery pace, seasonal tasting patterns, tastings-per-category trend), Style & Variety tab (most common wine varieties/beer styles, with a grape/blend toggle for wine, and an undiscovered-styles list), Producer tab (top/most prolific producers leaderboard, producer consistency), Vintage tab (wine-only — best vintages leaderboard, age-at-tasting vs. rating scatter), Exploration tab (Best Of leaderboard ranked by weighted rating), and Value tab (price vs. rating scatter, best-value leaderboard, avg price by category/country); scoped by a global category filter with per-chart overrides; click a bar/tile/point/country/marker to jump to the filtered drink list, or to that drink's tasting history
- Wine/whiskey regions are auto-geocoded (via OpenStreetMap) the first time a drink with a new (country, region) pair is saved, so they appear as markers on the Geographic map
- Weighted rating — a Bayesian rating that shrinks a low-sample average toward the category's mean, so a single high rating can't outrank a well-tasted drink with a slightly lower average. Drives the "Top rated" sort preset, the drink table's Weighted Rating column, and the Style/Country/Region analytics leaderboards

## Testing

```bash
npm test                      # Jest (API) + Vitest (React)
npm run test:coverage:server  # Server coverage — enforced at 100% all metrics
npm run test:coverage         # Client coverage — enforced at 90% all metrics
```
