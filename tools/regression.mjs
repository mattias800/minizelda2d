// End-to-end regression checks. Needs the dev server (npm run dev) running.
// Each scenario boots a room in manual-step mode, plays scripted input and
// asserts on game state. Run with: npm test
import { chromium } from 'playwright-core';

const SCENARIOS = [
  {
    name: 'gamepad works even behind a phantom device',
    query: '',
    steps:
      "eval:(window.__mk=(m)=>({connected:true,mapping:m,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0,0,0,0,0,0,3.3]}),window.__pads=[__mk(''),__mk('standard')],navigator.getGamepads=()=>window.__pads);30;eval:window.__pads[1].buttons[0].pressed=true;2;eval:window.__pads[1].buttons[0].pressed=false;2",
    expect: "game.mode === 'play'",
  },
  {
    name: 'walk east into the Old Forest Path',
    query: 'room=clearing&x=640&y=160',
    steps: '40:right;30',
    expect: "game.scene.def.id === 'path'",
  },
  {
    name: 'fall through the pit into the cavern',
    query: 'room=path&x=440&y=160',
    steps: '40:right;60',
    expect: "game.scene.def.id === 'cavern'",
  },
  {
    name: 'single jump cannot reach the canopy shelf',
    query: 'room=clearing&x=470&y=160',
    steps: '2;1:jump;19:jump;1;1:jump+right;30:jump+right;30',
    expect: 'game.scene.player.y === 160',
  },
  {
    name: 'double jump reaches the canopy shelf',
    query: 'room=clearing&x=470&y=160&items=feather',
    steps: '2;1:jump;19:jump;1;1:jump+right;30:jump+right;30',
    expect: 'game.scene.player.y === 80',
  },
  {
    name: 'jump from the branch into the canopy',
    query: 'room=clearing&x=560&y=32&items=feather',
    steps: '3;1:jump;20:jump;30',
    expect: "game.scene.def.id === 'canopy'",
  },
  {
    name: 'canopy leads to the shrine',
    query: 'room=canopy&x=560&y=144&items=feather',
    steps: '3;20:right;1:right+jump;15:right+jump;60:right',
    expect: "game.scene.def.id === 'shrine'",
  },
  {
    name: 'fire burns the western thorn hedge',
    query: 'room=clearing&x=86&y=160&items=fire',
    steps: '3;2:left;1:item;90',
    expect: "game.scene.map.get(2, 8) === 0 && game.progress.flag('bramble:clearing:2,5')",
  },
  {
    name: 'hedge blocks the way without fire',
    query: 'room=clearing&x=86&y=160',
    steps: '3;80:left',
    expect: "game.scene.def.id === 'clearing' && game.scene.player.x > 60",
  },
  {
    name: 'the feather chest gives the feather',
    query: 'room=cavern&x=150&y=160&hearts=6',
    steps: '5;5:left;1:up;30',
    expect: "game.progress.has('feather')",
  },
  {
    name: 'the brute can be beaten',
    query: 'room=cavern&x=280&y=160&hearts=6',
    steps: "1;eval:fight(1500,'Brute')",
    expect: "game.progress.flag('boss:brute') && game.progress.hp > 0",
  },
  {
    name: 'the Guardian goes down and drops the Triforce',
    query: 'room=lair&x=320&y=160&items=feather,fire&hearts=7',
    steps: "3;60:left;100;eval:(game.scene.boss().hp=1,game.scene.boss().invuln=0,1);eval:fight(600,'Guardian');200",
    expect: "game.progress.flag('boss:guardian') && game.scene.entities.some(e => e.constructor.name === 'Triforce') && !game.scene.gate.closed",
  },
  {
    name: 'save stone saves the game',
    query: 'room=clearing&x=100&y=160',
    steps: '3;4:left;1:up;5',
    expect: "JSON.parse(localStorage.getItem('minizelda2d.save.v1')).x === 88",
  },
  {
    name: 'dying leads to game over and respawn',
    query: 'room=clearing&x=100&y=160',
    steps: '3;eval:(game.progress.hp=1,game.scene.player.hurt(2,0));200;1:attack;5',
    expect: "game.mode === 'play' && game.progress.hp === game.progress.maxHp && game.progress.data.deaths === 1",
  },
  {
    name: 'squirrel trades a heart container for rupees',
    query: 'room=clearing&x=290&y=160&rupees=35',
    steps: '3;1:up;5;1:attack;2;1:attack;2;1:attack;2;1:attack;2;1:attack;2;1:attack;2;1:attack;4;1:attack;4',
    expect: "game.progress.flag('squirrel:trade') && game.progress.data.maxHearts === 4",
  },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
let failed = 0;
for (const sc of SCENARIOS) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:5199/?manual&${sc.query}`);
  await page.waitForFunction(() => window.sim);
  await page.addScriptTag({ path: 'tools/bot.js' });
  for (const step of sc.steps.split(';').filter(Boolean)) {
    const i = step.indexOf(':');
    const k = i < 0 ? step : step.slice(0, i);
    const arg = i < 0 ? '' : step.slice(i + 1);
    if (k === 'eval') await page.evaluate(arg);
    else await page.evaluate(([n, acts]) => window.sim.step(n, acts), [Number(k), arg ? arg.split('+') : []]);
  }
  const ok = !errors.length && (await page.evaluate(sc.expect));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${sc.name}${errors.length ? `  (errors: ${errors.join('; ')})` : ''}`);
  if (!ok) failed++;
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
