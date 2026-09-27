// Injected into the page by sim tests: a crude fighter bot for automated checks.
window.fight = (maxTicks, targetName) => {
  const g = window.game;
  let t = 0;
  while (t < maxTicks) {
    const s = g.scene;
    const p = s.player;
    const foes = [...s.enemies()].filter((e) => !targetName || e.constructor.name === targetName);
    if (!foes.length) break;
    const e = foes.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b));
    const dx = e.x - p.x;
    const acts = [];
    const reach = 22 + e.body.w / 2;
    const danger = e.state === 'swing' || e.state === 'windup' && e.t > 16;
    if (danger && Math.abs(dx) < 70) acts.push(dx > 0 ? 'left' : 'right');
    else if (Math.abs(dx) > reach) acts.push(dx > 0 ? 'right' : 'left');
    else {
      if (Math.sign(dx) !== p.facing) acts.push(dx > 0 ? 'right' : 'left');
      if (t % 6 === 0) acts.push('attack');
    }
    window.sim.step(1, acts);
    t++;
    if (g.progress.hp <= 0) return { t, result: 'died' };
  }
  return { t, hp: g.progress.hp, left: [...g.scene.enemies()].map((e) => e.constructor.name + ':' + e.hp) };
};

// A boss-fighting bot: keeps distance, jumps shockwaves, punishes recovery.
window.bossFight = (maxTicks) => {
  const g = window.game;
  let t = 0;
  let jumpHold = 0;
  while (t < maxTicks) {
    const s = g.scene;
    const p = s.player;
    const b = s.boss();
    if (!b) return { t, result: 'won', hp: g.progress.hp };
    const acts = [];
    const dx = b.x - p.x;
    const waves = s.entities.filter((e) => e.constructor.name === 'Shockwave' && !e.dead);
    const threat = waves.some((w) => Math.abs(w.x - p.x) < 34 && Math.sign(p.x - w.x) === Math.sign(w.dir));
    if (jumpHold > 0) {
      acts.push('jump');
      jumpHold--;
    } else if (threat && p.body.onGround) {
      acts.push('jump');
      jumpHold = 14;
    }
    const st = b.state;
    if (st === 'recover' || st === 'crouch') {
      if (Math.abs(dx) > 34) acts.push(dx > 0 ? 'right' : 'left');
      else {
        if (Math.sign(dx) !== p.facing) acts.push(dx > 0 ? 'right' : 'left');
        if (t % 5 === 0) acts.push('attack');
      }
    } else if (st === 'windup' || st === 'swing' || st === 'walk' && Math.abs(dx) < 80) {
      const away = dx > 0 ? -1 : 1;
      const wallDist = away < 0 ? p.x - 16 : s.map.widthPx - 16 - p.x;
      if (wallDist < 50 || window.__vault > 0) {
        // cornered: vault over the boss with a double jump
        window.__vault = (window.__vault || 0) > 0 ? window.__vault - 1 : 40;
        acts.push(dx > 0 ? 'right' : 'left');
        if (p.body.onGround || (window.__vault === 22)) acts.push('jump');
        else if (window.__vault < 22 || window.__vault > 24) acts.push('jump');
      } else acts.push(away < 0 ? 'left' : 'right');
    }
    window.sim.step(1, acts);
    t++;
    if (g.progress.hp <= 0) return { t, result: 'died', bossHp: b.hp };
  }
  return { t, result: 'timeout', hp: g.progress.hp, bossHp: s.boss()?.hp };
};

window.trackDamage = () => {
  const g = window.game;
  const log = {};
  const orig = window.sim.step;
  window.sim.step = (n, acts) => {
    for (let i = 0; i < n; i++) {
      const before = g.progress.hp;
      orig(1, acts);
      if (g.progress.hp < before) {
        const s = g.scene;
        const b = s.boss();
        const p = s.player;
        const wave = s.entities.some((e) => e.constructor.name === 'Shockwave' && Math.abs(e.x - p.x) < 16);
        const debris = s.entities.some((e) => e.constructor.name === 'Debris' && Math.abs(e.x - p.x) < 14);
        const key = wave ? 'shockwave' : debris ? 'debris' : b ? 'boss-' + b.state : 'other';
        log[key] = (log[key] || 0) + (before - g.progress.hp);
      }
    }
  };
  return () => log;
};

// Pogo bot: the Zelda II way. Down-thrust bounces on the boss's head.
window.pogo = (maxTicks) => {
  const g = window.game;
  let t = 0;
  let phase = 'wait';
  let pt = 0;
  while (t < maxTicks) {
    const s = g.scene;
    const p = s.player;
    const b = s.boss();
    if (!b) return { t, result: 'won', hp: g.progress.hp };
    const dx = b.x - p.x;
    const acts = [];
    const waves = s.entities.filter((e) => e.constructor.name === 'Shockwave' && !e.dead);
    const threat = waves.some((w) => Math.abs(w.x - p.x) < 40 && Math.sign(p.x - w.x) === Math.sign(w.dir));
    pt++;
    if (phase === 'wait') {
      // hover at mid range, facing the boss
      const want = 70;
      if (Math.abs(dx) < want - 10) acts.push(dx > 0 ? 'left' : 'right');
      else if (Math.abs(dx) > want + 10) acts.push(dx > 0 ? 'right' : 'left');
      if (threat && p.body.onGround) { phase = 'hop'; pt = 0; }
      else if (p.body.onGround && Math.abs(dx) < 90 && b.state !== 'leap') { phase = 'jump'; pt = 0; }
    }
    if (phase === 'hop') {
      acts.push('jump');
      if (pt > 16) phase = 'wait';
    }
    if (phase === 'jump') {
      acts.push(dx > 0 ? 'right' : 'left');
      if (pt < 18) acts.push('jump');
      if (pt === 20) acts.push('jump'); // double jump press (released on 19)
      if (pt > 20 && pt < 36) acts.push('jump');
      if (Math.abs(dx) < 10 && p.body.vy > 0) { phase = 'thrust'; pt = 0; }
      if (p.body.onGround && pt > 5) phase = 'wait';
    }
    if (phase === 'thrust') {
      acts.push('down');
      if (Math.abs(dx) > 6) acts.push(dx > 0 ? 'right' : 'left');
      if (p.body.onGround) phase = 'wait';
    }
    window.sim.step(1, acts);
    t++;
    if (g.progress.hp <= 0) return { t, result: 'died', bossHp: b.hp };
  }
  return { t, result: 'timeout', hp: g.progress.hp, bossHp: g.scene.boss()?.hp };
};
