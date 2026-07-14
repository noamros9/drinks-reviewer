import { parse, isValid, format } from 'date-fns';
import { OLD_WORLD, NEW_WORLD, PRODUCER_FIELD } from './filterHelpers';

export const RATING_BUCKETS = Array.from({ length: 9 }, (_, i) => ({ min: i + 1, max: i + 2 }));

export function bucketIndexForRating(rating) {
  if (typeof rating !== 'number' || Number.isNaN(rating)) return null;
  return Math.min(Math.max(Math.floor(rating) - 1, 0), RATING_BUCKETS.length - 1);
}

export function buildRatingHistogram(drinks) {
  const counts = new Array(RATING_BUCKETS.length).fill(0);
  for (const d of drinks) {
    const idx = bucketIndexForRating(d.avgRating);
    if (idx !== null) counts[idx]++;
  }
  return RATING_BUCKETS.map((b, i) => ({ ...b, label: `${b.min}-${b.max}`, count: counts[i] }));
}

export function parseDrinkDate(dateStr) {
  if (!dateStr) return null;
  const d = parse(dateStr, 'dd/MM/yyyy', new Date());
  return isValid(d) ? d : null;
}

export const PERCENTILE_THRESHOLDS = [7, 8, 9, 9.5];

export function computePercentiles(drinks, thresholds = PERCENTILE_THRESHOLDS) {
  const rated = drinks.filter(d => typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating));
  const total = rated.length;
  return thresholds.map(t => {
    const count = rated.filter(d => d.avgRating >= t).length;
    return { threshold: t, count, pct: total === 0 ? 0 : Math.round((count / total) * 1000) / 10 };
  });
}

export function buildRatingTrend(drinks) {
  const buckets = new Map();
  for (const d of drinks) {
    for (const t of d.tastings || []) {
      if (typeof t.rating !== 'number' || Number.isNaN(t.rating)) continue;
      const date = parseDrinkDate(t.date);
      if (!date) continue;
      const key = format(date, 'yyyy-MM');
      const b = buckets.get(key) ?? { sum: 0, count: 0 };
      b.sum += t.rating;
      b.count += 1;
      buckets.set(key, b);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { sum, count }]) => ({ month, avgRating: Math.round((sum / count) * 100) / 100, count }));
}

const COMPARISON_CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

function categoryComparison(drinks, getValue, valueKey) {
  return COMPARISON_CATEGORIES.map(category => {
    const values = drinks
      .filter(d => d._category === category)
      .map(getValue)
      .filter(v => typeof v === 'number' && !Number.isNaN(v));
    const avg = values.length
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
      : 0;
    return { category, [valueKey]: avg, count: values.length };
  });
}

export function buildCategoryComparison(drinks) {
  return categoryComparison(drinks, d => d.avgRating, 'avgRating');
}

export function buildAbvCategoryComparison(drinks) {
  return categoryComparison(drinks, numericAbv, 'avgAbv');
}

function numericAbv(drink) {
  const n = Number(drink.abv);
  return Number.isNaN(n) ? null : n;
}

// Dynamic buckets, not fixed ranges: ABV varies wildly per category (beer ~4-8%,
// spirits ~35-50%), unlike rating's fixed 1-10 scale.
export function buildAbvHistogram(drinks, bucketCount = 8) {
  const values = drinks.map(numericAbv).filter(v => v !== null).sort((a, b) => a - b);
  if (values.length === 0) return [];

  const min = values[0];
  const max = values[values.length - 1];
  if (min === max) {
    return [{ min, max, label: `${min}`, count: values.length }];
  }

  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    min: Math.round((min + i * width) * 10) / 10,
    max: Math.round((i === bucketCount - 1 ? max : min + (i + 1) * width) * 10) / 10,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), bucketCount - 1);
    buckets[idx].count++;
  }
  return buckets.map(b => ({ ...b, label: `${b.min}-${b.max}` }));
}

export function buildAbvVsRatingScatter(drinks) {
  return drinks
    .map(d => ({ abv: numericAbv(d), rating: d.avgRating, d }))
    .filter(({ abv, rating }) => abv !== null && typeof rating === 'number' && !Number.isNaN(rating))
    .map(({ abv, rating, d }) => ({
      id: d.id, category: d._category, label: drinkLabel(d), abv, rating, drink: d,
    }));
}

export function drinkLabel(drink) {
  const producer = drink.producer ?? drink.brewery ?? drink.distillery ?? '';
  const name = drink.seriesAndName || drink.name || '';
  return [producer, name].filter(Boolean).join(' ') || 'Unknown';
}

function populationStdDev(values) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

export function buildConsistencyLeaderboard(drinks, n = 5) {
  const scored = drinks
    .map(d => {
      const ratings = (d.tastings || []).map(t => t.rating).filter(r => typeof r === 'number' && !Number.isNaN(r));
      if (ratings.length < 2) return null;
      return { id: d.id, label: drinkLabel(d), category: d._category, stdDev: populationStdDev(ratings), tastingCount: ratings.length, drink: d };
    })
    .filter(Boolean);
  return {
    mostConsistent: [...scored].sort((a, b) => a.stdDev - b.stdDev).slice(0, n),
    leastConsistent: [...scored].sort((a, b) => b.stdDev - a.stdDev).slice(0, n),
  };
}

function avgOf(values) {
  return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100 : 0;
}

function validRatings(drinks) {
  return drinks.map(d => d.avgRating).filter(v => typeof v === 'number' && !Number.isNaN(v));
}

// Bayesian/IMDB weighted rating: shrinks R toward prior C by an amount that shrinks as
// sample size v grows; m is the "how many tastings to fully trust R" confidence constant.
export function weightedRating(R, v, C, m) {
  if (v + m <= 0) return C;
  return Math.round(((v / (v + m)) * R + (m / (v + m)) * C) * 100) / 100;
}

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Map of drink id -> weightedRating; C/m are derived from `drinks` itself (the caller's scope).
// Backs DrinkTable's "Top rated" sort. Known limitation: a wine's per-row vintage selector
// does NOT recompute weightedRating per vintage — it stays pinned to the drink-level value.
export function buildWeightedRatings(drinks) {
  const valid = drinks.filter(d => typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating));
  const C = avgOf(valid.map(d => d.avgRating));
  const m = median(valid.map(d => d.tastingCount || 0));
  return new Map(valid.map(d => [d.id, weightedRating(d.avgRating, d.tastingCount || 0, C, m)]));
}

// For leaderboard rows shaped { avgRating, count } -> same rows + weightedRating
function addWeightedRatingToRows(rows) {
  if (!rows.length) return rows;
  const C = avgOf(rows.map(r => r.avgRating));
  const m = median(rows.map(r => r.count));
  return rows.map(r => ({ ...r, weightedRating: weightedRating(r.avgRating, r.count, C, m) }));
}

export function buildBestOf(drinks, n = 10) {
  const scored = drinks
    .filter(d => typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating))
    .map(d => ({ id: d.id, label: drinkLabel(d), category: d._category, avgRating: d.avgRating, tastingCount: d.tastingCount, drink: d }));
  const weights = buildWeightedRatings(drinks);
  return scored
    .map(e => ({ ...e, weightedRating: weights.get(e.id) }))
    .sort((a, b) => b.weightedRating - a.weightedRating)
    .slice(0, n);
}

export function buildCountryRanking(drinks) {
  const groups = new Map();
  for (const d of drinks) {
    if (!d.country) continue;
    if (!groups.has(d.country)) groups.set(d.country, []);
    if (typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating)) groups.get(d.country).push(d.avgRating);
  }
  const rows = [...groups.entries()].map(([country, values]) => ({ country, avgRating: avgOf(values), count: values.length }));
  return addWeightedRatingToRows(rows);
}

export function avgLotPrice(drink) {
  const prices = (drink.collection || []).map(l => l.price).filter(p => typeof p === 'number' && !Number.isNaN(p));
  return prices.length ? avgOf(prices) : null;
}

export function buildPriceRatingScatter(drinks) {
  return drinks
    .map(d => ({ price: avgLotPrice(d), rating: d.avgRating, d }))
    .filter(({ price, rating }) => price !== null && typeof rating === 'number' && !Number.isNaN(rating))
    .map(({ price, rating, d }) => ({
      id: d.id, category: d._category, label: drinkLabel(d), price, rating, drink: d,
    }));
}

export function buildAvgPriceCategoryComparison(drinks) {
  return categoryComparison(drinks, avgLotPrice, 'avgPrice');
}

export function buildAvgPriceByCountry(drinks) {
  const groups = new Map();
  for (const d of drinks) {
    if (!d.country) continue;
    const price = avgLotPrice(d);
    if (price === null) continue;
    if (!groups.has(d.country)) groups.set(d.country, []);
    groups.get(d.country).push(price);
  }
  return [...groups.entries()]
    .map(([country, prices]) => ({ country, avgPrice: avgOf(prices), count: prices.length }))
    .filter(r => r.count > 0);
}

export function buildBestValue(drinks, n = 10) {
  const weights = buildWeightedRatings(drinks);
  const scored = drinks
    .map(d => {
      const price = avgLotPrice(d);
      const weightedRating = weights.get(d.id);
      if (price === null || price <= 0 || typeof weightedRating !== 'number') return null;
      return {
        id: d.id, label: drinkLabel(d), category: d._category, avgRating: d.avgRating, price, weightedRating,
        valueScore: Math.round((weightedRating / price) * 100) / 100, drink: d,
      };
    })
    .filter(Boolean);
  return scored.sort((a, b) => b.valueScore - a.valueScore).slice(0, n);
}

const WORLD_BUCKETS = [
  { label: 'Old World', test: c => OLD_WORLD.includes(c) },
  { label: 'New World', test: c => NEW_WORLD.includes(c) },
  { label: 'Other', test: c => !OLD_WORLD.includes(c) && !NEW_WORLD.includes(c) },
];

export function buildOldNewWorldBreakdown(wineDrinks) {
  return WORLD_BUCKETS.map(({ label, test }) => {
    const values = validRatings(wineDrinks.filter(d => d.country && test(d.country)));
    return { label, avgRating: avgOf(values), count: values.length };
  });
}

export function buildRegionLeaderboard(drinks, n = 10) {
  const groups = new Map();
  for (const d of drinks) {
    if (!d.region) continue;
    const key = `${d._category}||${d.country}||${d.region}`;
    if (!groups.has(key)) groups.set(key, { category: d._category, country: d.country, region: d.region, values: [] });
    if (typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating)) groups.get(key).values.push(d.avgRating);
  }
  const rows = [...groups.values()]
    .map(({ category, country, region, values }) => ({ category, country, region, avgRating: avgOf(values), count: values.length }))
    .filter(r => r.count > 0);
  return addWeightedRatingToRows(rows)
    .sort((a, b) => b.weightedRating - a.weightedRating)
    .slice(0, n);
}

// No "date added" field exists on a drink, so earliest tasting date is used as a proxy.
export function buildDiscoveryPace(drinks) {
  const buckets = new Map();
  for (const d of drinks) {
    const dates = (d.tastings || []).map(t => parseDrinkDate(t.date)).filter(Boolean);
    if (dates.length === 0) continue;
    const earliest = new Date(Math.min(...dates));
    const key = format(earliest, 'yyyy-MM');
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), 'MMM'));

// Tasting-date month histogram, all categories pooled — same earliest-tasting-as-proxy
// caveat as buildDiscoveryPace applies to any date-derived analytics here.
export function buildSeasonalPattern(drinks) {
  const counts = new Array(12).fill(0);
  for (const d of drinks) {
    for (const t of d.tastings || []) {
      const date = parseDrinkDate(t.date);
      if (!date) continue;
      counts[date.getMonth()]++;
    }
  }
  return MONTH_LABELS.map((month, i) => ({ month, count: counts[i] }));
}

export function buildCategoryTrend(drinks) {
  const buckets = new Map();
  for (const d of drinks) {
    if (!COMPARISON_CATEGORIES.includes(d._category)) continue;
    for (const t of d.tastings || []) {
      const date = parseDrinkDate(t.date);
      if (!date) continue;
      const key = format(date, 'yyyy-MM');
      if (!buckets.has(key)) buckets.set(key, Object.fromEntries(COMPARISON_CATEGORIES.map(c => [c, 0])));
      buckets.get(key)[d._category]++;
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));
}

const STYLE_FIELD = { wine: 'variety', beer: 'style', whiskey: 'style', others: 'style' };

// group by a per-drink key extractor (array of keys → a drink can count toward several, e.g. blend grapes)
function buildKeyLeaderboard(drinks, keysOf) {
  const groups = new Map();
  for (const d of drinks) {
    if (typeof d.avgRating !== 'number' || Number.isNaN(d.avgRating)) continue;
    for (const key of keysOf(d)) {
      if (!key || key === '-') continue;            // drop empty + others' "-" placeholder
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d.avgRating);
    }
  }
  const rows = [...groups.entries()].map(([style, v]) => ({ style, avgRating: avgOf(v), count: v.length }));
  return addWeightedRatingToRows(rows).sort((a, b) => b.count - a.count || b.avgRating - a.avgRating);
}

export function buildStyleLeaderboard(drinks, category, { splitBlends = true } = {}) {
  let keysOf;
  if (category === 'wine') {
    keysOf = splitBlends ? d => d.variety || [] : d => [(d.variety || []).join(', ')];
  } else {
    keysOf = d => [d[STYLE_FIELD[category] || 'style']];
  }
  return buildKeyLeaderboard(drinks, keysOf);
}

export function buildProducerLeaderboard(drinks, category) {
  return buildKeyLeaderboard(drinks, d => [d[PRODUCER_FIELD[category]]]);
}

// Variance of a producer's own drinks' avgRatings (not per-drink tasting variance) — needs ≥2 drinks
export function buildProducerConsistency(drinks, category, n = 5) {
  const field = PRODUCER_FIELD[category];
  const groups = new Map();
  for (const d of drinks) {
    const key = d[field];
    if (!key || key === '-') continue;
    if (typeof d.avgRating !== 'number' || Number.isNaN(d.avgRating)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d.avgRating);
  }
  const scored = [...groups.entries()]
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([producer, ratings]) => ({ producer, stdDev: populationStdDev(ratings), count: ratings.length }));
  return {
    mostConsistent:  [...scored].sort((a, b) => a.stdDev - b.stdDev).slice(0, n),
    leastConsistent: [...scored].sort((a, b) => b.stdDev - a.stdDev).slice(0, n),
  };
}

// Groups by t.vintage/t.rating (per-TASTING), never d.avgRating/d.vintage — a drink's tastings can
// span multiple vintages, and drink.vintage is just a denormalized mirror of the last one.
export function buildVintageLeaderboard(wineDrinks) {
  const groups = new Map();
  for (const d of wineDrinks) {
    for (const t of d.tastings || []) {
      if (!t.vintage) continue;
      if (typeof t.rating !== 'number' || Number.isNaN(t.rating)) continue;
      if (!groups.has(t.vintage)) groups.set(t.vintage, []);
      groups.get(t.vintage).push(t.rating);
    }
  }
  const rows = [...groups.entries()].map(([style, ratings]) => ({ style, avgRating: avgOf(ratings), count: ratings.length }));
  return addWeightedRatingToRows(rows).sort((a, b) => b.weightedRating - a.weightedRating || b.count - a.count);
}

export function buildAgeVsRatingScatter(wineDrinks) {
  const points = [];
  for (const d of wineDrinks) {
    for (const t of d.tastings || []) {
      if (!t.vintage) continue;
      if (typeof t.rating !== 'number' || Number.isNaN(t.rating)) continue;
      const date = parseDrinkDate(t.date);
      if (!date) continue;
      const vintageYear = Number(t.vintage);
      if (Number.isNaN(vintageYear)) continue;
      const age = date.getFullYear() - vintageYear;
      if (age < 0) continue; // data-entry error: tasting predates its own vintage
      points.push({ id: t.id, category: d._category, label: drinkLabel(d), age, rating: t.rating, drink: d });
    }
  }
  return points;
}

// Intentionally NOT weighted-rating-based (see weightedRating above) — the whole point
// here is to surface raw high-avg/low-sample outliers, which weighting would suppress.
export function buildUndiscovered(rows, { minAvg = 8, maxCount = 3 } = {}) {
  return rows.filter(r => r.avgRating >= minAvg && r.count <= maxCount)
             .sort((a, b) => b.avgRating - a.avgRating);
}

export function buildExplorerScore(drinks) {
  const countries = [...new Set(drinks.map(d => d.country).filter(Boolean))].sort();
  const total = drinks.length;
  return {
    countries, uniqueCount: countries.length, total,
    pct: total === 0 ? 0 : Math.round((countries.length / total) * 1000) / 10,
  };
}

// key -> earliest tasting date across `drinks`, skipping drinks with no parseable tasting date
function earliestTastingByKey(drinks, keyOf) {
  const earliest = new Map();
  for (const d of drinks) {
    const key = keyOf(d);
    if (!key || key === '-') continue;
    const dates = (d.tastings || []).map(t => parseDrinkDate(t.date)).filter(Boolean);
    if (dates.length === 0) continue;
    const min = new Date(Math.min(...dates));
    if (!earliest.has(key) || min < earliest.get(key)) earliest.set(key, min);
  }
  return earliest;
}

export function buildNewCountriesThisYear(drinks, year = new Date().getFullYear()) {
  const earliest = earliestTastingByKey(drinks, d => d.country);
  return [...earliest.entries()]
    .filter(([, date]) => date.getFullYear() === year)
    .map(([country, date]) => ({ country, firstTasted: format(date, 'MMM yyyy') }))
    .sort((a, b) => a.country.localeCompare(b.country));
}

export function buildNewStylesThisYear(drinks, year = new Date().getFullYear()) {
  const earliest = earliestTastingByKey(drinks, (d) => {
    const style = d[STYLE_FIELD[d._category] || 'style'];
    return style && style !== '-' ? `${d._category}||${style}` : null;
  });
  return [...earliest.entries()]
    .filter(([, date]) => date.getFullYear() === year)
    .map(([key, date]) => {
      const [category, style] = key.split('||');
      return { category, style, firstTasted: format(date, 'MMM yyyy') };
    })
    .sort((a, b) => a.style.localeCompare(b.style));
}

// avgRating >= minAvg and drink.lastTasted (own field, not tastings[]) older than `years` ago
export function buildDrinksToRevisit(drinks, { minAvg = 8, years = 1, now = new Date() } = {}) {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return drinks
    .filter(d => typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating) && d.avgRating >= minAvg)
    .map(d => ({ id: d.id, label: drinkLabel(d), category: d._category, avgRating: d.avgRating, lastTasted: d.lastTasted, lastTastedDate: parseDrinkDate(d.lastTasted), drink: d }))
    .filter(r => r.lastTastedDate && r.lastTastedDate < cutoff)
    .sort((a, b) => a.lastTastedDate - b.lastTastedDate || b.avgRating - a.avgRating);
}
