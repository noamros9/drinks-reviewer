// Applies regions established from winery/vineyard location via web search (not the LLM
// pass). Each rule below was individually verified and signed off; see REASON strings.
//
//   node --env-file-if-exists=.env server/scripts/apply-verified-regions.js --dry-run
//   node --env-file-if-exists=.env server/scripts/apply-verified-regions.js --i-reviewed-the-dry-run
//
// Requires MONGODB_URI. Back up first, and read the backup output.
const { readData, writeData } = require('../dataStore');
const db = require('../db');
const { ensureRegionCoordinates } = require('../geocoding');

// Rules are matched in order; the first match wins. `from` limits a rule to wines whose
// current region is in that list, so an already-specific wine is never coarsened.
// `to: ''` deliberately clears a region that cannot be supported.
const RULES = [
  { producer: 'דלתון', from: ['', 'Galilee'], to: 'Galilee / Upper Galilee',
    why: 'Kerem Ben Zimra, Dalton Industrial Park, Upper Galilee' },
  { producer: 'הרי גליל', from: ['', 'Galilee'], to: 'Galilee / Upper Galilee',
    why: 'Galil Mountain: six vineyard sites in eastern Upper Galilee' },
  { producer: 'Ben David', from: ['', 'Galilee'], to: 'Galilee / Upper Galilee',
    why: 'Kibbutz Shamir; Dolmen fruit from Upper Galilee plots' },
  { producer: 'כרמל', nameIncludes: 'Admon', from: ['', 'Galilee'], to: 'Galilee / Upper Galilee',
    why: 'Admon single-vineyard fruit via Kayoumi, Upper Galilee' },
  { producer: 'כרמל', nameIncludes: 'Mediterranean', from: ['Samaria'], to: '',
    why: 'multi-region blend; Samaria was unsupportable, clearing it' },
  { producer: 'טפרברג', from: ['', 'Samson'], to: 'Judean Hills',
    why: 'Teperberg winery sits opposite Kibbutz Tzora, Judean Hills' },
  // Tabor draws from BOTH Kfar Tavor (Lower) and Kadita (Upper), so the sub-region is
  // per-bottle. Only fill the blanks, and only at the safe coarse level.
  { producer: 'תבור', from: [''], to: 'Galilee',
    why: 'Tabor spans Lower and Upper Galilee; coarse level is the only safe claim' },
];

function ruleFor(wine) {
  return RULES.find(r =>
    (wine.producer || '') === r.producer &&
    (!r.nameIncludes || (wine.seriesAndName || '').includes(r.nameIncludes)) &&
    r.from.includes(wine.region || '')
  ) ?? null;
}

function selfTest() {
  const assert = require('assert');
  const w = (producer, seriesAndName, region) => ({ producer, seriesAndName, region });
  assert.strictEqual(ruleFor(w('דלתון', 'Alma', 'Galilee')).to, 'Galilee / Upper Galilee');
  // already specific -> untouched
  assert.strictEqual(ruleFor(w('דלתון', 'Alma', 'Galilee / Upper Galilee')), null);
  // Carmel is only matched for the two named wines, never wholesale
  assert.strictEqual(ruleFor(w('כרמל', 'Excellence', '')), null);
  assert.strictEqual(ruleFor(w('כרמל', 'Single Vineyard - Admon', '')).to, 'Galilee / Upper Galilee');
  assert.strictEqual(ruleFor(w('כרמל', 'Mediterranean 4 Vats', 'Samaria')).to, '');
  // Teperberg: fills blanks and corrects the wrong Samson row
  assert.strictEqual(ruleFor(w('טפרברג', 'Inspire', 'Samson')).to, 'Judean Hills');
  assert.strictEqual(ruleFor(w('טפרברג', 'Inspire', 'Judean Hills')), null);
  // Tabor: blanks only, never the ones already at Galilee
  assert.strictEqual(ruleFor(w('תבור', 'אדמה', '')).to, 'Galilee');
  assert.strictEqual(ruleFor(w('תבור', 'Eco', 'Galilee')), null);
}

async function run({ write }) {
  const wines = await readData('wine');
  const hits = [];
  for (const wine of wines) {
    const rule = ruleFor(wine);
    if (rule) hits.push({ wine, rule });
  }

  console.log(`\n=== WILL BE WRITTEN (${hits.length}) ===`);
  for (const { wine, rule } of hits) {
    const label = `${wine.producer} ${wine.seriesAndName || ''}`.trim();
    console.log(`  ${label.slice(0, 34).padEnd(36)} ${JSON.stringify(wine.region || '')} -> ${JSON.stringify(rule.to)}`);
  }
  console.log('\n=== WHY ===');
  [...new Set(hits.map(h => h.rule))].forEach(r =>
    console.log(`  ${r.producer}${r.nameIncludes ? ' / ' + r.nameIncludes : ''}: ${r.why}`));

  if (!write) { console.log('\nNo changes written.\n'); return; }

  hits.forEach(({ wine, rule }) => { wine.region = rule.to; });
  await writeData('wine', wines);
  console.log(`\nwine: ${hits.length} regions updated`);

  let geocoded = 0;
  for (const { wine, rule } of hits) {
    if (!rule.to) continue;
    try { await ensureRegionCoordinates(wine.country, rule.to); geocoded++; } catch { /* best effort */ }
  }
  console.log(`geocoding attempted for ${geocoded} entries`);
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  const write = process.argv.includes('--i-reviewed-the-dry-run');
  if (!write && !process.argv.includes('--dry-run')) {
    console.error('Pass --dry-run, or --i-reviewed-the-dry-run to write.');
    process.exit(1);
  }
  await run({ write });
  await db.close();
}

selfTest();
main().catch(e => { console.error(e.message); process.exit(1); });
