#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '..', '.git', 'hooks');
if (!fs.existsSync(hooksDir)) {
  console.log('install-hooks: no .git/hooks found, skipping.');
  process.exit(0);
}

const hook = `#!/bin/sh
echo "Pre-commit: running coverage checks..."

printf "\\n[1/2] Server (100%% required)\\n"
if node scripts/check-tests-fresh.js server; then
  echo "Server tests already verified since last change — skipping."
else
  npm run test:coverage:server --silent
  if [ $? -ne 0 ]; then
    echo "BLOCKED: server coverage below 100%. Fix before committing."
    exit 1
  fi
fi

printf "\\n[2/2] Client (90%% required)\\n"
if node scripts/check-tests-fresh.js client; then
  echo "Client tests already verified since last change — skipping."
else
  npm run test:coverage --silent
  if [ $? -ne 0 ]; then
    echo "BLOCKED: client coverage below 90%. Fix before committing."
    exit 1
  fi
fi

echo "Coverage OK — proceeding with commit."

printf "\\n[Backup] Snapshotting Atlas + Cloudinary...\\n"
node --env-file-if-exists=.env server/scripts/backup-data.js || echo "Backup skipped/failed (non-blocking)."

node scripts/report-tool-savings.js
exit 0
`;

const dest = path.join(hooksDir, 'pre-commit');
fs.writeFileSync(dest, hook, { mode: 0o755 });
console.log('install-hooks: pre-commit hook installed.');
