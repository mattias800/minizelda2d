// Deterministic play-test: the page runs with ?manual and only advances via sim.step().
// usage: node tools/sim.mjs "<query>" "<steps>"
// steps (semicolon separated):  N[:action+action]  advance N ticks holding actions
//                               shot:name   eval:expr
import { chromium } from 'playwright-core';
const [query = '', script = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1344, height: 768 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:5199/?manual&${query}`);
await page.waitForFunction(() => window.sim);
await page.addScriptTag({ path: 'tools/bot.js' });
for (const step of script.split(';').map((s) => s.trim()).filter(Boolean)) {
  const i = step.indexOf(':');
  const k = i < 0 ? step : step.slice(0, i);
  const arg = i < 0 ? '' : step.slice(i + 1);
  if (k === 'shot') await page.locator('canvas').screenshot({ path: `tools/out/${arg}.png` });
  else if (k === 'eval') console.log(arg, '=>', JSON.stringify(await page.evaluate(arg)));
  else await page.evaluate(([n, acts]) => window.sim.step(n, acts), [Number(k), arg ? arg.split('+') : []]);
}
await browser.close();
