const fs = require('fs');
const path = require('path');

const DATA_DIR_PATH = process.env.DATA_DIR || path.join(__dirname, 'data');

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

module.exports = { readData, writeData, DATA_DIR_PATH };
