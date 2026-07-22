const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const drinksRouter = require('./routes/drinks');
const publicRouter = require('./routes/public');
const { router: authRouter, requireAuth } = require('./auth');
const { getPublicDrink, buildShareHtml } = require('./publicFields');

const app = express();
const clientDist = path.join(__dirname, '..', 'client', 'dist');

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use('/auth', authRouter);
app.use(publicRouter);

if (process.env.NODE_ENV === 'production') {
  // Pre-auth: the SPA shell (bundle + these two shells) must be reachable without a session
  // so /catalog and /share/:category/:id can render for anonymous visitors.
  app.use('/assets', express.static(path.join(clientDist, 'assets')));
  app.get('/catalog', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  app.get('/share/:category/:id', async (req, res) => {
    const template = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
    const drink = await getPublicDrink(req.params.category, req.params.id, drinksRouter.CATEGORIES);
    res.type('html').send(buildShareHtml(template, drink));
  });
}

app.use(requireAuth);
app.use('/api', drinksRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
