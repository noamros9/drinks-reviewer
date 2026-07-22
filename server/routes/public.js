const express = require('express');
const { CATEGORIES } = require('./drinks');
const { getSettings } = require('../settings');
const { getPublicCatalog, getPublicDrink } = require('../publicFields');

const router = express.Router();

router.get('/api/public/catalog', async (_req, res) => {
  try {
    const { catalogPublic } = await getSettings();
    if (!catalogPublic) return res.status(404).json({ error: 'Catalog is not public' });
    res.json(await getPublicCatalog(CATEGORIES));
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

router.get('/api/public/:category/:id', async (req, res) => {
  try {
    const drink = await getPublicDrink(req.params.category, req.params.id, CATEGORIES);
    if (!drink) return res.status(404).json({ error: 'Not found' });
    res.json(drink);
  } catch {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

module.exports = router;
