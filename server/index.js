const express = require('express');
const cors = require('cors');
const drinksRouter = require('./routes/drinks');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', drinksRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
