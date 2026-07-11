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
