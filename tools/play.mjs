// Scripted play-test against the dev server.
// usage: node tools/play.mjs "<query>" "<steps>"
// steps (semicolon separated):  Key:ms  (hold key; combine with +)   wait:ms
//                           shot:name   (saves tools/out/name.png)
//                           eval:expr   (prints the expression, evaluated in the page)
import { chromium } from 'playwright-core';
const [query = '', script = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1344, height: 768 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`http://localhost:5199/?${query}`);
await page.waitForTimeout(1200);
for (const step of script.split(';').map((s) => s.trim()).filter(Boolean)) {
  const i = step.indexOf(':');
  const k = step.slice(0, i);
  const arg = step.slice(i + 1);
  if (k === 'wait') await page.waitForTimeout(Number(arg));
  else if (k === 'shot') await page.locator('canvas').screenshot({ path: `tools/out/${arg}.png` });
  else if (k === 'eval') console.log(arg, '=>', JSON.stringify(await page.evaluate(arg)));
  else {
    const keys = k.split('+');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(Number(arg || 60));
    for (const key of keys.reverse()) await page.keyboard.up(key);
  }
}
await browser.close();
