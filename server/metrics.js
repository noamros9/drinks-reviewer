// Server copy of the price/rating math in client/src/utils/analyticsHelpers.js — kept separate
// because that file is ESM and this one is CommonJS. client/src/__tests__/metricsParity.test.js
// runs both over the same drinks, so the two can't drift silently.

// ponytail: callers always pass a non-empty array (they guard on length), so no empty-input branch
function avgOf(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Bayesian/IMDB weighted rating. Unlike the client, no rounding and no v+m<=0 guard.
function weightedRating(R, v, C, m) {
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

// ponytail: no tastingCount/weights fallback — tastingsHelper.js always sets tastingCount
// alongside avgRating (>=1), so every entry here has a real tastingCount and a real weight.
function buildWeightedRatings(ratedDrinks) {
  const C = avgOf(ratedDrinks.map(d => d.avgRating));
  const m = median(ratedDrinks.map(d => d.tastingCount));
  return new Map(ratedDrinks.map(d => [d.id, weightedRating(d.avgRating, d.tastingCount, C, m)]));
}

// Average of real lot prices, falling back to the backfilled estimatedPrice.
function avgLotPrice(drink) {
  const prices = (drink.collection || []).map(l => l.price).filter(p => typeof p === 'number' && !Number.isNaN(p));
  if (prices.length) return avgOf(prices);
  return typeof drink.estimatedPrice === 'number' ? drink.estimatedPrice : null;
}

module.exports = { avgOf, median, weightedRating, buildWeightedRatings, avgLotPrice };
