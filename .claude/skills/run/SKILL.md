---
name: run
description: Launch and drive the Drinks Reviewer app (Vite client + Express server) in a headless browser to verify changes. Use when asked to run, start, or screenshot this app, or to confirm a change works end-to-end (not just tests).
---

Browser-driven web app: Vite client proxying `/api` to an Express server. No auth.

## Check for an already-running dev server first

This repo's dev server is often left running across sessions. Before starting a new one:

```bash
curl -sf http://localhost:5173 -o /dev/null -w "5173: %{http_code}\n"
curl -sf http://localhost:3001/api -o /dev/null -w "3001: %{http_code}\n"
```

If `5173` returns 200, an existing server is already up — use it, don't start another (starting a second one hits `EADDRINUSE` on 3001 and Vite silently falls back to 5174, which is confusing). Only start fresh if nothing responds.

## Starting fresh

```bash
npm run dev > /tmp/dev-server.log 2>&1 &
echo $! > /tmp/dev.pid
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

`npm run dev` runs `concurrently`: `dev:server` (Express, `node --watch`, port `3001`) + `dev:client` (Vite, port `5173`, proxies `/api` → `3001`). Stop with `kill $(cat /tmp/dev.pid)` — killing just that PID may leave the `concurrently`-spawned children; also `pkill -f "node --watch"` and check `netstat -ano | grep LISTENING` for stray Vite fallback ports (5174, 5175, ...) if you started and stopped more than once.

## Drive it

No `chromium-cli` in this environment. No local `playwright` npm dependency either, but it's installed **globally** (`npm ls -g playwright`). ESM `import` won't resolve a global package via `NODE_PATH` (Node ignores `NODE_PATH` for ESM) — use CommonJS `require` instead, which does honor it:

```bash
NODE_PATH="$(npm root -g)" node script.cjs
```

Template (`.claude/skills/run/drive.cjs` in this repo — copy and extend per task):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('title:', await page.title());
  console.log('errors:', errors.join('\n') || '(none)');
  await browser.close();
})();
```

Add `page.screenshot({ path: '<scratchpad>/name.png' })` calls at key points and `page.getByRole('button', { name: '...' }).click()` / `page.waitForURL(...)` to drive a specific flow. Always check `console --errors`-equivalent (the `errors` array) before declaring success — the page can render its shell while a fetch 500s underneath.

## One representative path (smoke-tests routing + data load)

- `/all` → shows drink counts, category tabs (Wine/Beer/Whiskey/Others)
- `/admin` → "Add Entry" form with Review/Collection tab toggle and category tabs; clicking "Add Review" or "Add to Collection" from `/all` or a category page (e.g. `/beer`) deep-links here with both tabs pre-selected via router state (`{ tab, category }`)

## Gotchas

- React controlled inputs: don't `eval el.value = '...'`, use Playwright's `fill`/`type`.
- First `nav` after a fresh Vite start can take a few seconds to compile routes — `waitUntil: 'networkidle'` or `wait-for` the element, don't guess with a fixed sleep.
- Don't leave `.cjs`/`.mjs` driver scripts in the global `node_modules` folder or the scratchpad after you're done — clean them up.
