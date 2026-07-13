const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const drinksRouter = require('./routes/drinks');
const { router: authRouter, requireAuth } = require('./auth');

const app = express();

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use('/auth', authRouter);
app.use(requireAuth);
app.use('/api', drinksRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
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
