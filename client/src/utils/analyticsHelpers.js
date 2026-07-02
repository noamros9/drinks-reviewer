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
