const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { computeFromTastings } = require('../tastingsHelper');

const IMAGES_DIR_PATH = process.env.IMAGES_DIR || path.join(__dirname, '../../client/public/images/drinks');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { fs.mkdirSync(IMAGES_DIR_PATH, { recursive: true }); cb(null, IMAGES_DIR_PATH); },
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const router = express.Router();
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

const ALLOWED_FIELDS = {
  wine:    ['producer', 'seriesAndName', 'wineCategory', 'variety', 'sweetness', 'country', 'region', 'abv', 'vivinoScore', 'tags'],
  beer:    ['brewery', 'name', 'style', 'country', 'abv', 'tags'],
  whiskey: ['distillery', 'name', 'country', 'region', 'age', 'style', 'abv', 'tags'],
  others:  ['drinkCategory', 'distillery', 'name', 'country', 'style', 'age', 'abv', 'tags'],
};

const DATA_DIR_PATH = process.env.DATA_DIR || path.join(__dirname, '../data');

function readData(category) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR_PATH, `${category}.json`), 'utf8'));
  } catch {
    throw new Error(`Failed to read data for category: ${category}`);
  }
}

function writeData(category, data) {
  fs.writeFileSync(path.join(DATA_DIR_PATH, `${category}.json`), JSON.stringify(data, null, 2));
}

function pickFields(body, category, partial = false) {
  const allowed = ALLOWED_FIELDS[category];
  return Object.fromEntries(
    allowed
      .filter(k => !partial || k in body)
      .map(k => [k, k === 'tags' ? (Array.isArray(body[k]) ? body[k] : []) : (body[k] ?? '')])
  );
}

// Per-category write locks to prevent concurrent read-modify-write races
const writeLocks = {};
async function withLock(category, fn) {
  while (writeLocks[category]) await writeLocks[category];
  let resolve;
  writeLocks[category] = new Promise(r => { resolve = r; });
  try { return await fn(); } finally { delete writeLocks[category]; resolve(); }
}

// Must be before /:category to avoid "tags"/"collection" being treated as category names
router.get('/tags', (_req, res) => {
  try {
    const allTags = new Set();
    for (const cat of CATEGORIES) {
      readData(cat).forEach(d => (d.tags || []).forEach(t => allTags.add(t)));
    }
    res.json([...allTags].sort());
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.get('/collection', (req, res) => {
  try {
    const result = [];
    for (const cat of CATEGORIES) {
      const data = readData(cat);
      for (const drink of data) {
        if ((drink.collection || []).some(l => l.quantity > 0)) {
          result.push({ ...drink, _category: cat });
        }
      }
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.get('/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    res.json(readData(category).filter(d => !d.collectionOnly));
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
      if (req.body.collectionOnly === true) newEntry.collectionOnly = true;
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
      data[index] = { ...data[index], ...pickFields(req.body, category, true), id };
      if ('collectionOnly' in req.body) {
        if (req.body.collectionOnly) data[index].collectionOnly = true;
        else delete data[index].collectionOnly;
      }
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

router.post('/:category/:id/tastings', async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const { date, rating, vintage } = req.body;
  if (!date || rating == null || isNaN(Number(rating))) return res.status(400).json({ error: 'date and rating are required' });
  try {
    const drink = await withLock(category, () => {
      const data = readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const tasting = { id: randomUUID(), date, rating: Number(rating) };
      if (vintage) tasting.vintage = vintage;
      d.tastings = [...(d.tastings || []), tasting];
      Object.assign(d, computeFromTastings(d.tastings, category === 'wine'));
      writeData(category, data);
      return d;
    });
    if (!drink) return res.status(404).json({ error: 'Entry not found' });
    res.status(201).json(drink);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.delete('/:category/:id/tastings/:tastingId', async (req, res) => {
  const { category, id, tastingId } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const drink = await withLock(category, () => {
      const data = readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const before = (d.tastings || []).length;
      d.tastings = (d.tastings || []).filter(t => t.id !== tastingId);
      if (d.tastings.length === before) return false;
      if (d.tastings.length === 0) {
        for (const k of ['avgRating', 'lastRating', 'lastTasted', 'tastingCount', 'vintage']) delete d[k];
      } else {
        Object.assign(d, computeFromTastings(d.tastings, category === 'wine'));
      }
      writeData(category, data);
      return d;
    });
    if (drink === null) return res.status(404).json({ error: 'Entry not found' });
    if (drink === false) return res.status(404).json({ error: 'Tasting not found' });
    res.json(drink);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.put('/:category/:id/tastings/:tastingId', async (req, res) => {
  const { category, id, tastingId } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const { date, rating, vintage } = req.body;
  if (!date || rating == null || isNaN(Number(rating))) return res.status(400).json({ error: 'date and rating are required' });
  try {
    const drink = await withLock(category, () => {
      const data = readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const tasting = (d.tastings || []).find(t => t.id === tastingId);
      if (!tasting) return false;
      tasting.date = date;
      tasting.rating = Number(rating);
      if (category === 'wine') tasting.vintage = vintage || undefined;
      Object.assign(d, computeFromTastings(d.tastings, category === 'wine'));
      writeData(category, data);
      return d;
    });
    if (drink === null) return res.status(404).json({ error: 'Entry not found' });
    if (drink === false) return res.status(404).json({ error: 'Tasting not found' });
    res.json(drink);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.post('/:category/:id/tastings/:tastingId/image', upload.single('image'), async (req, res) => {
  const { category, id, tastingId } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const cleanupUpload = () => { try { fs.unlinkSync(req.file.path); } catch {} };
  try {
    const drink = await withLock(category, () => {
      const data = readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const tasting = (d.tastings || []).find(t => t.id === tastingId);
      if (!tasting) return false;
      if (tasting.imageUrl) {
        try { fs.unlinkSync(path.join(IMAGES_DIR_PATH, path.basename(tasting.imageUrl))); } catch {}
      }
      tasting.imageUrl = `/images/drinks/${req.file.filename}`;
      writeData(category, data);
      return d;
    });
    if (drink === null) { cleanupUpload(); return res.status(404).json({ error: 'Entry not found' }); }
    if (drink === false) { cleanupUpload(); return res.status(404).json({ error: 'Tasting not found' }); }
    res.json(drink);
  } catch {
    cleanupUpload();
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.post('/:category/:id/collection', async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'quantity must be a positive integer' });
  const price = req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : null;
  try {
    const lot = await withLock(category, () => {
      const data = readData(category);
      const drink = data.find(d => d.id === id);
      if (!drink) return null;
      const newLot = { id: randomUUID(), quantity, price, addedAt: new Date().toISOString().slice(0, 10) };
      drink.collection = [...(drink.collection || []), newLot];
      writeData(category, data);
      return newLot;
    });
    if (!lot) return res.status(404).json({ error: 'Entry not found' });
    res.status(201).json(lot);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.patch('/:category/:id/collection/:lotId', async (req, res) => {
  const { category, id, lotId } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'quantity must be a non-negative integer' });
  try {
    const updated = await withLock(category, () => {
      const data = readData(category);
      const drink = data.find(d => d.id === id);
      if (!drink) return null;
      const lot = (drink.collection || []).find(l => l.id === lotId);
      if (!lot) return null;
      lot.quantity = quantity;
      writeData(category, data);
      return lot;
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.delete('/:category/:id/collection/:lotId', async (req, res) => {
  const { category, id, lotId } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const found = await withLock(category, () => {
      const data = readData(category);
      const drink = data.find(d => d.id === id);
      if (!drink) return false;
      const before = (drink.collection || []).length;
      drink.collection = (drink.collection || []).filter(l => l.id !== lotId);
      if (drink.collection.length === before) return false;
      writeData(category, data);
      return true;
    });
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router._withLock = withLock; // exported for concurrency unit tests only
module.exports = router;
