// One-time (rerunnable) backfill: estimate a market price for drinks with no priced
// collection lot, via Gemini + Google Search grounding. Never guesses — a drink with no
// confident real listing is left unpriced, same policy as the Vivino score backfill.
// Run manually: node server/scripts/backfill-estimated-prices.js
// Requires MONGODB_URI and GEMINI_API_KEY to already be set in the environment.
const { readData, writeData } = require('../dataStore');
const { close } = require('../db');
const { callGemini, parseResponse } = require('../recommend');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
// ponytail: smaller than the original 20 — a single grounded Gemini call has a practical
// budget for how many items it searches thoroughly per turn (observed: 20-item batch
// returned finishReason STOP with only 9/20 priced, not a token-limit truncation). Revisit
// if hit-rate is still low at this size.
const BATCH_SIZE = 8;

function avgLotPrice(drink) {
  const prices = (drink.collection || []).map(l => l.price).filter(p => typeof p === 'number' && !Number.isNaN(p));
  return prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
}

function drinkLabel(drink) {
  const producer = drink.producer ?? drink.brewery ?? drink.distillery ?? '';
  const name = drink.seriesAndName || drink.name || '';
  return [producer, name].filter(Boolean).join(' ') || 'Unknown';
}

function buildPrompt(batch) {
  return `You are pricing drinks for a personal wine/beer/whiskey/spirits journal app based in Israel.

For each drink below, search multiple online retailers (prefer Israeli stores) and estimate its typical retail price by averaging what you find across at least 2-3 real listings. Only include a drink in your answer if you found real, confident listings — omit any drink you can't confidently price, never guess or invent a number.

Drinks:
${JSON.stringify(batch, null, 2)}

Respond with ONLY a single fenced JSON code block at the very end of your reply, matching exactly this shape:
\`\`\`json
{"prices": [{"id": "...", "category": "...", "price": 0}]}
\`\`\``;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function backfillCategory(category) {
  const data = await readData(category);
  const pending = data.filter(d => avgLotPrice(d) === null && typeof d.estimatedPrice !== 'number');
  let priced = 0;
  let batchErr = null;

  for (const batch of chunk(pending, BATCH_SIZE)) {
    const requestItems = batch.map(d => ({
      id: d.id, category, label: drinkLabel(d), country: d.country, region: d.region,
    }));
    try {
      const body = await callGemini(buildPrompt(requestItems));
      const parsed = parseResponse(body);
      const validIds = new Set(batch.map(d => d.id));
      for (const entry of Array.isArray(parsed.prices) ? parsed.prices : []) {
        if (!entry || entry.category !== category || !validIds.has(entry.id)) continue;
        if (typeof entry.price !== 'number' || Number.isNaN(entry.price) || entry.price <= 0) continue;
        const drink = data.find(d => d.id === entry.id);
        drink.estimatedPrice = entry.price;
        priced++;
      }
    } catch (err) {
      batchErr = err; // stop taking new batches, but keep what earlier batches already priced
      break;
    }
  }

  // Persist whatever was priced even if a later batch failed (e.g. daily quota hit mid-category).
  if (priced > 0) await writeData(category, data);
  console.log(`${category}: attempted ${pending.length}, priced ${priced}, left blank ${pending.length - priced}`);
  if (batchErr) throw batchErr;
}

async function backfill() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is required.'); process.exit(1); }

  for (const category of CATEGORIES) await backfillCategory(category);
  await close();
}

backfill().catch(err => { console.error(err); process.exit(1); });
