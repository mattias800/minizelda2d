// Screenshots the running dev server with headless Edge.
// usage: node tools/shot.mjs "<query string>" out.png [waitMs] [keys-script]
import { chromium } from 'playwright-core';
const [query = '', out = 'tools/out/shot.png', wait = '800', script = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1344, height: 768 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:5199/?${query}`);
await page.waitForTimeout(Number(wait));
// Optional key script: "right:1000,z:100,wait:500"
for (const step of script.split(',').filter(Boolean)) {
  const [k, ms] = step.split(':');
  if (k === 'wait') { await page.waitForTimeout(Number(ms)); continue; }
  const keys = k.split('+');
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(Number(ms || 50));
  for (const key of keys) await page.keyboard.up(key);
}
await page.locator('canvas').screenshot({ path: out });
await browser.close();
console.log('saved', out);
