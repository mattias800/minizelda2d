import { Rng } from '../../core/math';
import { PixelBuf, packColor } from '../canvas';
import { leafClump, ramp, trunk } from '../paint';
import { Painter } from '../painter';
import { P } from '../palette';
import { Palette, Sprite, addOutline, spriteFromGrid } from '../sprite';

/** Scenery, pickups, projectiles and effects. */

const once = <T>(fn: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v ??= fn());
};

// ------------------------------------------------------------------ plants

export const yellowMushroom = once(() =>
  spriteFromGrid(
    [
      '...YYYYY...',
      '.YYHHYYYYY.',
      'YYHHYYYYYYY',
      'YHYYYYYYYYy',
      'yYYYYYYYYyy',
      '.yyyyyyyyy.',
      '...SSSSs...',
      '...SSSss...',
      '..SSSSSsS..',
    ],
    { Y: '#f4d24e', H: '#fff4a6', y: '#c8963e', S: '#f4e8c8', s: '#cdb88e' },
  ),
);

export const redMushroom = once(() =>
  spriteFromGrid(
    [
      '.......RRRRRRRR.......',
      '....RRRRHHRRRRRRRR....',
      '..RRRHHHHRRRRRdRRRRR..',
      '.RRHHHRRRRRRRdddRRRRR.',
      'RRHHRRRRdRRRRRdRRRRRRr',
      'RHRRRRRdddRRRRRRRRRRrr',
      'RRRRRRRRdRRRRRRRRRrrrr',
      'rRRRRRRRRRRRRRRRRrrrrr',
      '.rrrrrrrrrrrrrrrrrrrr.',
      '...qqqqqqqqqqqqqqqq...',
      '........SSSSss........',
      '........SSSSss........',
      '........SSSSss........',
      '.......SSSSSsss.......',
      '.......SSSSSsss.......',
      '......SSSSSSssss......',
    ],
    { R: '#e0505a', H: '#f58a8a', r: '#a8343e', d: '#ffd8d8', q: '#7a2a36', S: '#f0e0c0', s: '#c8b08a' },
  ),
);

export const heartFlower = once(() =>
  spriteFromGrid(
    [
      '.RR.RR.',
      'RHRRRRr',
      'RRRRRRr',
      '.RRRRr.',
      '..RRr..',
      '...g...',
      '.gGg...',
      'gGGgGg.',
      '...gGGg',
      '...g...',
    ],
    { R: '#e0505a', H: '#ff9aa4', r: '#a8343e', G: '#5cbf70', g: '#2f6b58' },
  ),
);

const TUFTS = [
  [
    '.....L......L...',
    '..G..GL....GL...',
    '..GL.GG.L..GG.G.',
    '.GGL.GGLG.GGL.GL',
    '.GGG.GGGG.GGG.GG',
    'GGGGLGGGGGGGGLGG',
    'GgGGGGgGGGgGGGGg',
    'gggGgggGggggGggg',
  ],
  [
    '....L.....',
    '.L..GL..L.',
    '.GL.GG.GL.',
    'GGGLGGLGGL',
    'GGGGGGGGGG',
    'gGGgGGgGGg',
    'gggggggggg',
  ],
  ['.....G......', '..G..GL..G..', '..GL.GG.GL..', 'G.GG.GG.GG.G', 'GLGGGGGGGGLG', 'gGGgGGgGGgGg'],
  ['...G....', '.G.GL.G.', '.GLGG.GL', 'GGGGGGGG', 'gGgGGgGg'],
  ['.......L......', '..G....GL...G.', '..GL.G.GG..GL.', 'G.GG.GLGG..GG.', 'GLGGGGGGGG.GGG', 'GGGGGGGGGGGGGL', 'gGgGGgGGgGGgGg'],
];
export const grassTufts = once(() => TUFTS.map((t) => spriteFromGrid(t, { G: P.g4, L: P.g6, g: P.g2 })));
export const caveTufts = once(() => TUFTS.map((t) => spriteFromGrid(t, { G: '#2d6555', L: '#4f9a6c', g: '#1f3d4a' })));

/** Glowing cave mushrooms. */
export const glowShroom = once(() =>
  spriteFromGrid(['.CCC.', 'CHCCc', 'ccccc', '..s..', '..s..'], { C: '#62d6d0', H: '#d8fff8', c: '#2e8a9a', s: '#a8c0c8' }),
);

// ------------------------------------------------------------------ big twisted tree

/**
 * The pale, twisted forest giant from the reference: an S-curved trunk with
 * spiralling bark plates outlined in dark grooves, a knot hole, flared roots,
 * and two limbs forking up into its own leafy crown.
 */
export const bigTree = once(() => {
  const W = 190;
  const H = 178;
  const b = new PixelBuf(W, H);
  const bark = [P.b0, P.b1, P.b2, P.b3, P.b4, P.b5, P.b6].map((h) => packColor(h));
  const cx = 88;
  const spine = (y: number) => cx + Math.sin((1 - y / H) * 3.1 + 0.2) * 14;
  const width = (y: number) => {
    const t = y / H; // 0 top .. 1 base
    return 20 + t * 12 + (t > 0.86 ? (t - 0.86) * 130 : 0);
  };
  const shadeAt = (u: number) => (u < 0.14 ? 5 : u < 0.42 ? 4 : u < 0.72 ? 3 : 2);

  // limbs first, behind the trunk
  const limb = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, bend: number) => {
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend;
      const y = y0 + (y1 - y0) * t;
      const w = w0 + (w1 - w0) * t;
      for (let dy = -w; dy <= w; dy++)
        for (let dx = -w; dx <= w; dx++) {
          if (dx * dx + dy * dy > w * w) continue;
          const u = (dx + w) / (2 * w);
          b.set(Math.round(x + dx), Math.round(y + dy), bark[Math.max(2, shadeAt(u) - (dy > w * 0.4 ? 1 : 0))]);
        }
    }
  };
  limb(cx - 2, 78, cx - 62, 30, 8, 3.5, -8);
  limb(cx + 4, 72, cx + 66, 26, 7.5, 3, 8);
  limb(cx - 1, 60, cx + 8, 20, 6, 3, -4);

  // trunk body
  for (let y = 40; y < H; y++) {
    const c = spine(y);
    const half = width(y) / 2;
    for (let x = Math.floor(c - half); x <= Math.ceil(c + half); x++) {
      const u = (x - (c - half)) / (half * 2);
      b.set(x, y, bark[shadeAt(u)]);
    }
  }
  // spiral bark plates: diagonal grooves wrapping around the twisting trunk,
  // each with a lit lip above and a shaded band below
  for (let y = 44; y < H - 4; y++) {
    const c = spine(y);
    const half = width(y) / 2;
    const twist = 0.55 + Math.sin(y / 38) * 0.35;
    for (let x = Math.floor(c - half) + 1; x < Math.ceil(c + half); x++) {
      const u = (x - (c - half)) / (half * 2);
      // wrap distance around the cylinder so plates bend near the edges
      const around = Math.asin(Math.max(-1, Math.min(1, u * 2 - 1))) * half;
      const w = y + around * twist + Math.sin(y / 9) * 1.5;
      const m = ((w % 12) + 12) % 12;
      if (m < 1.6) b.set(x, y, bark[1]);
      else if (m < 2.6) b.set(x, y, bark[Math.max(1, shadeAt(u) - 1)]);
      else if (m > 10.8) b.set(x, y, bark[Math.min(6, shadeAt(u) + 1)]);
    }
  }
  // short vertical cracks for texture
  const rng = new Rng(11);
  for (let i = 0; i < 26; i++) {
    const y0 = rng.int(50, H - 20);
    const c = spine(y0);
    const x = Math.round(c + rng.range(-0.4, 0.3) * width(y0));
    const len = rng.int(3, 8);
    for (let k = 0; k < len; k++) b.set(x + (k > len / 2 ? 1 : 0), y0 + k, bark[2]);
  }
  // knot hole
  const kx = Math.round(spine(118)) - 3;
  for (let dy = -8; dy <= 8; dy++)
    for (let dx = -5; dx <= 5; dx++) {
      const d = (dx * dx) / 25 + (dy * dy) / 64;
      if (d <= 1) b.set(kx + dx, 118 + dy, d > 0.62 ? bark[2] : d > 0.3 ? bark[0] : packColor('#1e1a26'));
      else if (d <= 1.35 && dy < 0) b.set(kx + dx, 118 + dy, bark[6]);
    }
  // flared roots
  const roots: [number, number, number][] = [
    [-1, 26, 0],
    [1, 30, 0],
    [-1, 16, 3],
    [1, 14, 4],
  ];
  for (const [dir, len, lift] of roots) {
    for (let t = 0; t < len; t++) {
      const x = spine(H - 1) + dir * (10 + t);
      const y = H - 3 - lift + Math.round((t * t) / (len * 2.2));
      const w = Math.max(1, 4.5 - (t * 4) / len);
      for (let dy = -w; dy <= 0; dy++) b.set(Math.round(x), Math.round(y + dy), bark[dy < -w / 2 ? 5 : 3]);
      b.set(Math.round(x), Math.round(y + 1), bark[1]);
    }
  }
  addOutline(b, P.b0);

  // leafy crown hiding the limb ends, in the canopy's colours
  const leaves = ramp('#1c3444', P.navy, '#2f6b58', '#3a845f', '#48a864', '#5cbf70', '#b0e49c');
  const crown: [number, number, number][] = [
    [cx - 70, 22, 18],
    [cx - 48, 12, 17],
    [cx - 24, 18, 15],
    [cx + 2, 8, 17],
    [cx + 28, 16, 16],
    [cx + 52, 8, 17],
    [cx + 74, 20, 16],
    [cx - 58, 36, 12],
    [cx + 62, 34, 12],
    [cx + 14, 30, 11],
  ];
  crown.forEach(([x, y, r], i) => leafClump(b, x, y, r, { ramp: leaves, seed: i * 31 + 5, bias: -0.3 }));
  return new Sprite(b.toCanvas(), cx + 1, H);
});

/** A far, hazy tree used as decor in forest rooms (not collidable). */
export const smallTree = once(() => {
  const b = new PixelBuf(60, 90);
  const rng = new Rng(9);
  trunk(b, 30, 30, 89, 5, 8, ramp(P.b1, P.b2, P.b3, P.b4), 2, 3, false);
  for (let i = 0; i < 7; i++)
    leafClump(b, 30 + rng.range(-16, 16), 26 + rng.range(-14, 8), rng.range(9, 14), {
      ramp: ramp(P.navy, P.m0, P.g3, P.g4, P.g5, P.g6),
      seed: i,
    });
  return new Sprite(b.toCanvas(), 30, 90);
});

// ------------------------------------------------------------------ interactive props

const CHEST_PAL: Palette = {
  W: '#c07a4a',
  w: '#8a4e34',
  d: '#5e3226',
  G: '#f4c34e',
  g: '#b0772e',
  K: '#3a2230',
  H: '#e8a868',
};
export const chestFrames = once(() => [
  spriteFromGrid(
    [
      '..dddddddddddd..',
      '.dHHHHWWWWWWWWd.',
      'dHWWWWWWWWWWWWwd',
      'dGGGGGGGGGGGGGGd',
      'dgWWWWWggWWWWWgd',
      'dgWWWWGKKGWWWWgd',
      'dGGGGGGKKGGGGGGd',
      'dgWWWWWWWWWWWWgd',
      'dgHWWWWWWWWWWwgd',
      'dgWWWWWWWWWWwwgd',
      'dGGGGGGGGGGGGGGd',
      '.dddddddddddddd.',
    ],
    CHEST_PAL,
  ),
  spriteFromGrid(
    [
      '.dddddddddddddd.',
      'dwwwwwwwwwwwwwwd',
      'dGGGGGGGGGGGGGGd',
      '.dddddddddddddd.',
      'dKKKKKKKKKKKKKKd',
      'dGGGGGGGGGGGGGGd',
      'dgWWWWWWWWWWWWgd',
      'dgHWWWWWWWWWWwgd',
      'dgWWWWWWWWWWwwgd',
      'dGGGGGGGGGGGGGGd',
      '.dddddddddddddd.',
    ],
    CHEST_PAL,
  ),
]);

/** Save stone: a glowing crystal on a carved plinth. 3 glow frames. */
export const saveStoneFrames = once(() => {
  const crystal = ['...c...', '..cCc..', '.cCHCc.', '.cCHCc.', 'cCCHCCc', 'cCCCCCc', '.cCCCc.', '..cCc..', '...c...'];
  const base = [
    '...ssssssss...',
    '..sSSSSSSSSs..',
    '...sSSSSSSs...',
    '....sSttSs....',
    '....sStTSs....',
    '....sSttSs....',
    '...sSSSSSSs...',
    '..sSSSSSSSSs..',
    '.ssssssssssss.',
  ];
  const glows = ['#7ae8c8', '#9af4d8', '#c4ffe8'];
  return glows.map((glow) => {
    const pt = new Painter(20, 26);
    pt.grid(base, { s: '#4e4760', S: '#807894', t: '#5e5670', T: glow }, 3, 16);
    pt.grid(crystal, { c: '#2e8a8a', C: glow, H: '#ffffff' }, 6, 3 + (glow === glows[1] ? 1 : 0));
    return pt.toSprite(10, 25);
  });
});

// ------------------------------------------------------------------ pickups

export const heartContainer = once(() =>
  spriteFromGrid(
    [
      '..ppp...ppp..',
      '.pPPPp.pPPPp.',
      'pPWWPPpPPPPPp',
      'pPWPPPPPPPPPp',
      'pPPPPPPPPPPPp',
      'pPPPPPPPPPPrp',
      '.pPPPPPPPPrp.',
      '..pPPPPPPrp..',
      '...pPPPPrp...',
      '....pPPrp....',
      '.....prp.....',
      '......p......',
    ],
    { p: '#c0405e', P: '#f06b86', r: '#d04f6e', W: '#ffffff' },
    { outline: '#fff4d6' },
  ),
);

export const smallHeart = once(() =>
  spriteFromGrid(['.pp.pp.', 'pWPpPPp', 'pPPPPPp', '.pPPPp.', '..pPp..', '...p...'], { p: '#c0405e', P: '#f06b86', W: '#ffffff' }),
);

const RUPEE = ['..gGg..', '.gLGGg.', 'gLLGGGg', 'gLGGGdg', 'gLGGGdg', 'gLGGGdg', 'gLGGGdg', 'gGGGddg', '.gGddg.', '..gdg..'];
export const rupeeFrames = once(() => ({
  green: [
    spriteFromGrid(RUPEE, { g: '#2f7a3a', G: '#7ad65a', L: '#d4f78a', d: '#4aa648' }),
    spriteFromGrid(RUPEE, { g: '#2f7a3a', G: '#9ae86a', L: '#ffffff', d: '#5ab84e' }),
  ],
  blue: [
    spriteFromGrid(RUPEE, { g: '#2a4a9a', G: '#5a9af0', L: '#c4e4ff', d: '#3a6ad0' }),
    spriteFromGrid(RUPEE, { g: '#2a4a9a', G: '#7ab4ff', L: '#ffffff', d: '#4a7ae0' }),
  ],
}));

export const magicJar = once(() =>
  spriteFromGrid(['.ccc.', '..w..', '.bBb.', 'bBHBb', 'bBBBb', 'bBBBb', '.bbb.'], {
    c: '#8a5a44',
    w: '#f4e8c8',
    b: '#2a5ab0',
    B: '#5a9af0',
    H: '#d4ecff',
  }),
);

export const featherIcon = once(() =>
  spriteFromGrid(
    ['.......wW', '.....wWWW', '....wWWWw', '...wWWWw.', '..wWWWw..', '..wWWw...', '.wWWw....', '.wWw.....', 'q.w......', 'q........'],
    { w: '#c8d4e8', W: '#ffffff', q: '#8a5a44' },
  ),
);

export const fireIcon = once(() =>
  spriteFromGrid(
    ['....R....', '...RR....', '...RYR...', '..RYYR.R.', '.RYYWYRR.', '.RYWWWYR.', 'RYYWWWYYR', 'RYYWWWYYR', '.RYYYYYR.', '..RRRRR..'],
    { R: '#e0503a', Y: '#f8b030', W: '#fff4a0' },
  ),
);

export const triforce = once(() =>
  spriteFromGrid(
    [
      '.......g.......',
      '......gYg......',
      '.....gYWYg.....',
      '....gYWYYYg....',
      '...gYYYYYYYg...',
      '...ggggggggg...',
      '..gYg.....gYg..',
      '.gYWYg...gYWYg.',
      'gYWYYYg.gYWYYYg',
      'gYYYYYYgYYYYYYg',
      'ggggggggggggggg',
    ],
    { g: '#b0772e', Y: '#f4c34e', W: '#fff4a6' },
  ),
);

// ------------------------------------------------------------------ projectiles & effects

export const fireballFrames = once(() => [
  spriteFromGrid(['...RRR....', '.RRYYYRR..', 'RYYWWWYYR.', 'RYWWWWWYRR', 'RYYWWWYYR.', '.RRYYYRR..', '...RRR....'], { R: '#e0503a', Y: '#f8b030', W: '#fff4a0' }, { ay: 4 }),
  spriteFromGrid(['..RRRR....', '.RYYYYRR.R', 'RYYWWWYYRR', 'RYWWWWWYR.', 'RYYWWWYYRR', '.RYYYYRR.R', '..RRRR....'], { R: '#e0503a', Y: '#f8b030', W: '#fff4a0' }, { ay: 4 }),
]);

export const spearSprite = once(() =>
  spriteFromGrid(['..............WW.', 'bbbbbbbbbbbbbSSSW', '..............WW.'], { b: '#8a5a44', S: '#c8d0dc', W: '#f2f6fa' }, { ay: 2 }),
);

/**
 * A dense, thorny bramble mass covering the given tiles (plus a small ragged
 * margin). Returns the sprite and its top-left position in world pixels.
 */
export function brambleMass(tiles: [number, number][], seed: number): { sprite: Sprite; x: number; y: number } {
  const T = 16;
  const pad = 4;
  const minX = Math.min(...tiles.map((t) => t[0]));
  const minY = Math.min(...tiles.map((t) => t[1]));
  const maxX = Math.max(...tiles.map((t) => t[0]));
  const maxY = Math.max(...tiles.map((t) => t[1]));
  const w = (maxX - minX + 1) * T + pad * 2;
  const h = (maxY - minY + 1) * T + pad * 2;
  const pt = new Painter(w, h);
  const rng = new Rng(seed);
  // clumpy thorn-bush body
  const bush = ramp('#1e1220', '#2e1a2a', '#43263c', '#5e3450', '#7c4866', '#9a5e7c');
  const buf = pt.buf;
  const blobs: { x: number; y: number; r: number }[] = [];
  for (const [tx, ty] of tiles)
    for (let k = 0; k < 3; k++)
      blobs.push({ x: (tx - minX) * T + pad + rng.range(1, 15), y: (ty - minY) * T + pad + rng.range(2, 14), r: rng.range(6, 9.5) });
  blobs.sort((a, b) => a.y - b.y);
  for (const b of blobs) leafClump(buf, b.x, b.y, b.r, { ramp: bush, seed: Math.round(b.x * 13 + b.y), bias: -0.5 });
  // thorns poking out of the silhouette
  for (const b of blobs)
    for (let k = 0; k < 4; k++) {
      const a = rng.range(0, Math.PI * 2);
      const x0 = b.x + Math.cos(a) * (b.r - 1);
      const y0 = b.y + Math.sin(a) * (b.r - 1);
      pt.line(x0, y0, x0 + Math.cos(a) * 3, y0 + Math.sin(a) * 3, '#5e3450');
      pt.px(x0 + Math.cos(a) * 3, y0 + Math.sin(a) * 3, '#e8c0cc');
    }
  // curling vines, lit from above
  const vineColors = ['#4a2a3e', '#6a3650', '#8a4a64', '#a8667a'];
  const strokes = tiles.length * 3;
  for (let k = 0; k < strokes; k++) {
    const [tx, ty] = rng.pick(tiles);
    let x = (tx - minX) * T + pad + rng.range(0, T);
    let y = (ty - minY) * T + pad + rng.range(0, T);
    let a = rng.range(0, Math.PI * 2);
    const curl = rng.range(-0.35, 0.35);
    const len = rng.int(8, 18);
    for (let i = 0; i < len; i++) {
      a += curl;
      x += Math.cos(a);
      y += Math.sin(a);
      const lit = Math.sin(a) < -0.2 ? 3 : Math.sin(a) < 0.3 ? 2 : 1;
      pt.px(x, y, vineColors[lit]);
      pt.px(x, y + 1, vineColors[0]);
      if (i % 6 === 3) {
        // thorn: a pale spike sticking out of the vine
        const nx = Math.round(x - Math.sin(a) * 1.5);
        const ny = Math.round(y + Math.cos(a) * 1.5);
        pt.px(nx, ny, '#f0c8d0');
      }
    }
  }
  // a few blood-red berries
  for (let i = 0; i < tiles.length * 2; i++) {
    const [tx, ty] = rng.pick(tiles);
    const bx = (tx - minX) * T + pad + rng.int(2, 13);
    const by = (ty - minY) * T + pad + rng.int(2, 13);
    pt.px(bx, by, '#d04050');
    pt.px(bx + 1, by, '#a02a3a');
    pt.px(bx, by - 1, '#ff8a9a');
  }
  const sprite = pt.toSprite(0, 0, '#1a1018');
  return { sprite, x: minX * T - pad - 1, y: minY * T - pad - 1 };
}

/** Puff of smoke for defeated enemies: 5 frames. */
export const poofFrames = once(() => {
  const out: Sprite[] = [];
  for (let f = 0; f < 5; f++) {
    const pt = new Painter(28, 28);
    const r = 4 + f * 2.2;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + f * 0.3;
      const pr = Math.max(1, 4 - f * 0.7);
      pt.ellipse(14 + Math.cos(a) * r, 14 + Math.sin(a) * r, pr, pr, f < 3 ? '#fff4d6' : '#d8d0c0');
      if (f < 3) pt.ellipse(14 + Math.cos(a) * r - 0.5, 14 + Math.sin(a) * r - 0.5, pr * 0.5, pr * 0.5, '#ffffff');
    }
    if (f < 2) pt.ellipse(14, 14, 4 - f * 2, 4 - f * 2, '#ffffff');
    out.push(pt.toSprite(14, 14, false));
  }
  return out;
});

/** Sword hit spark: 3 frames. */
export const sparkFrames = once(() =>
  [3, 5, 6].map((r, f) => {
    const pt = new Painter(16, 16);
    const c = f === 2 ? '#f4c34e' : '#ffffff';
    pt.line(8 - r, 8, 8 + r, 8, c);
    pt.line(8, 8 - r, 8, 8 + r, c);
    if (f > 0) {
      pt.px(8 - r + 2, 8 - r + 2, c);
      pt.px(8 + r - 2, 8 + r - 2, c);
      pt.px(8 - r + 2, 8 + r - 2, c);
      pt.px(8 + r - 2, 8 - r + 2, c);
    }
    return pt.toSprite(8, 8, false);
  }),
);
