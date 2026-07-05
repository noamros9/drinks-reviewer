#!/usr/bin/env node
// Exit 0 ("fresh" — safe to skip re-running that suite) only if a marker from a prior successful
// run exists AND no watched file has changed since. Exit 1 ("stale") otherwise, including when the
// marker is missing (first run) — the caller then runs the real suite, which re-marks on success.
//
// ponytail: mtime-based, not content-hashed — a pure file *deletion* between "tests passed" and
// "commit" won't bump any mtime, so it slips through undetected. Narrow gap for the real use case
// (run coverage, commit right after with no further edits); not worth git-diffing for `D` entries.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const WATCH = {
  server: {
    marker: '.test-passed-server',
    dirs: ['server'],
    exclude: [path.join(ROOT, 'server', 'data')],
    files: ['package.json', 'package-lock.json', 'jest.config.js'],
  },
  client: {
    marker: '.test-passed-client',
    dirs: [path.join('client', 'src')],
    exclude: [],
    files: ['package.json', 'package-lock.json', 'vite.config.js'],
  },
};

const domain = process.argv[2];
const config = WATCH[domain];
if (!config) {
  console.error('check-tests-fresh: expected "server" or "client" as an argument.');
  process.exit(1);
}

const markerPath = path.join(ROOT, '.git', config.marker);
let markerTime;
try {
  markerTime = fs.statSync(markerPath).mtimeMs;
} catch {
  process.exit(1); // no marker yet — stale
}

function isExcluded(p) {
  return config.exclude.some(ex => p === ex || p.startsWith(ex + path.sep));
}

function hasNewerFile(dir) {
  if (isExcluded(dir)) return false;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false; // dir doesn't exist — nothing to compare
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'coverage') continue;
    const full = path.join(dir, entry.name);
    if (isExcluded(full)) continue;
    if (entry.isDirectory()) {
      if (hasNewerFile(full)) return true;
    } else if (fs.statSync(full).mtimeMs > markerTime) {
      return true;
    }
  }
  return false;
}

const targets = [
  ...config.dirs.map(d => path.join(ROOT, d)),
  ...config.files.map(f => path.join(ROOT, f)),
];

const stale = targets.some(t => {
  try {
    return fs.statSync(t).isDirectory() ? hasNewerFile(t) : fs.statSync(t).mtimeMs > markerTime;
  } catch {
    return false; // target doesn't exist — nothing to compare
  }
});

process.exit(stale ? 1 : 0);
