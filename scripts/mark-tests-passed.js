#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const domain = process.argv[2]; // 'server' or 'client'
if (domain !== 'server' && domain !== 'client') {
  console.error('mark-tests-passed: expected "server" or "client" as an argument.');
  process.exit(1);
}

const gitDir = path.join(__dirname, '..', '.git');
if (!fs.existsSync(gitDir)) process.exit(0); // no repo (e.g. extracted tarball) — nothing to mark

const marker = path.join(gitDir, `.test-passed-${domain}`);
fs.writeFileSync(marker, new Date().toISOString());
