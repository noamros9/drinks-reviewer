// One-time migration: upload the local images referenced by Mongo drink docs to Cloudinary,
// then rewrite imageUrl/collectionImageUrl fields to the new secure_url.
// Run manually, once: node server/scripts/migrate-images-to-cloudinary.js
// Requires MONGODB_URI and CLOUDINARY_URL to already be set in the environment.
const fs = require('fs');
const path = require('path');
const { readData, writeData } = require('../dataStore');
const { uploadImage } = require('../cloudinary');
const { close } = require('../db');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const IMAGES_DIR = path.join(__dirname, '../../client/public/images/drinks');

async function migrate() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  if (!process.env.CLOUDINARY_URL) { console.error('CLOUDINARY_URL is required.'); process.exit(1); }

  const uploaded = new Map(); // old "/images/drinks/..." URL -> new Cloudinary secure_url

  async function migrateUrl(oldUrl) {
    if (!oldUrl || !oldUrl.startsWith('/images/drinks/')) return oldUrl;
    if (uploaded.has(oldUrl)) return uploaded.get(oldUrl);
    const filename = path.basename(oldUrl);
    const filePath = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing local file for ${oldUrl}, skipping`);
      return oldUrl;
    }
    const publicId = `drinks/${path.basename(filename, path.extname(filename))}`;
    const newUrl = await uploadImage(filePath, publicId);
    uploaded.set(oldUrl, newUrl);
    return newUrl;
  }

  for (const category of CATEGORIES) {
    const data = await readData(category);
    let changed = false;
    for (const drink of data) {
      if (drink.collectionImageUrl) {
        const newUrl = await migrateUrl(drink.collectionImageUrl);
        if (newUrl !== drink.collectionImageUrl) { drink.collectionImageUrl = newUrl; changed = true; }
      }
      for (const tasting of drink.tastings || []) {
        if (tasting.imageUrl) {
          const newUrl = await migrateUrl(tasting.imageUrl);
          if (newUrl !== tasting.imageUrl) { tasting.imageUrl = newUrl; changed = true; }
        }
      }
    }
    if (changed) await writeData(category, data);
    console.log(`${category}: done`);
  }
  console.log(`Uploaded ${uploaded.size} unique images.`);
  await close();
}

migrate().catch(err => { console.error(err); process.exit(1); });
