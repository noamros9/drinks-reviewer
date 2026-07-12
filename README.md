# drinks-reviewer

Personal drinks journal for wine, beer, whiskey, and spirits.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, React Router, CSS custom properties |
| Backend | Node.js + Express |
| Data | MongoDB Atlas |
| Images | Cloudinary |

## Getting Started

```bash
npm install
npm run dev
```

Client → `http://localhost:5173` · Server → `http://localhost:3001`

Set `MONGODB_URI` (and optionally `MONGODB_DB`) in a root `.env` file to read/write through Atlas — without it, the server falls back to an in-memory store for local/test use. Set `CLOUDINARY_URL` to enable photo uploads. Set `GEMINI_API_KEY` to enable "Recommend Similar Drinks" (real-world matches use Gemini's free tier with Google Search grounding).

Search (`/api/:category/search`) runs on MongoDB Atlas Search, which needs one `default` Search index per collection (`wines`, `beers`, `whiskeys` — `others` shares the `whiskeys` collection/index via a `_category` tag, since Atlas's free/shared tier caps Search indexes at 3 per cluster) with `producer`/`brewery`/`distillery` + `name`/`seriesAndName` mapped as searchable text. Create these once in the Atlas UI (or via `collection.createSearchIndex(...)`) after pointing `MONGODB_URI` at a real cluster — without them, search silently returns no results.

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
- Recommend Similar Drinks — pick 1+ drinks and get matches already in your catalogue (scored locally, no API cost) plus real-world drinks available/not available in Israel (via Gemini + Google Search grounding)
- Personal Taste Card — per-category page summarizing your palate from rated entries (what you tend to like/avoid) plus Gemini-sourced real-world matches available/not available in Israel
- Generate a List — type a freetext prompt (e.g. "something bold for a barbecue") and get a ranked list split into what's in your collection, what's elsewhere in your catalogue, and real purchasable options to buy (via Gemini + Google Search grounding)

## Testing

```bash
npm test                      # Jest (API) + Vitest (React)
npm run test:coverage:server  # Server coverage — enforced at 100% all metrics
npm run test:coverage         # Client coverage — enforced at 90% all metrics
```
