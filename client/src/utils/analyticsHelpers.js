import { parse, isValid, format } from 'date-fns';
import { OLD_WORLD, NEW_WORLD } from './filterHelpers';

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

export function buildCountryRanking(drinks) {
  const countries = [...new Set(drinks.map(d => d.country).filter(Boolean))];
  return countries.map(country => {
    const values = validRatings(drinks.filter(d => d.country === country));
    return { country, avgRating: avgOf(values), count: values.length };
  });
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
  return [...groups.values()]
    .map(({ category, country, region, values }) => ({ category, country, region, avgRating: avgOf(values), count: values.length }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, n);
}
