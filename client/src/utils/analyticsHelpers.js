import { parse, isValid, format } from 'date-fns';

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

export function buildCategoryComparison(drinks) {
  return COMPARISON_CATEGORIES.map(category => {
    const rated = drinks.filter(d => d._category === category && typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating));
    const avgRating = rated.length
      ? Math.round((rated.reduce((s, d) => s + d.avgRating, 0) / rated.length) * 100) / 100
      : 0;
    return { category, avgRating, count: rated.length };
  });
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
