// Simulates gamepads by overriding navigator.getGamepads, to test controller input.
import { chromium } from 'playwright-core';
const [layout = 'single'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript((layout) => {
  const mk = (id, nButtons, nAxes, mapping) => ({
    id, index: 0, connected: true, mapping, timestamp: 0,
    buttons: Array.from({ length: nButtons }, () => ({ pressed: false, value: 0, touched: false })),
    axes: Array(nAxes).fill(0),
  });
  const real = mk('Xbox Wireless Controller (STANDARD GAMEPAD)', 17, 4, 'standard');
  // Phantom devices commonly show up before the real pad on Windows.
  const phantom = mk('HID-compliant headset', 4, 10, '');
  const generic = mk('USB Gamepad', 12, 10, '');
  generic.axes[9] = 3.2857;
  const pads = layout === 'phantom' ? [phantom, real] : layout === 'generic' ? [generic] : [real];
  if (layout === 'generic') window.__pad = generic;
  else window.__pad = real;
  navigator.getGamepads = () => pads;
}, layout);
await page.goto('http://localhost:5199/?manual');
await page.waitForFunction(() => window.sim);
const press = async (btn, ticks = 2) => {
  await page.evaluate(([b, t]) => { window.__pad.buttons[b].pressed = true; window.sim.step(t); window.__pad.buttons[b].pressed = false; window.sim.step(1); }, [btn, ticks]);
};
await page.evaluate(() => window.sim.step(30));
await press(0); // A on the title screen
console.log(layout, 'after A on title:', await page.evaluate(() => window.game.mode));
await page.evaluate(() => { window.__pad.axes[0] = 1; window.sim.step(40); window.__pad.axes[0] = 0; });
console.log(layout, 'dialog open?', await page.evaluate(() => !!window.game.dialog));
await browser.close();
