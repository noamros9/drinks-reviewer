# Domain glossary

- **Drink** — one reviewed or cellared bottle identity (producer + name) within a category: `wine`, `beer`, `whiskey`, `others`. Producer/name field keys differ per category (`producer`/`seriesAndName`, `brewery`/`name`, `distillery`/`name`).
- **Tasting** — one dated rating of a Drink; `avgRating` and `tastingCount` are derived from tastings.
- **Lot** — a purchase of a Drink held in the Cellar: quantity, optional price. Stored in `drink.collection`.
- **Cellar** — the set of Lots (formerly "Collection"; the data field kept its old name).
- **Cellar-only drink** — a Drink with `collectionOnly: true`: bought but not yet tasted, hidden from review lists.
- **Estimated price** — `drink.estimatedPrice`, a Gemini-backfilled price used when no Lot has a real price. Treated as a fallback, flagged as estimated in the UI.
- **Weighted rating** — Bayesian average of a Drink's `avgRating` toward the scope mean, weighted by `tastingCount` against the median count.
