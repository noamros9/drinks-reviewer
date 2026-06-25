const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const router = express.Router();
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

const ALLOWED_FIELDS = {
  wine:    ['producer', 'seriesAndName', 'wineCategory', 'variety', 'country', 'region', 'abv', 'lastTasted', 'lastRanking', 'avgRanking', 'notionLink'],
  beer:    ['brewery', 'name', 'style', 'country', 'abv', 'lastTasted', 'lastRanking', 'avgRanking', 'notionLink'],
  whiskey: ['distillery', 'name', 'country', 'region', 'age', 'style', 'abv', 'lastTasted', 'lastRanking', 'avgRanking', 'notionLink'],
  others:  ['drinkCategory', 'distillery', 'name', 'country', 'style', 'age', 'abv', 'lastTasted', 'lastRanking', 'avgRanking', 'notionLink'],
};

function dataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '../data');
}

function readData(category) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir(), `${category}.json`), 'utf8'));
  } catch {
    throw new Error(`Failed to read data for category: ${category}`);
  }
}

function writeData(category, data) {
  fs.writeFileSync(path.join(dataDir(), `${category}.json`), JSON.stringify(data, null, 2));
}

function pickFields(body, category) {
  const allowed = ALLOWED_FIELDS[category] || [];
  return Object.fromEntries(allowed.map(k => [k, body[k] ?? '']));
}

// Per-category write locks to prevent concurrent read-modify-write races
const writeLocks = {};
async function withLock(category, fn) {
  while (writeLocks[category]) await writeLocks[category];
  let resolve;
  writeLocks[category] = new Promise(r => { resolve = r; });
  try { return await fn(); } finally { delete writeLocks[category]; resolve(); }
}

router.get('/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    res.json(readData(category));
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.post('/:category', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const entry = await withLock(category, () => {
      const data = readData(category);
      const newEntry = { id: randomUUID(), ...pickFields(req.body, category) };
      data.push(newEntry);
      writeData(category, data);
      return newEntry;
    });
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.put('/:category/:id', async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const updated = await withLock(category, () => {
      const data = readData(category);
      const index = data.findIndex(d => d.id === id);
      if (index === -1) return null;
      data[index] = { ...data[index], ...pickFields(req.body, category), id };
      writeData(category, data);
      return data[index];
    });
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.delete('/:category/:id', async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const found = await withLock(category, () => {
      const data = readData(category);
      const filtered = data.filter(d => d.id !== id);
      if (filtered.length === data.length) return false;
      writeData(category, filtered);
      return true;
    });
    if (!found) return res.status(404).json({ error: 'Entry not found' });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

module.exports = router;
