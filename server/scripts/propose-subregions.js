// Proposes a more specific region for wines stored at a coarse region (or none), using
// Gemini + Google Search grounding. WRITES NOTHING TO THE DATABASE -- it emits a CSV for
// you to verify against Vivino, which then feeds the REWRITES map of a migration script.
//
// Gemini is constrained to PICK FROM the taxonomy in client/src/data/wine-regions.json,
// not to free-generate appellations, and is told to answer UNKNOWN rather than guess --
// same never-guess policy as backfill-estimated-prices.js.
//
//   node server/scripts/propose-subregions.js --mock            (no API calls; shape check)
//   node --env-file-if-exists=.env server/scripts/propose-subregions.js --limit 8
//   node --env-file-if-exists=.env server/scripts/propose-subregions.js
//
// Requires MONGODB_URI, and GEMINI_API_KEY unless --mock.
// NOTE: the free Gemini tier allows ~20 requests/day; BATCH_SIZE controls how many wines
// go per request, so 70 wines at 8/batch is 9 requests.
const fs = require('fs');
const path = require('path');
const { readData } = require('../dataStore');
const { close } = require('../db');
const { callGemini, parseResponse } = require('../recommend');
const WINE_REGIONS = require('../../client/src/data/wine-regions.json');

const SEP = ' / ';
const BATCH_SIZE = 8;   // matches the pricing backfill: grounded search per item is the limit
const OUT = path.join(__dirname, '../../subregion-proposals.csv');

function flatten(node, prefix = []) {
  const join = name => [...prefix, name].join(SEP);
  if (Array.isArray(node)) return node.map(join);
  return Object.entries(node).flatMap(([name, child]) => [join(name), ...flatten(child, [...prefix, name])]);
}

// A wine is worth asking about when the taxonomy offers something more specific than what
// it already has: either it has no region, or its region has children.
function candidateChoices(wine) {
  const known = flatten(WINE_REGIONS[wine.country] ?? {});
  if (!known.length) return null;
  if (!wine.region) return known;
  const deeper = known.filter(k => k.startsWith(wine.region + SEP));
  return deeper.length ? deeper : null;
}

function buildPrompt(batch) {
  return `You are identifying the precise wine appellation for entries in a personal wine journal.

For each wine below, search for that exact producer and bottling and determine which of its "choices" is the correct, most specific region for it.

Rules, in order of importance:
1. Answer ONLY with a string that appears verbatim in that wine's "choices" list, or the exact string "UNKNOWN".
2. Never invent a region, and never pick one that is merely plausible for the producer. If you cannot confirm this specific bottling's appellation from a real source, answer "UNKNOWN".
3. Many wines legitimately have no sub-region (e.g. a regional IGT blend). Answering "UNKNOWN" is the correct, expected answer for those - it is not a failure.
4. Include a short "source" string naming where you confirmed it (e.g. the producer's site, a retailer, Vivino). If you have no source, the answer must be "UNKNOWN".

Wines:
${JSON.stringify(batch, null, 2)}

Respond with ONLY a single fenced JSON code block at the very end of your reply, matching exactly this shape:
\`\`\`json
{"regions": [{"id": "...", "region": "...", "confidence": "high|medium|low", "source": "..."}]}
\`\`\``;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Mock keeps development off the live quota (free tier is ~20 requests/day).
function mockResponse(items) {
  const regions = items.map((it, i) => (i % 3 === 0
    ? { id: it.id, region: 'UNKNOWN', confidence: 'low', source: '' }
    : { id: it.id, region: it.choices[0], confidence: 'medium', source: 'mock' }));
  return { candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify({ regions }) + '\n```' }] } }] };
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(flatten({ A: ['B'] }), ['A', 'A / B']);
  // no region -> every path for the country is on the table
  assert.ok(candidateChoices({ country: 'Italy', region: '' }).includes('Toscana / Chianti'));
  // coarse region -> only its descendants
  const tus = candidateChoices({ country: 'Italy', region: 'Toscana' });
  assert.ok(tus.every(c => c.startsWith('Toscana / ')));
  // already specific -> nothing to ask
  assert.strictEqual(candidateChoices({ country: 'Italy', region: 'Toscana / Chianti' }), null);
  // country we have no taxonomy for -> nothing to ask
  assert.strictEqual(candidateChoices({ country: 'Scotland', region: 'Speyside' }), null);
  assert.strictEqual(csvCell('a,b'), '"a,b"');
}

async function main() {
  const mock = process.argv.includes('--mock');
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  if (!mock && !process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is required (or pass --mock).'); process.exit(1); }

  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  const wines = await readData('wine');
  const pending = [];
  for (const w of wines) {
    const choices = candidateChoices(w);
    if (choices) pending.push({ wine: w, choices });
  }
  const selected = pending.slice(0, limit);

  console.log(`${wines.length} wines, ${pending.length} worth asking about, requesting ${selected.length}`);
  console.log(`${Math.ceil(selected.length / BATCH_SIZE)} Gemini request(s)${mock ? ' [MOCKED]' : ''}\n`);

  const proposals = new Map();
  let batchErr = null;
  for (const batch of chunk(selected, BATCH_SIZE)) {
    const items = batch.map(({ wine, choices }) => ({
      id: wine.id,
      producer: wine.producer,
      name: wine.seriesAndName,
      country: wine.country,
      currentRegion: wine.region || '(none)',
      choices,
    }));
    try {
      const body = mock ? mockResponse(items) : await callGemini(buildPrompt(items));
      const parsed = parseResponse(body);
      const validIds = new Set(batch.map(b => b.wine.id));
      const choicesById = new Map(batch.map(b => [b.wine.id, b.choices]));
      for (const entry of Array.isArray(parsed.regions) ? parsed.regions : []) {
        if (!entry || !validIds.has(entry.id)) continue;
        // Hard gate: anything not literally in that wine's choice list is discarded.
        if (entry.region !== 'UNKNOWN' && !choicesById.get(entry.id).includes(entry.region)) {
          console.warn(`  discarded off-list answer for ${entry.id}: ${JSON.stringify(entry.region)}`);
          continue;
        }
        proposals.set(entry.id, entry);
      }
      process.stdout.write('.');
    } catch (err) {
      batchErr = err;
      break;
    }
  }
  console.log('\n');

  const rows = selected.map(({ wine, choices }) => {
    const p = proposals.get(wine.id);
    const proposed = p && p.region !== 'UNKNOWN' ? p.region : '';
    return [wine.id, wine.producer, wine.seriesAndName, wine.country, wine.region || '',
      proposed, p?.confidence ?? '', p?.source ?? '', choices.join(' | '), ''];
  });
  const header = ['id', 'producer', 'name', 'country', 'current_region',
    'proposed_region', 'confidence', 'source', 'choices', 'YOUR_VERDICT'];
  fs.writeFileSync(OUT, [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'), 'utf8');

  const answered = rows.filter(r => r[5]).length;
  console.log(`proposed: ${answered}`);
  console.log(`unknown / unanswered: ${rows.length - answered}`);
  console.log(`\nwrote ${OUT}`);
  console.log('NOTHING was written to the database. Fill in YOUR_VERDICT, then apply.');
  await close();
  if (batchErr) throw batchErr;
}

selfTest();
main().catch(e => { console.error(e.message); process.exit(1); });
