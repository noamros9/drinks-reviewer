const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const IMAGES_DIR = path.join(__dirname, '../../client/public/images/drinks');
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

const imageFiles = fs.readdirSync(IMAGES_DIR);
// map drinkId -> filename (e.g. "abc123.jpg")
const imageMap = {};
imageFiles.forEach(f => {
  const id = path.basename(f, path.extname(f));
  imageMap[id] = f;
});

let total = 0;
CATEGORIES.forEach(cat => {
  const filePath = path.join(DATA_DIR, `${cat}.json`);
  const drinks = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  drinks.forEach(drink => {
    const filename = imageMap[drink.id];
    if (!filename || !(drink.tastings || []).length) return;
    const imageUrl = `/images/drinks/${filename}`;
    drink.tastings.forEach(t => {
      if (!t.imageUrl) { t.imageUrl = imageUrl; total++; }
    });
  });
  fs.writeFileSync(filePath, JSON.stringify(drinks, null, 2));
  console.log(`${cat}: done`);
});
console.log(`Synced ${total} tastings with images.`);
