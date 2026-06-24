const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const router = express.Router();
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

function dataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '../data/data_test');
}

function readData(category) {
  return JSON.parse(fs.readFileSync(path.join(dataDir(), `${category}.json`), 'utf8'));
}

function writeData(category, data) {
  fs.writeFileSync(path.join(dataDir(), `${category}.json`), JSON.stringify(data, null, 2));
}

router.get('/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  res.json(readData(category));
});

router.post('/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const data = readData(category);
  const entry = { id: randomUUID(), ...req.body };
  data.push(entry);
  writeData(category, data);
  res.status(201).json(entry);
});

router.put('/:category/:id', (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const data = readData(category);
  const index = data.findIndex(d => d.id === id);
  if (index === -1) return res.status(404).json({ error: 'Entry not found' });
  data[index] = { ...data[index], ...req.body, id };
  writeData(category, data);
  res.json(data[index]);
});

router.delete('/:category/:id', (req, res) => {
  const { category, id } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'Unknown category' });
  const data = readData(category);
  const filtered = data.filter(d => d.id !== id);
  if (filtered.length === data.length) return res.status(404).json({ error: 'Entry not found' });
  writeData(category, filtered);
  res.status(204).end();
});

module.exports = router;
