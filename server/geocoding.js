const db = require('./db');

const USER_AGENT = 'drinks-reviewer/1.0 (personal project; https://github.com/noamros9/drinks-reviewer)';

// Nominatim will happily return a match from the wrong continent: "Judea, Israel" resolves
// to a street named "Judea / Esq. Israel" in Maipú, Santiago, and that is how the Judean
// Hills marker — 15 wines — ended up plotted in Chile. Every result is checked against the
// country we asked for, so a mismatch stores nothing instead of a plausible-looking lie.
//
// Only countries that actually appear as a drink's `country` need an entry. An unlisted
// country returns undefined, which we treat as "can't verify" and accept, so adding a drink
// from a new country still geocodes rather than silently failing.
const COUNTRY_CODES = {
  Argentina: 'ar', Australia: 'au', Austria: 'at', Belgium: 'be', Brazil: 'br',
  Canada: 'ca', Chile: 'cl', China: 'cn', Croatia: 'hr', Cyprus: 'cy',
  'Czech Republic': 'cz', Czechia: 'cz', Denmark: 'dk', England: 'gb', France: 'fr',
  Georgia: 'ge', Germany: 'de', Greece: 'gr', Hungary: 'hu', India: 'in',
  Ireland: 'ie', Israel: 'il', Italy: 'it', Jamaica: 'jm', Japan: 'jp',
  Lebanon: 'lb', Luxembourg: 'lu', Mexico: 'mx', Moldova: 'md', Morocco: 'ma',
  Netherlands: 'nl', 'New Zealand': 'nz', 'North Macedonia': 'mk', Norway: 'no',
  Paraguay: 'py', Peru: 'pe', Philippines: 'ph', Poland: 'pl', Portugal: 'pt',
  Romania: 'ro', Russia: 'ru', Scotland: 'gb', Serbia: 'rs', Slovakia: 'sk',
  Slovenia: 'si', 'South Africa': 'za', Spain: 'es', Sweden: 'se', Switzerland: 'ch',
  Turkey: 'tr', USA: 'us', 'United States': 'us', 'United Kingdom': 'gb', Uruguay: 'uy',
  Wales: 'gb', Zimbabwe: 'zw',
};

// Exported so the backfill script can re-check coordinates already stored.
function countryCode(country) {
  return COUNTRY_CODES[country];
}

// A handful of wine-trade region names aren't what OpenStreetMap calls the place. "Judean
// Hills" finds nothing in Israel (and "Judea" finds a street in Chile); "Judean Mountains"
// lands on the right national park.
const REGION_QUERY_ALIASES = {
  'Judean Hills': 'Judean Mountains',
};

// Nominatim wants a place name, not a path: the cache key keeps the full hierarchy but the
// search uses the most specific segment. Mirrors REGION_SEP in client/src/utils/filterHelpers.js.
async function geocodeRegion(country, region) {
  const leaf = region.split(' / ').pop();
  const query = encodeURIComponent(`${REGION_QUERY_ALIASES[leaf] ?? leaf}, ${country}`);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
    { headers: { 'User-Agent': USER_AGENT } }
  );
  if (!res.ok) return null;
  const results = await res.json();
  if (!results.length) return null;

  const expected = countryCode(country);
  const got = results[0].address?.country_code;
  if (expected && got && got !== expected) return null;

  return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
}

// Does a coordinate already on file actually sit in the country it claims? Asking Nominatim
// what's at the point is the only check that distinguishes a wrong answer from a merely
// imprecise one — re-running the forward search and comparing distance does not: "Alsace,
// France" resolves to a street in Lille, 250km from the (correct) stored Alsace point.
// Returns true when it cannot tell, so an unverifiable row is kept rather than destroyed.
async function coordinateIsInCountry(country, { lat, lon }) {
  const expected = countryCode(country);
  if (!expected) return true;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=5`,
    { headers: { 'User-Agent': USER_AGENT } }
  );
  if (!res.ok) return true;
  const got = (await res.json())?.address?.country_code;
  return !got || got === expected;
}

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
    const found = await geocodeRegion(country, region);
    if (!found) return;
    await collection.insertMany([{ _id: key, ...found }]);
  } catch {
    // network failure, rate limit, etc. — skip silently, retried on next save
  }
}

module.exports = { ensureRegionCoordinates, readCoordinates, geocodeRegion, coordinateIsInCountry, countryCode };
