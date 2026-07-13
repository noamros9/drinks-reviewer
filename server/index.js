const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const drinksRouter = require('./routes/drinks');
const { router: authRouter, requireAuth } = require('./auth');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use('/auth', authRouter);
app.use(requireAuth);
app.use('/api', drinksRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
