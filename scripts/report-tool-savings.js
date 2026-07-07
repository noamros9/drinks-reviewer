#!/usr/bin/env node
// ponytail: temporary instrumentation, user will say when to remove it — delete this file,
// the invocation line in install-hooks.js, and the .tool-savings-log.json gitignore entry.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_PATH = path.join(ROOT, '.tool-savings-log.json');

function countPonytailShortcuts() {
  let diff;
  try {
    diff = execSync('git diff --cached -U0', { cwd: ROOT }).toString();
  } catch {
    return 0;
  }
  return diff
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++') && line.includes('ponytail:'))
    .length;
}

function findHeadroomExe() {
  try {
    const pyDir = execSync('python -c "import sys,os;print(os.path.dirname(sys.executable))"').toString().trim();
    const exe = path.join(pyDir, 'Scripts', process.platform === 'win32' ? 'headroom.exe' : 'headroom');
    if (fs.existsSync(exe)) return exe;
  } catch {
    // fall through to PATH lookup
  }
  return 'headroom';
}

function getHeadroomSavingsPercent() {
  try {
    const out = execSync(`"${findHeadroomExe()}" savings --json`).toString();
    return JSON.parse(out).windows.today.savings_percent;
  } catch {
    return null;
  }
}

function report(session, shortcuts, headroomPct) {
  const headroomLine =
    headroomPct === null ? 'Headroom: no data' : `Headroom: ${headroomPct.toFixed(1)}% saved today`;
  const ponytailLine =
    shortcuts > 0
      ? `Ponytail: ${shortcuts} shortcut${shortcuts === 1 ? '' : 's'} flagged (~23-53% cost / 6-20% LOC vs. unguided — benchmark estimate)`
      : 'Ponytail: 0 shortcuts flagged this commit';

  console.log(headroomLine);
  console.log(ponytailLine);

  const entry = {
    session,
    timestamp: new Date().toISOString(),
    headroomSavingsPercent: headroomPct,
    ponytailShortcuts: shortcuts,
    ponytailEstimateCostPct: shortcuts > 0 ? '23-53' : null,
    ponytailEstimateLocPct: shortcuts > 0 ? '6-20' : null,
  };

  let log = [];
  try {
    log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    // missing or invalid — start fresh
  }
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function main() {
  const session = process.env.CLAUDE_CODE_SESSION_ID;
  if (!session) return; // manual commit outside Claude Code — nothing to report

  report(session, countPonytailShortcuts(), getHeadroomSavingsPercent());
}

try {
  main();
} catch {
  // never block a commit over a reporting failure
}
