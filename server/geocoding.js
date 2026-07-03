const fs = require('fs');
const path = require('path');

const DATA_DIR_PATH = process.env.DATA_DIR || path.join(__dirname, 'data');
const COORDS_FILE_PATH = path.join(DATA_DIR_PATH, 'region-coordinates.json');
const USER_AGENT = 'drinks-reviewer/1.0 (personal project; https://github.com/noamros9/drinks-reviewer)';

function readCoordinates() {
  try {
    return JSON.parse(fs.readFileSync(COORDS_FILE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeCoordinates(cache) {
  fs.writeFileSync(COORDS_FILE_PATH, JSON.stringify(cache, null, 2));
}

// Geocoding is best-effort: a new region just won't have a map marker until this
// succeeds on some later save. Never let it block or fail a drink save.
async function ensureRegionCoordinates(country, region) {
  if (!country || !region) return;
  const key = `${country}||${region}`;
  const cache = readCoordinates();
  if (cache[key]) return;

  try {
    const query = encodeURIComponent(`${region}, ${country}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return;
    const results = await res.json();
    if (!results.length) return;
    cache[key] = { lat: Number(results[0].lat), lon: Number(results[0].lon) };
    writeCoordinates(cache);
  } catch {
    // network failure, rate limit, etc. — skip silently, retried on next save
  }
}

module.exports = { ensureRegionCoordinates, readCoordinates };
