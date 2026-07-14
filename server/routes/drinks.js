const express = require('express');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { computeFromTastings } = require('../tastingsHelper');
const { ensureRegionCoordinates, readCoordinates } = require('../geocoding');
const { readData, writeData } = require('../dataStore');
const { searchCategory } = require('../search');
const { getRecommendations, getTasteCard, getGeneratedList } = require('../recommend');
const { uploadImage, deleteImage } = require('../cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

function toDataUri(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

const router = express.Router();
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

const ALLOWED_FIELDS = {
  wine:    ['producer', 'seriesAndName', 'wineCategory', 'variety', 'sweetness', 'country', 'region', 'abv', 'vivinoScore', 'tags', 'collectionTags'],
  beer:    ['brewery', 'name', 'style', 'country', 'abv', 'tags', 'collectionTags'],
  whiskey: ['distillery', 'name', 'country', 'region', 'age', 'style', 'abv', 'tags', 'collectionTags'],
  others:  ['drinkCategory', 'distillery', 'name', 'country', 'style', 'age', 'abv', 'tags', 'collectionTags'],
};

// Fields a shared "bulk edit" action may overwrite across many entries at once
const BULK_EDITABLE_FIELDS = {
  wine:    ['wineCategory', 'sweetness', 'country', 'variety', 'region', 'tags', 'collectionTags'],
  beer:    ['style', 'country', 'tags', 'collectionTags'],
  whiskey: ['style', 'country', 'region', 'tags', 'collectionTags'],
  others:  ['drinkCategory', 'style', 'country', 'tags', 'collectionTags'],
};

// Fields stored as string[] rather than a scalar string
const ARRAY_FIELD_KEYS = new Set(['tags', 'collectionTags', 'variety']);

function pickFields(body, category, partial = false) {
  const allowed = ALLOWED_FIELDS[category];
  return Object.fromEntries(
    allowed
      .filter(k => !partial || k in body)
      .map(k => [k, ARRAY_FIELD_KEYS.has(k) ? (Array.isArray(body[k]) ? body[k] : []) : (body[k] ?? '')])
  );
}

const REGION_CATEGORIES = new Set(Object.keys(ALLOWED_FIELDS).filter(c => ALLOWED_FIELDS[c].includes('region')));

// abv is a free-text field in practice (analytics already tolerates non-numeric values via Number()+NaN filtering),
// so only reject values that parse as a number outside the valid range — don't reject non-numeric text.
function abvError(value) {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  if (n < 0 || n > 100) return 'abv must be between 0 and 100';
  return null;
}

// Best-effort: a geocoding failure must never turn a successful drink save into an error response.
async function maybeGeocodeRegion(category, entry) {
  if (!REGION_CATEGORIES.has(category) || !entry.country || !entry.region) return;
  try {
    await ensureRegionCoordinates(entry.country, entry.region);
  } catch {
    // ensureRegionCoordinates already swallows its own errors; this is defense in depth
  }
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
router.get('/tags', async (_req, res) => {
  try {
    const allTags = new Set();
    for (const cat of CATEGORIES) {
      (await readData(cat)).forEach(d => (d.tags || []).forEach(t => allTags.add(t)));
    }
    res.json([...allTags].sort());
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.get('/region-coordinates', async (_req, res) => {
  try {
    res.json(await readCoordinates());
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.get('/collection', async (req, res) => {
  try {
    const result = [];
    for (const cat of CATEGORIES) {
      const data = await readData(cat);
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

router.post('/recommend', async (req, res) => {
  const { seeds } = req.body;
  if (!Array.isArray(seeds) || seeds.length < 1) {
    return res.status(400).json({ error: 'seeds must be an array of at least 1 {id, category} pair' });
  }
  try {
    res.json(await getRecommendations(seeds));
  } catch (err) {
    res.status(err.status || 500).json({ error: typeof err.status === 'number' ? err.message : 'Data unavailable' });
  }
});

router.post('/taste-card', async (req, res) => {
  const { category } = req.body;
  try {
    res.json(await getTasteCard(category));
  } catch (err) {
    res.status(err.status || 500).json({ error: typeof err.status === 'number' ? err.message : 'Data unavailable' });
  }
});

router.post('/generate-list', async (req, res) => {
  const { prompt } = req.body;
  try {
    res.json(await getGeneratedList(prompt));
  } catch (err) {
    res.status(err.status || 500).json({ error: typeof err.status === 'number' ? err.message : 'Data unavailable' });
  }
});

router.get('/:category', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    res.json((await readData(category)).filter(d => !d.collectionOnly));
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.get('/:category/search', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    res.json(await searchCategory(category, q));
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.post('/:category', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const abvErr = abvError(req.body.abv);
  if (abvErr) return res.status(400).json({ error: abvErr });
  try {
    const entry = await withLock(category, async () => {
      const data = await readData(category);
      const newEntry = { id: randomUUID(), ...pickFields(req.body, category) };
      if (req.body.collectionOnly === true) newEntry.collectionOnly = true;
      data.push(newEntry);
      await writeData(category, data);
      return newEntry;
    });
    await maybeGeocodeRegion(category, entry);
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.put('/:category/:id', async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const abvErr = abvError(req.body.abv);
  if (abvErr) return res.status(400).json({ error: abvErr });
  try {
    const updated = await withLock(category, async () => {
      const data = await readData(category);
      const index = data.findIndex(d => d.id === id);
      if (index === -1) return null;
      data[index] = { ...data[index], ...pickFields(req.body, category, true), id };
      if ('collectionOnly' in req.body) {
        if (req.body.collectionOnly) data[index].collectionOnly = true;
        else delete data[index].collectionOnly;
      }
      await writeData(category, data);
      return data[index];
    });
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    await maybeGeocodeRegion(category, updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.patch('/:category/bulk', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const { ids, field, value, tagAction } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array' });
  if (!BULK_EDITABLE_FIELDS[category]?.includes(field)) return res.status(400).json({ error: 'Field not editable in bulk' });
  const isArrayField = ARRAY_FIELD_KEYS.has(field);
  if (isArrayField) {
    if (tagAction !== 'add' && tagAction !== 'remove') return res.status(400).json({ error: 'tagAction must be "add" or "remove"' });
  } else if (tagAction) {
    return res.status(400).json({ error: 'tagAction only applies to tags' });
  }
  if (typeof value !== 'string' || !value) return res.status(400).json({ error: 'value is required' });
  try {
    const updated = await withLock(category, async () => {
      const data = await readData(category);
      const idSet = new Set(ids);
      const affected = [];
      for (const d of data) {
        if (!idSet.has(d.id)) continue;
        if (isArrayField) {
          const items = new Set(d[field] || []);
          if (tagAction === 'add') items.add(value); else items.delete(value);
          d[field] = [...items];
        } else {
          d[field] = value;
        }
        affected.push(d);
      }
      await writeData(category, data);
      return affected;
    });
    if (field === 'country' || field === 'region') {
      await Promise.all(updated.map(d => maybeGeocodeRegion(category, d)));
    }
    res.json({ updated });
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.delete('/:category/:id', async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const found = await withLock(category, async () => {
      const data = await readData(category);
      const filtered = data.filter(d => d.id !== id);
      if (filtered.length === data.length) return false;
      await writeData(category, filtered);
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
  if (!date || rating == null || isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 10) {
    return res.status(400).json({ error: 'date is required and rating must be between 1 and 10' });
  }
  try {
    const drink = await withLock(category, async () => {
      const data = await readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const tasting = { id: randomUUID(), date, rating: Number(rating) };
      if (vintage) tasting.vintage = vintage;
      const hadPriorTastings = (d.tastings || []).length > 0;
      const prevImageUrl = (d.tastings || []).at(-1)?.imageUrl;
      if (prevImageUrl) tasting.imageUrl = prevImageUrl;
      else if (!hadPriorTastings && d.collectionImageUrl) tasting.imageUrl = d.collectionImageUrl;
      d.tastings = [...(d.tastings || []), tasting];
      Object.assign(d, computeFromTastings(d.tastings, category === 'wine'));
      await writeData(category, data);
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
    const drink = await withLock(category, async () => {
      const data = await readData(category);
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
      await writeData(category, data);
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
  if (!date || rating == null || isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 10) {
    return res.status(400).json({ error: 'date is required and rating must be between 1 and 10' });
  }
  try {
    const drink = await withLock(category, async () => {
      const data = await readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const tasting = (d.tastings || []).find(t => t.id === tastingId);
      if (!tasting) return false;
      tasting.date = date;
      tasting.rating = Number(rating);
      if (category === 'wine') tasting.vintage = vintage || undefined;
      Object.assign(d, computeFromTastings(d.tastings, category === 'wine'));
      await writeData(category, data);
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
  let imageUrl;
  try {
    imageUrl = await uploadImage(toDataUri(req.file), `drinks/${randomUUID()}`);
  } catch {
    return res.status(500).json({ error: 'Image upload failed' });
  }
  try {
    const drink = await withLock(category, async () => {
      const data = await readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      const tasting = (d.tastings || []).find(t => t.id === tastingId);
      if (!tasting) return false;
      if (tasting.imageUrl) {
        const stillShared = d.tastings.some(t => t.id !== tastingId && t.imageUrl === tasting.imageUrl);
        const isCollectionPhoto = tasting.imageUrl === d.collectionImageUrl;
        if (!stillShared && !isCollectionPhoto) await deleteImage(tasting.imageUrl);
      }
      tasting.imageUrl = imageUrl;
      await writeData(category, data);
      return d;
    });
    if (drink === null) { await deleteImage(imageUrl); return res.status(404).json({ error: 'Entry not found' }); }
    if (drink === false) { await deleteImage(imageUrl); return res.status(404).json({ error: 'Tasting not found' }); }
    res.json(drink);
  } catch {
    await deleteImage(imageUrl);
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
    const lot = await withLock(category, async () => {
      const data = await readData(category);
      const drink = data.find(d => d.id === id);
      if (!drink) return null;
      const newLot = { id: randomUUID(), quantity, price, addedAt: new Date().toISOString().slice(0, 10) };
      drink.collection = [...(drink.collection || []), newLot];
      await writeData(category, data);
      return newLot;
    });
    if (!lot) return res.status(404).json({ error: 'Entry not found' });
    res.status(201).json(lot);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.post('/:category/:id/collection/image', upload.single('image'), async (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let imageUrl;
  try {
    imageUrl = await uploadImage(toDataUri(req.file), `drinks/${randomUUID()}`);
  } catch {
    return res.status(500).json({ error: 'Image upload failed' });
  }
  try {
    const drink = await withLock(category, async () => {
      const data = await readData(category);
      const d = data.find(x => x.id === id);
      if (!d) return null;
      if (d.collectionImageUrl) {
        const stillUsedByTasting = (d.tastings || []).some(t => t.imageUrl === d.collectionImageUrl);
        if (!stillUsedByTasting) await deleteImage(d.collectionImageUrl);
      }
      d.collectionImageUrl = imageUrl;
      await writeData(category, data);
      return d;
    });
    if (!drink) { await deleteImage(imageUrl); return res.status(404).json({ error: 'Entry not found' }); }
    res.json(drink);
  } catch {
    await deleteImage(imageUrl);
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.patch('/:category/:id/collection/:lotId', async (req, res) => {
  const { category, id, lotId } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'quantity must be a non-negative integer' });
  try {
    const updated = await withLock(category, async () => {
      const data = await readData(category);
      const drink = data.find(d => d.id === id);
      if (!drink) return null;
      const lot = (drink.collection || []).find(l => l.id === lotId);
      if (!lot) return null;
      lot.quantity = quantity;
      await writeData(category, data);
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
    const found = await withLock(category, async () => {
      const data = await readData(category);
      const drink = data.find(d => d.id === id);
      if (!drink) return false;
      const before = (drink.collection || []).length;
      drink.collection = (drink.collection || []).filter(l => l.id !== lotId);
      if (drink.collection.length === before) return false;
      await writeData(category, data);
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
