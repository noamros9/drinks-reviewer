const { parse, format, isValid } = require('date-fns');

const DATE_FORMATS = [
  'dd/MM/yyyy', 'd/M/yyyy', 'd/M/yy', 'dd/MM/yy', 'MM/dd/yyyy', 'yyyy-MM-dd',
  'd.M.yy', 'dd.MM.yy', 'd.M.yyyy', 'dd.MM.yyyy',
];

function normalizeDate(raw) {
  for (const fmt of DATE_FORMATS) {
    const d = parse(raw, fmt, new Date());
    if (isValid(d) && d.getFullYear() >= 2000) return format(d, 'dd/MM/yyyy');
  }
  return null;
}

function computeFromTastings(tastings, isWine) {
  if (!tastings || !tastings.length) return {};
  const ratings = tastings.map(t => t.rating);
  const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 100) / 100;
  const last = tastings[tastings.length - 1];
  const result = {
    avgRanking: avg,
    lastRanking: last.rating,
    lastTasted: last.date,
    tastingCount: tastings.length,
  };
  if (isWine) {
    const lastWithVintage = [...tastings].reverse().find(t => t.vintage);
    if (lastWithVintage) result.vintage = lastWithVintage.vintage;
  }
  return result;
}

module.exports = { normalizeDate, computeFromTastings };
