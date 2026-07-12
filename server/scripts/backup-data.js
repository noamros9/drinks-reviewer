// Best-effort snapshot of Atlas + Cloudinary into a sibling private repo, run from the pre-commit
// hook. Never blocks a commit: any missing prerequisite or failure just logs a warning and exits 0.
// Run manually: node server/scripts/backup-data.js
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const BACKUP_DIR = path.join(__dirname, '../../../drinks-reviewer-backup');

function run(cmd, args, cwd) {
  const { spawnSync } = require('child_process');
  return spawnSync(cmd, args, { cwd, encoding: 'utf8' });
}

async function backup() {
  if (!process.env.MONGODB_URI) {
    console.warn('backup-data: MONGODB_URI not set, skipping backup.');
    return;
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    console.warn(`backup-data: backup repo not found at ${BACKUP_DIR}, skipping backup.`);
    return;
  }

  const { readData } = require('../dataStore');
  const { close } = require('../db');

  const atlasDir = path.join(BACKUP_DIR, 'atlas');
  fs.mkdirSync(atlasDir, { recursive: true });
  for (const category of CATEGORIES) {
    const data = await readData(category);
    fs.writeFileSync(path.join(atlasDir, `${category}.json`), JSON.stringify(data, null, 2));
  }
  await close();

  if (process.env.CLOUDINARY_URL) {
    const cloudinary = require('cloudinary').v2;
    const resources = [];
    let next_cursor;
    do {
      const page = await cloudinary.api.resources({ type: 'upload', prefix: 'drinks/', max_results: 500, next_cursor });
      resources.push(...page.resources);
      next_cursor = page.next_cursor;
    } while (next_cursor);
    const assets = resources.map(r => ({
      public_id: r.public_id,
      secure_url: r.secure_url,
      bytes: r.bytes,
      created_at: r.created_at,
    }));
    const cloudinaryDir = path.join(BACKUP_DIR, 'cloudinary');
    fs.mkdirSync(cloudinaryDir, { recursive: true });
    fs.writeFileSync(path.join(cloudinaryDir, 'assets.json'), JSON.stringify(assets, null, 2));
  } else {
    console.warn('backup-data: CLOUDINARY_URL not set, skipping Cloudinary asset snapshot.');
  }

  run('git', ['add', '-A'], BACKUP_DIR);
  const diff = run('git', ['diff', '--cached', '--quiet'], BACKUP_DIR);
  if (diff.status === 0) {
    console.log('backup-data: no changes since last backup, skipping commit.');
    return;
  }
  const commit = run('git', ['commit', '-m', `backup: ${new Date().toISOString()}`], BACKUP_DIR);
  if (commit.status !== 0) {
    console.warn('backup-data: commit failed:', commit.stderr);
    return;
  }
  const push = run('git', ['push'], BACKUP_DIR);
  if (push.status !== 0) {
    console.warn('backup-data: commit succeeded but push failed:', push.stderr);
    return;
  }
  console.log('backup-data: backup committed and pushed.');
}

backup().catch(err => console.warn('backup-data: failed (non-blocking):', err.message));
