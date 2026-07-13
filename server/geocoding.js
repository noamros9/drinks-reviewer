const db = require('./db');

const USER_AGENT = 'drinks-reviewer/1.0 (personal project; https://github.com/noamros9/drinks-reviewer)';

async function readCoordinates() {
  const collection = await db.getRegionCoordinatesCollection();
  const docs = await collection.find({}).toArray();
  return Object.fromEntries(docs.map(d => [d._id, { lat: d.lat, lon: d.lon }]));
}

// Geocoding is best-effort: a new region just won't have a map marker until this
// succeeds on some later save. Never let it block or fail a drink save.
async function ensureRegionCoordinates(country, region) {
  if (!country || !region) return;
  const key = `${country}||${region}`;
  const collection = await db.getRegionCoordinatesCollection();
  const existing = await collection.find({ _id: key }).toArray();
  if (existing.length) return;

  try {
    const query = encodeURIComponent(`${region}, ${country}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return;
    const results = await res.json();
    if (!results.length) return;
    await collection.insertMany([{ _id: key, lat: Number(results[0].lat), lon: Number(results[0].lon) }]);
  } catch {
    // network failure, rate limit, etc. — skip silently, retried on next save
  }
}

module.exports = { ensureRegionCoordinates, readCoordinates };
