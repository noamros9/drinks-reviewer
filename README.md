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
- Analytics page — Rating tab (distribution histogram, percentile bands, rating trend over time, per-category comparison, consistency leaderboard) and ABV tab (distribution histogram, ABV vs. rating scatter plot, avg ABV by category); scoped by a global category filter with per-chart overrides; click a bar/tile/point to jump to the filtered drink list, or to that drink's tasting history

## Testing

```bash
npm test                      # Jest (API) + Vitest (React)
npm run test:coverage:server  # Server coverage — enforced at 100% all metrics
npm run test:coverage         # Client coverage — enforced at 90% all metrics
```
