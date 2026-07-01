function computeFromTastings(tastings, isWine) {
  if (!tastings || !tastings.length) return {};
  const ratings = tastings.map(t => t.rating);
  const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 100) / 100;
  const last = tastings[tastings.length - 1];
  const result = {
    avgRating: avg,
    lastRating: last.rating,
    lastTasted: last.date,
    tastingCount: tastings.length,
  };
  if (isWine) {
    const lastWithVintage = [...tastings].reverse().find(t => t.vintage);
    if (lastWithVintage) result.vintage = lastWithVintage.vintage;
  }
  return result;
}

module.exports = { computeFromTastings };
