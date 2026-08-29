// One-off cleanup for issue #110. Until the fix in client/src/pages/AdminPage.jsx, every
// "add to collection" minted a fresh `collectionOnly` drink, so adding a bottle you had
// already reviewed produced a hidden twin. This folds each twin's lots back onto the real
// drink and deletes it, plus removes collection-only drinks left with nothing at all.
//
//   node --env-file-if-exists=.env server/scripts/merge-collection-duplicates.js --dry-run
//   node --env-file-if-exists=.env server/scripts/merge-collection-duplicates.js --i-reviewed-the-dry-run
//
// Requires MONGODB_URI. Back up first (node server/scripts/backup-data.js), and read the
// backup output.
const { readData, writeData } = require('../dataStore');
const db = require('../db');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

// Producer and name live under different keys per category; recommend.js:21 already treats
// them interchangeably this way, so there's no per-category map to keep in sync.
const identity = d =>
  `${(d.producer || d.brewery || d.distillery || '').trim().toLowerCase()}||` +
  `${(d.seriesAndName || d.name || '').trim().toLowerCase()}`;

const lots = d => d.collection || [];
const tastings = d => d.tastings || [];

// Splits a category's drinks into the shadows to fold away and the leftovers to delete.
// Pure, so selfTest() can exercise it without a database.
function planCleanup(drinks) {
  const real = new Map();
  for (const d of drinks) {
    if (d.collectionOnly) continue;
    const key = identity(d);
    if (!real.has(key)) real.set(key, d);
  }

  const merges = [];
  const orphans = [];
  for (const d of drinks) {
    if (!d.collectionOnly) continue;
    const target = real.get(identity(d));
    if (target) merges.push({ shadow: d, target });
    else if (!lots(d).length && !tastings(d).length) orphans.push(d);
  }
  return { merges, orphans };
}

function apply(drinks, { merges, orphans }) {
  for (const { shadow, target } of merges) {
    target.collection = [...lots(target), ...lots(shadow)];
    // Only fill a gap — never clobber a photo the real drink already has.
    if (!target.collectionImageUrl && shadow.collectionImageUrl) {
      target.collectionImageUrl = shadow.collectionImageUrl;
    }
  }
  const drop = new Set([...merges.map(m => m.shadow.id), ...orphans.map(o => o.id)]);
  return drinks.filter(d => !drop.has(d.id));
}

function selfTest() {
  const assert = require('assert');
  const real = { id: 'r', brewery: 'נגב', name: 'פורטר אלון', tastings: [{ id: 't' }], collection: [{ id: 'l1' }] };
  const shadow = { id: 's', brewery: 'נגב', name: 'פורטר אלון', collectionOnly: true, collection: [{ id: 'l2' }], collectionImageUrl: 'img' };
  const zombie = { id: 'z', brewery: 'נגב', name: 'פורטר אלון', collectionOnly: true, collection: [] };
  const lone = { id: 'x', brewery: 'Solo', name: 'Only', collectionOnly: true, collection: [{ id: 'l3' }] };
  const empty = { id: 'e', brewery: 'Gone', name: 'Drunk', collectionOnly: true, collection: [] };

  const plan = planCleanup([real, shadow, zombie, lone, empty]);
  assert.deepStrictEqual(plan.merges.map(m => m.shadow.id), ['s', 'z']);
  assert.deepStrictEqual(plan.orphans.map(o => o.id), ['e']);

  const out = apply([real, shadow, zombie, lone, empty], plan);
  assert.deepStrictEqual(out.map(d => d.id), ['r', 'x']);
  assert.deepStrictEqual(real.collection.map(l => l.id), ['l1', 'l2']);
  assert.strictEqual(real.collectionImageUrl, 'img');

  // A collection-only drink with lots but no real twin is legitimate — never touched.
  assert.deepStrictEqual(planCleanup([lone]), { merges: [], orphans: [] });
  // Matching is case- and whitespace-insensitive.
  assert.strictEqual(planCleanup([
    { id: 'a', producer: 'Yatir', seriesAndName: 'Darom' },
    { id: 'b', producer: '  yatir ', seriesAndName: 'DAROM', collectionOnly: true },
  ]).merges.length, 1);
  // An existing photo is never overwritten.
  const withPhoto = { id: 'p', producer: 'P', seriesAndName: 'N', collectionImageUrl: 'keep' };
  apply([withPhoto], planCleanup([withPhoto, { id: 'q', producer: 'P', seriesAndName: 'N', collectionOnly: true, collectionImageUrl: 'new' }]));
  assert.strictEqual(withPhoto.collectionImageUrl, 'keep');
}

const label = d => `${(d.producer || d.brewery || d.distillery || '').trim()} ${(d.seriesAndName || d.name || '').trim()}`.trim();

async function run({ write }) {
  let totalMerges = 0;
  let totalOrphans = 0;

  for (const category of CATEGORIES) {
    const drinks = await readData(category);
    const plan = planCleanup(drinks);
    if (!plan.merges.length && !plan.orphans.length) continue;

    console.log(`\n=== ${category} ===`);
    for (const { shadow, target } of plan.merges) {
      const moving = lots(shadow).length;
      console.log(`  MERGE  ${label(shadow).slice(0, 30).padEnd(32)} ${shadow.id.slice(0, 8)} -> ${target.id.slice(0, 8)}  (${moving} lot${moving === 1 ? '' : 's'}${!target.collectionImageUrl && shadow.collectionImageUrl ? ', + photo' : ''})`);
    }
    for (const d of plan.orphans) {
      console.log(`  DELETE ${label(d).slice(0, 30).padEnd(32)} ${d.id.slice(0, 8)}  (no lots, no tastings)`);
    }
    totalMerges += plan.merges.length;
    totalOrphans += plan.orphans.length;

    if (write) {
      await writeData(category, apply(drinks, plan));
      console.log(`  written: ${drinks.length} -> ${drinks.length - plan.merges.length - plan.orphans.length} drinks`);
    }
  }

  console.log(`\n${totalMerges} merged, ${totalOrphans} deleted.`);
  if (!write) console.log('No changes written.\n');
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
