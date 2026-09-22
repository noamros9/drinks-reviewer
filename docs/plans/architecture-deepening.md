# Architecture deepening

Source: `/improve-codebase-architecture` run on 2026-09-22 over the recent hot spots (AdminPage, routes/drinks, analytics helpers, listing pages). Candidates were verified read-only against Atlas before ranking.

## Decisions

- **Price/rating math**: keep the client and server copies (client is ESM/Vite, server is CommonJS/Jest with no Babel); fix the drift and add a Vitest parity test that imports both.
- **Schema**: one `shared/drink-schema.json` at the repo root — Vite and Node/Jest both import JSON natively.
- **AdminPage flows**: server endpoints for the two multi-step flows only; no client `drinksApi` module.
- **Scripts** (`server/scripts/*`) adopt shared pieces only when next touched.

## Data check (2026-09-22, read-only)

| Check | Result | Effect |
|---|---|---|
| Drinks with `estimatedPrice` but no lot price (server prices them `null`) | 127 (69 wine, 49 beer, 9 whiskey/others) | T1 confirmed live |
| Tags not trimmed/lowercased/deduped | 0 | normalize-on-write dropped |
| Varieties off the normalized form | 2, both false positives of `titleCase` (`(Blend)`, `Tinta de Toro`) | normalize-on-write dropped |
| Mis-capitalised particles in varieties (`De`, `Du`, `La`…) | 0 of 54 distinct | — |
| `collectionOnly` drinks with no lots and no tastings | 0 | T3 drops to refactor tier |

**Rejected: server-side tag/variety normalization in `pickFields`.** No bad data exists, AdminPage is the only writer and already normalizes, and enforcing the current `titleCase` on every write would corrupt `Tinta de Toro` → `Tinta De Toro` and `(Blend)` → `(blend)`. Revisit (trim + case-insensitive dedupe, no re-casing) if a second writer appears — an import, a script, a public write API.

## Tickets

| # | Ticket | Tier | Blocked by | Branch | Status |
|---|---|---|---|---|---|
| 0 | Land this plan | — | — | `docs/architecture-deepening-plan` | done (PR #113) |
| 1 | Server price/rating drift fix + parity test | live bug (not visible) | 0 | `fix/server-metrics-parity` | done (PR #114) |
| 2 | `mutateDrink` helper in routes/drinks | refactor | 0 | `refactor/mutate-drink` | done (PR #115) |
| 3 | Atomic add-to-cellar + drank-it decrement on the server | refactor | 2 | `refactor/atomic-cellar-flows` | done (PR #116) |
| 4 | `shared/drink-schema.json` | refactor | 0 | `refactor/shared-drink-schema` | done (PR #117) |
| 5 | `useColumnLayout` + `useFilteredDrinks` hooks | refactor | 0 | `refactor/listing-hooks` | done (PR #118) |
| 6 | Hiding a table column doesn't stick in a real browser | bug (user-visible), pre-existing | — | `fix/column-hide-persistence` | todo |

Per ticket: branch → `/tdd` from **Test first** → `npm run test:coverage` + `npm run test:coverage:server` → PR that flips the row to `done (PR #N)`.

### 1 · Server metrics parity
- **Files**: new `server/metrics.js` (pure CommonJS, no requires) holding `avgLotPrice` — with the `estimatedPrice` fallback matching `client/src/utils/analyticsHelpers.js` — plus `avgOf`, `median`, `weightedRating`, `buildWeightedRatings` moved out of `server/recommend.js`; `recommend.js` requires it. New `client/src/__tests__/metricsParity.test.js` imports both sides and runs shared fixtures (lots only, estimated only, both, none, NaN prices).
- **Rounding**: the client rounds to 2dp and guards `v+m<=0`/empty input; the server skips both on purpose (`tastingCount >= 1` guaranteed by `tastingsHelper`). Fixtures use `tastingCount >= 1`; ratings compare with `toBeCloseTo(x, 2)`, prices exactly.
- **First**: `git log -S estimatedPrice` over both files to confirm the server omission is drift, not a choice. If deliberate, the ticket shrinks to the parity test asserting the difference.
- **Test first**: parity test fails on the "estimated price only" fixture (client → number, server → `null`).
- **Done when**: parity test green; `recommend.test.js` shows the generated-list catalogue carrying a price for an estimated-price drink (fake DB, no live Gemini).

### 2 · `mutateDrink`
- **Files**: `server/routes/drinks.js` — `mutateDrink(category, id, fn)`: category check → `withLock` → `readData` → find or 404 → `fn(drink)` → `writeData`. Convert only handlers that already have that shape.
- **Test first**: none new — behaviour-preserving; `drinks.test.js`, `bulk.test.js`, `tastings.test.js`, `collectionImage.test.js` are the net. Add a direct test only for an uncovered branch.
- **Done when**: server suites green at 100% coverage; inline `withLock(` count in the file drops accordingly.

### 3 · Atomic cellar flows
- **Files**: `server/routes/drinks.js` — `POST /api/:category/cellar` with `{ producer, name, country, abv, tags, quantity, price }`: under one lock, find (trim + lowercase producer and name, no match if either is blank — the rule in `findDuplicate`, `client/src/utils/filterHelpers.js`) or create with `collectionOnly: true`, add the lot, return the drink. Producer/name keys from `NAME_FIELDS` in `server/publicFields.js` (exported). `POST /:category/:id/tastings` accepts optional `decrementLotId` and decrements in the same lock. `client/src/pages/AdminPage.jsx` — `handleAddToCollection` makes one call (+ optional image upload); `handleAddTasting` sends `decrementLotId` instead of a separate PATCH.
- **Test first**: server test — an invalid lot (per existing lot validation) leaves no new drink behind.
- **Done when**: server + AdminPage tests green; cellar add and "drank it" checked on the dev server; README architecture diagram gains the route (rendered with `mmdc`).

### 4 · Shared schema
- **Files**: new `shared/drink-schema.json` — `categories`, per-category `fields` (key, type, `bulkEditable`, `similarity`), `producerKey`/`nameKey`, `arrayFields`, `regionSeparator`. Server derives from it: `routes/drinks.js`, `recommend.js`, `publicFields.js`, `geocoding.js`. Client derives from it: `utils/filterHelpers.js`, `AllDrinksPage`, `CollectionPage`, `analyticsHelpers`, `AdminPage` (whose `FIELDS` keeps UI-only props). `ComparePage` stops importing a page file.
- **First**: confirm Vite (root `./client`) serves `../../../shared/drink-schema.json` in dev and build.
- **Test first**: one server and one client test asserting derived constants equal the JSON (e.g. `PRODUCER_FIELD.beer === 'brewery'`).
- **Done when**: no `const CATEGORIES = [` left in app code (scripts excluded); all suites + coverage green; README diagram shows `shared/`.

### 5 · Listing hooks
- **Files**: new `client/src/hooks/useColumnLayout.js` replacing `loadLayout`/`saveLayout` in `CategoryPage`, `AllDrinksPage`, `CollectionPage` (same localStorage keys, try/catch around storage). New `client/src/hooks/useFilteredDrinks.js`: URL → `buildInitialFilters` → `applyUrl*` chain → `useSearchResults` → `matchesFilters` → `buildWeightedRatings`, from existing `filterHelpers.js` functions. Pages keep only their columns and presets.
- **Test first**: hook test with `?country=France&minRating=4` asserting returned rows.
- **Done when**: hook tests green; existing page tests pass unchanged or with structural edits only; client coverage ≥ 90%; all three pages checked in the browser (URL filter, column reorder survives reload).

### 6 · Column hide doesn't persist in a real browser
Found while verifying ticket 5, and **present on `main` before it** (checked by stashing the refactor and re-running the same script).
- **Symptom**: in headless Chromium on `/all`, `/wine` and `/cellar`, clicking the `×` in a column header hides the column, but nothing is written to `localStorage` (`drinks_columns_*`), so a reload brings the column back. No console errors.
- **Why it isn't caught**: in jsdom the same click *does* write — both the column-panel toggle (`AllDrinksPage.test.jsx`, "column layout change is saved to localStorage") and the header `×` (probed directly) pass.
- **Unexplained**: a `Storage.prototype.setItem` patch injected before page load never fires on the click, yet React state updates and the column disappears. Root cause not found; do not assume the hook is at fault.
- **Test first**: reproduce in a real browser (Playwright against the dev server on the in-memory DB), then a failing test at whatever layer the root cause turns out to be.
- **Done when**: hide a column, reload, and it stays hidden on all three pages, with a test that fails without the fix.

## Challenge round

- **Weakest assumption** — that the flagged duplication causes real harm. Verified against Atlas instead of trusting the code read. **Changed**: normalize-on-write dropped (0 bad records, and enforcing `titleCase` would corrupt 2 real names); T3 demoted to refactor (0 orphaned cellar drinks); T1 confirmed (127 drinks).
- **What wasn't read, and what opening it changed** — `AdminPage.addTag` normalizes at chip time, so it's UX, not dead duplication (**changed**: nothing deletes it). `vite.config.js` root is `./client` and Jest has no Babel (**changed**: JSON for the schema, parity test for metrics, no shared ESM). The server's rounding/guard differences are deliberate per its `ponytail:` comment (**changed**: T1 compares ratings with `toBeCloseTo`). `handleAddTasting` does a separate PATCH (**changed**: T3 covers both flows).
- **Lazier version not proposed** — ship T1 only. Rejected because the user asked for all candidates; T2–T5 are ordered cheapest-first and strictly behaviour-preserving, so each can stop at any point without leaving main worse.
