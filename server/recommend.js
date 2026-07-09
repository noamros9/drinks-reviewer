const { readData } = require('./dataStore');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

const SIMILARITY_FIELDS = {
  wine: ['producer', 'seriesAndName', 'wineCategory', 'variety', 'sweetness', 'country', 'region', 'abv', 'tags'],
  beer: ['brewery', 'name', 'style', 'country', 'abv', 'tags'],
  whiskey: ['distillery', 'name', 'country', 'region', 'age', 'style', 'abv', 'tags'],
  others: ['drinkCategory', 'distillery', 'name', 'country', 'style', 'age', 'abv', 'tags'],
};

class RecommendError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function label(drink) {
  const producer = drink.producer ?? drink.brewery ?? drink.distillery ?? '';
  const name = drink.seriesAndName || drink.name || '';
  return [producer, name].filter(Boolean).join(' ') || 'Unknown';
}

function trim(drink, category) {
  const picked = { id: drink.id, category, label: label(drink), avgRating: drink.avgRating };
  for (const field of SIMILARITY_FIELDS[category]) picked[field] = drink[field];
  return picked;
}

const NUMERIC_FIELDS = { abv: 1, age: 3 }; // ponytail: fixed tolerance per field, tune if scores feel off

function fieldScore(field, seedVal, candVal) {
  if (seedVal == null || candVal == null || seedVal === '' || candVal === '') return 0;
  if (field === 'tags') {
    const a = new Set(seedVal), b = new Set(candVal);
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return intersection / union;
  }
  if (field in NUMERIC_FIELDS) {
    const diff = Math.abs(parseFloat(seedVal) - parseFloat(candVal));
    if (Number.isNaN(diff)) return 0;
    return Math.max(0, 1 - diff / NUMERIC_FIELDS[field]);
  }
  return seedVal === candVal ? 1 : 0;
}

const FIELD_LABELS = {
  producer: 'producer', brewery: 'brewery', distillery: 'distillery',
  seriesAndName: 'name', name: 'name', variety: 'variety', wineCategory: 'category',
  drinkCategory: 'category', sweetness: 'sweetness', style: 'style',
  country: 'country', region: 'region', abv: 'ABV', age: 'age', tags: 'tags',
};

// ponytail: only scores candidates against seeds of the same category (cross-category
// field sets barely overlap) — add cross-category scoring if that's ever wanted.
function scoreAndReason(sameCategorySeeds, candidate) {
  const fields = SIMILARITY_FIELDS[candidate.category];
  let best = { score: 0, matchedFields: [] };
  for (const seed of sameCategorySeeds) {
    const perField = fields.map(f => ({ f, s: fieldScore(f, seed[f], candidate[f]) }));
    const score = perField.reduce((sum, x) => sum + x.s, 0);
    if (score > best.score) best = { score, matchedFields: perField.filter(x => x.s > 0).map(x => x.f) };
  }
  return best;
}

function scoreSimilarity(seedDrinks, candidate) {
  const sameCategorySeeds = seedDrinks.filter(s => s.category === candidate.category);
  return scoreAndReason(sameCategorySeeds, candidate).score;
}

function buildOwnCatalogue(seedDrinks, candidatePool) {
  const seedsByCategory = {};
  for (const seed of seedDrinks) (seedsByCategory[seed.category] ||= []).push(seed);

  return candidatePool
    .map(candidate => ({ candidate, ...scoreAndReason(seedsByCategory[candidate.category] || [], candidate) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ candidate, matchedFields }) => ({
      id: candidate.id,
      category: candidate.category,
      label: candidate.label,
      reason: `Similar ${matchedFields.map(f => FIELD_LABELS[f]).join(', ')}`, // matchedFields is always non-empty here: filter(score > 0) guarantees at least one field scored > 0; every SIMILARITY_FIELDS entry has a FIELD_LABELS mapping
    }));
}

function buildPrompt(seedDrinks) {
  return `You are a drinks recommendation assistant for a personal wine/beer/whiskey/spirits journal app.

The user picked these drinks as the basis for a recommendation:
${JSON.stringify(seedDrinks, null, 2)}

Find real-world drinks similar to the seeds above, in two groups:
1. "availableInIsrael": real-world drinks similar to the seeds that can be purchased in Israel. Use search to find one real, working purchase link per entry — omit an entry if you cannot find an actual link, never invent one.
2. "notAvailable": real-world drinks similar to the seeds that are not readily available for purchase in Israel.
Groups combined should have roughly 3-6 entries, as many as make sense.

Respond with ONLY a single fenced JSON code block at the very end of your reply, matching exactly this shape:
\`\`\`json
{
  "availableInIsrael": [{"name": "...", "description": "...", "url": "...", "reason": "..."}],
  "notAvailable": [{"name": "...", "description": "...", "reason": "..."}]
}
\`\`\``;
}

// IDENTITY_FIELDS name the specific bottle (who made it / what it's called), not a taste dimension —
// excluded so a taste profile describes preferences, not a specific producer roster.
const IDENTITY_FIELDS = new Set(['producer', 'seriesAndName', 'brewery', 'distillery', 'name']);
const TASTE_FIELDS = Object.fromEntries(
  CATEGORIES.map(c => [c, SIMILARITY_FIELDS[c].filter(f => !IDENTITY_FIELDS.has(f))])
);

// ponytail: both always called with a non-empty array (call sites guard on rated.length), no empty-input branch needed
function avgOf(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Same Bayesian formula as client/src/utils/analyticsHelpers.js — ported rather than shared because
// that file is ESM and this one is CommonJS.
function weightedRating(R, v, C, m) {
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

// ponytail: no v+m<=0 guard, no tastingCount/weights fallback — tastingsHelper.js always sets
// tastingCount alongside avgRating (>=1), so every entry here has a real tastingCount and a real weight.
function buildWeightedRatings(ratedDrinks) {
  const C = avgOf(ratedDrinks.map(d => d.avgRating));
  const m = median(ratedDrinks.map(d => d.tastingCount));
  return new Map(ratedDrinks.map(d => [d.id, weightedRating(d.avgRating, d.tastingCount, C, m)]));
}

const MULTI_MODAL_RATIO = 0.8; // ponytail: within 80% of the top weight counts as "near-tied"
const MULTI_MODAL_CAP = 3;     // ponytail: cap list length so the prompt/UI stay scannable

function dominantValue(entries, field, weights) {
  const totals = new Map();
  for (const d of entries) {
    const v = d[field];
    if (v == null || v === '') continue;
    totals.set(v, (totals.get(v) || 0) + weights.get(d.id));
  }
  if (!totals.size) return null;
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0][1];
  const close = sorted.filter(([, w]) => w >= top * MULTI_MODAL_RATIO).slice(0, MULTI_MODAL_CAP).map(([v]) => v);
  return close.length === 1 ? close[0] : close;
}

function topTags(entries, weights, n = 3) {
  const totals = new Map();
  for (const d of entries) {
    for (const tag of d.tags || []) totals.set(tag, (totals.get(tag) || 0) + weights.get(d.id));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([tag]) => tag);
}

function numericRange(entries, field) {
  const vals = entries.map(d => parseFloat(d[field])).filter(v => !Number.isNaN(v));
  if (!vals.length) return null;
  const avg = Math.round(avgOf(vals) * 100) / 100;
  return { avg, min: Math.min(...vals), max: Math.max(...vals) };
}

function buildTasteProfile(category, ratedDrinks, weights) {
  const profile = { category, entryCount: ratedDrinks.length };
  for (const field of TASTE_FIELDS[category]) {
    if (field === 'tags') profile.topTags = topTags(ratedDrinks, weights);
    else if (field in NUMERIC_FIELDS) profile[field] = numericRange(ratedDrinks, field);
    else profile[field] = dominantValue(ratedDrinks, field, weights);
  }
  return profile;
}

function buildTasteCardPrompt(profile, disliked) {
  const dislikedSection = disliked
    ? `They also tend to dislike drinks matching this profile — avoid recommending things too similar to it:\n${JSON.stringify(disliked, null, 2)}`
    : `They haven't rated enough drinks poorly yet to show a clear dislike pattern — don't invent one.`;

  return `You are a drinks recommendation assistant for a personal wine/beer/whiskey/spirits journal app.

The user's taste profile for their ${profile.category} collection, distilled from everything they've rated:
${JSON.stringify(profile, null, 2)}

${dislikedSection}

Find real-world drinks that match this taste profile, in two groups:
1. "availableInIsrael": real-world drinks matching the profile that can be purchased in Israel. Use search to find one real, working purchase link per entry — omit an entry if you cannot find an actual link, never invent one.
2. "notAvailable": real-world drinks matching the profile that are not readily available for purchase in Israel.
Groups combined should have roughly 20-30 entries, as many as make sense.

Also write a short (2-4 sentence) "summary" string in plain conversational language describing what this user tends to like and, if a dislike pattern was given above, what they tend to avoid. If no dislike pattern was given, just describe what they like and say they don't have clear dislikes yet.

Respond with ONLY a single fenced JSON code block at the very end of your reply, matching exactly this shape:
\`\`\`json
{
  "summary": "...",
  "availableInIsrael": [{"name": "...", "description": "...", "url": "...", "reason": "..."}],
  "notAvailable": [{"name": "...", "description": "...", "reason": "..."}]
}
\`\`\``;
}

function parseResponse(body) {
  const text = (body.candidates || [])
    .flatMap(c => (c.content?.parts || []))
    .map(part => part.text)
    .filter(Boolean)
    .join('\n');
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!match) throw new RecommendError('No JSON found in Gemini response', 502);
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new RecommendError('Failed to parse JSON from Gemini response', 502);
  }
}

// ponytail: fuzzy substring match against known labels rather than a real dedupe/fuzzy-match
// library — good enough to catch "already own this" overlaps, revisit if false positives show up.
function alreadyInCatalogue(name, catalogueLabels) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return false;
  return catalogueLabels.some(label => {
    const l = label.trim().toLowerCase();
    return n.includes(l) || l.includes(n);
  });
}

function validate(parsed, catalogueLabels, { availableCap = 8, totalCap = 8 } = {}) {
  const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
  const availableInIsrael = (parsed.availableInIsrael || [])
    .filter(e => typeof e.url === 'string' && e.url.trim())
    .filter(e => !alreadyInCatalogue(e.name, catalogueLabels))
    .slice(0, availableCap);
  const notAvailable = (parsed.notAvailable || [])
    .filter(e => !alreadyInCatalogue(e.name, catalogueLabels))
    .slice(0, Math.max(0, totalCap - availableInIsrael.length));

  return { summary, availableInIsrael, notAvailable };
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ponytail: one retry on a transient 503 ("model overloaded") is Google's own recommended
// handling for this status; raise RETRIES if it's still flaky in practice.
const RETRIES = 1;

async function callGemini(promptText) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          tools: [{ google_search: {} }],
        }),
      }
    );
    if (res.ok) return res.json();
    if (res.status !== 503 || attempt === RETRIES) {
      let detail;
      try { detail = (await res.json())?.error?.message; } catch { /* body not JSON */ }
      throw new RecommendError(detail ? `Gemini API error: ${detail}` : `Gemini API error: ${res.status}`, 502);
    }
    await sleep(1000);
  }
}

async function getRecommendations(seeds) {
  if (!process.env.GEMINI_API_KEY) throw new RecommendError('GEMINI_API_KEY is not set', 500);

  const catalogueByCategory = {};
  try {
    for (const category of CATEGORIES) catalogueByCategory[category] = readData(category);
  } catch (err) {
    throw new RecommendError(err.message, 500);
  }

  const seedDrinks = seeds.map(({ id, category }) => {
    const drink = (catalogueByCategory[category] || []).find(d => d.id === id);
    if (!drink) throw new RecommendError(`Seed drink not found: ${id}`, 400);
    return trim(drink, category);
  });

  const seedIds = new Set(seedDrinks.map(d => d.id));
  const candidatePool = CATEGORIES.flatMap(category =>
    catalogueByCategory[category].filter(d => !seedIds.has(d.id)).map(d => trim(d, category))
  );

  const ownCatalogue = buildOwnCatalogue(seedDrinks, candidatePool);
  const catalogueLabels = [...seedDrinks, ...candidatePool].map(d => d.label);
  const body = await callGemini(buildPrompt(seedDrinks));
  const { availableInIsrael, notAvailable } = validate(parseResponse(body), catalogueLabels);
  return { ownCatalogue, availableInIsrael, notAvailable };
}

const DISLIKE_THRESHOLD = 5; // ponytail: 1-10 scale — below 5 is a real miss, not just middling

async function getTasteCard(category) {
  if (!process.env.GEMINI_API_KEY) throw new RecommendError('GEMINI_API_KEY is not set', 500);
  if (!CATEGORIES.includes(category)) throw new RecommendError(`Unknown category: ${category}`, 400);

  let drinks;
  try {
    drinks = readData(category);
  } catch (err) {
    throw new RecommendError(err.message, 500);
  }

  const rated = drinks.filter(d => typeof d.avgRating === 'number' && !Number.isNaN(d.avgRating));
  if (!rated.length) throw new RecommendError('No rated drinks in this category yet', 400);

  const weights = buildWeightedRatings(rated);
  const profile = buildTasteProfile(category, rated, weights);

  const lowRated = rated.filter(d => d.avgRating < DISLIKE_THRESHOLD);
  const disliked = lowRated.length
    ? buildTasteProfile(category, lowRated, buildWeightedRatings(lowRated))
    : null; // ponytail: empty bucket is expected (a user who only rates things they like) — not an error

  const catalogueLabels = drinks.map(d => label(d));

  const body = await callGemini(buildTasteCardPrompt(profile, disliked));
  const { summary, availableInIsrael, notAvailable } = validate(parseResponse(body), catalogueLabels, { availableCap: 15, totalCap: 30 });
  return { profile, disliked, summary, availableInIsrael, notAvailable };
}

module.exports = { getRecommendations, scoreSimilarity, getTasteCard };
