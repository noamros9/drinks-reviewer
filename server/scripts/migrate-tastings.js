const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { normalizeDate, computeFromTastings } = require('../tastingsHelper');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const dataDir = path.join(__dirname, '../data');
const imgDir = path.join(__dirname, '../../client/public/images/drinks');

function readData(cat) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${cat}.json`), 'utf8'));
}
function writeData(cat, data) {
  fs.writeFileSync(path.join(dataDir, `${cat}.json`), JSON.stringify(data, null, 2));
}

function extractPageId(url) {
  const match = url?.match(/([a-f0-9]{32})(?:\?|$)/i);
  if (!match) return null;
  const h = match[1];
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

async function downloadImage(url, drinkId) {
  try {
    const ext = (new URL(url).pathname.match(/\.(png|jpe?g|gif|webp)$/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const dest = path.join(imgDir, `${drinkId}.${ext}`);
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buf));
    return `/images/drinks/${drinkId}.${ext}`;
  } catch {
    return null;
  }
}

async function fetchPageData(client, pageId, isWine) {
  const blocks = await client.blocks.children.list({ block_id: pageId });

  // Extract first image block URL
  const imgBlock = blocks.results.find(b => b.type === 'image');
  const imgUrl = imgBlock?.image?.file?.url || imgBlock?.image?.external?.url || null;

  const table = blocks.results.find(b => b.type === 'table');
  if (!table) return { tastings: null, imgUrl };

  const rows = await client.blocks.children.list({ block_id: table.id });
  const tableRows = rows.results.filter(b => b.type === 'table_row');
  if (tableRows.length < 2) return { tastings: [], imgUrl };

  const headers = tableRows[0].table_row.cells.map(c => (c[0]?.plain_text || '').toLowerCase());
  const dateIdx    = headers.findIndex(h => h.includes('date'));
  const ratingIdx  = headers.findIndex(h => (h.includes('rank') || h.includes('rating')) && !h.includes('avg') && !h.includes('agg'));
  const vintageIdx = isWine ? headers.findIndex(h => h.includes('vintage')) : -1;
  if (dateIdx < 0 || ratingIdx < 0) return { tastings: [], imgUrl };

  const tastings = tableRows.slice(1).flatMap(row => {
    const cells = row.table_row.cells;
    const rawDate = cells[dateIdx]?.[0]?.plain_text || '';
    const rating  = parseFloat(cells[ratingIdx]?.[0]?.plain_text || '');
    if (!rawDate || isNaN(rating)) return [];
    const date = normalizeDate(rawDate);
    if (!date) return [];
    const entry = { id: randomUUID(), date, rating };
    if (isWine && vintageIdx >= 0) {
      const v = (cells[vintageIdx]?.[0]?.plain_text || '').trim();
      if (v && !/^n\/a/i.test(v) && !/^unknown/i.test(v)) entry.vintage = v.replace(/\s*\(.*\)/, '').trim();
    }
    return [entry];
  });

  return { tastings, imgUrl };
}

function syntheticTasting(drink) {
  if (drink.lastRanking != null && drink.lastTasted) {
    return [{ id: randomUUID(), date: drink.lastTasted, rating: drink.lastRanking }];
  }
  return null;
}

async function main() {
  const client = new Client({ auth: process.env.NOTION_API_KEY });
  const problems = [];

  for (const category of CATEGORIES) {
    const drinks = readData(category);
    const isWine = category === 'wine';
    let synced = 0, synthetic = 0, images = 0;

    for (const drink of drinks) {
      if (!drink.notionLink) {
        const t = syntheticTasting(drink);
        if (t) { drink.tastings = t; Object.assign(drink, computeFromTastings(t, isWine)); synthetic++; }
        else problems.push({ category, name: drink.producer || drink.brewery || drink.distillery, reason: 'no notionLink and no fallback data' });
        continue;
      }

      const pageId = extractPageId(drink.notionLink);
      if (!pageId) {
        const t = syntheticTasting(drink);
        if (t) { drink.tastings = t; Object.assign(drink, computeFromTastings(t, isWine)); synthetic++; }
        problems.push({ category, name: drink.seriesAndName || drink.name, reason: 'could not extract page ID from ' + drink.notionLink });
        continue;
      }

      try {
        const { tastings, imgUrl } = await fetchPageData(client, pageId, isWine);

        // Download image if present and not already saved
        const imgAlreadyExists = drink.imagePath && fs.existsSync(path.join(__dirname, '../../client/public', drink.imagePath));
        if (imgUrl && !imgAlreadyExists) {
          const localPath = await downloadImage(imgUrl, drink.id);
          if (localPath) { drink.imagePath = localPath; images++; }
        }

        if (tastings === null) {
          problems.push({ category, name: drink.seriesAndName || drink.name, reason: 'no table found on page' });
          const t = syntheticTasting(drink);
          if (t) { drink.tastings = t; Object.assign(drink, computeFromTastings(t, isWine)); synthetic++; }
        } else if (tastings.length === 0) {
          problems.push({ category, name: drink.seriesAndName || drink.name, reason: 'table found but no parseable rows' });
          const t = syntheticTasting(drink);
          if (t) { drink.tastings = t; Object.assign(drink, computeFromTastings(t, isWine)); synthetic++; }
        } else {
          drink.tastings = tastings;
          Object.assign(drink, computeFromTastings(tastings, isWine));
          synced++;
        }
      } catch (e) {
        problems.push({ category, name: drink.seriesAndName || drink.name, reason: e.message });
        const t = syntheticTasting(drink);
        if (t) { drink.tastings = t; Object.assign(drink, computeFromTastings(t, isWine)); synthetic++; }
      }
    }

    writeData(category, drinks);
    console.log(`${category}: ${synced} from Notion, ${synthetic} synthetic, ${images} images`);
  }

  if (problems.length) {
    console.log('\nProblems:');
    problems.forEach(p => console.log(`  [${p.category}] ${p.name}: ${p.reason}`));
  } else {
    console.log('\nNo problems.');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
