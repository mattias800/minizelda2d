import { Rng } from '../../core/math';
import { PixelBuf, packColor } from '../canvas';
import { leafCluster, ramp, trunk } from '../paint';
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
 * The pale, twisted forest giant from the reference: swirling bark, a knot
 * hole, flaring roots and a pair of branches reaching into the canopy.
 */
export const bigTree = once(() => {
  const W = 110;
  const H = 200;
  const b = new PixelBuf(W, H);
  const bark = ramp(P.b1, P.b2, P.b3, P.b4, P.b5, P.b6);
  const cx = 52;
  // branches first (behind the trunk)
  const branch = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 10;
      const w = w0 + (w1 - w0) * t;
      for (let dy = -w; dy <= w; dy++)
        for (let dx = -w; dx <= w; dx++) {
          if (dx * dx + dy * dy > w * w) continue;
          const v = dy < -w * 0.3 ? 4 : dy > w * 0.4 ? 1 : 3;
          b.set(Math.round(x + dx), Math.round(y + dy), bark[v]);
        }
    }
  };
  branch(cx - 4, 60, 6, 8, 7, 3);
  branch(cx + 6, 70, 104, 22, 7, 3);
  branch(cx + 2, 40, 70, 0, 6, 3);
  trunk(b, cx, 0, H - 1, 20, 26, bark, 3, 6, false);
  // swirling dark grooves
  for (let k = 0; k < 7; k++) {
    let x = cx - 12 + k * 4;
    for (let y = 4; y < H - 8; y++) {
      x += Math.sin(y / 14 + k) * 0.55;
      if (b.alpha(Math.round(x), y)) b.set(Math.round(x), y, packColor(k % 2 ? P.b2 : P.b1));
      if (k % 3 === 0 && b.alpha(Math.round(x) - 1, y)) b.set(Math.round(x) - 1, y, packColor(P.b5));
    }
  }
  // knot hole
  for (let dy = -9; dy <= 9; dy++)
    for (let dx = -5; dx <= 5; dx++) {
      const d = (dx * dx) / 25 + (dy * dy) / 81;
      if (d <= 1) b.set(cx - 6 + dx, 118 + dy, packColor(d > 0.6 ? P.b2 : d > 0.35 ? P.b0 : '#1e1a26'));
    }
  // flared roots
  const roots = [
    [-1, 16],
    [1, 20],
    [-1, 30],
    [1, 12],
  ];
  roots.forEach(([dir, len], i) => {
    for (let t = 0; t < len; t++) {
      const x = cx + dir * (14 + t);
      const y = H - 12 + Math.round((t * t) / (len * 1.4)) - i;
      const w = Math.max(1, 5 - (t * 4) / len);
      for (let dy = -w; dy <= w; dy++) b.set(Math.round(x), Math.round(y + dy), bark[dy < 0 ? 4 : 2]);
    }
  });
  addOutline(b, P.b0);
  return new Sprite(b.toCanvas(), cx + 1, H);
});

/** A far, hazy tree used as decor in forest rooms (not collidable). */
export const smallTree = once(() => {
  const b = new PixelBuf(60, 90);
  const rng = new Rng(9);
  trunk(b, 30, 30, 89, 5, 8, ramp(P.b1, P.b2, P.b3, P.b4), 2, 3, false);
  for (let i = 0; i < 7; i++)
    leafCluster(b, 30 + rng.range(-16, 16), 26 + rng.range(-14, 8), rng.range(9, 14), {
      ramp: ramp(P.navy, P.m0, P.g3, P.g4, P.g5, P.g6),
      rim: packColor(P.navy),
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

/** Bramble tile (16x16), two variants. */
export const brambleTiles = once(() => {
  const out: Sprite[] = [];
  for (let v = 0; v < 2; v++) {
    const pt = new Painter(16, 16);
    const rng = new Rng(40 + v);
    const vine = ['#3b2436', '#5a3048', '#7a4058'];
    for (let k = 0; k < 5; k++) {
      let x = rng.range(0, 16);
      let y = rng.range(0, 16);
      const ang = rng.range(0, Math.PI * 2);
      for (let i = 0; i < 16; i++) {
        x += Math.cos(ang + Math.sin(i / 3) * 0.8);
        y += Math.sin(ang + Math.sin(i / 3) * 0.8);
        const xx = ((Math.round(x) % 16) + 16) % 16;
        const yy = ((Math.round(y) % 16) + 16) % 16;
        pt.px(xx, yy, vine[k % 3]);
        pt.px(xx, (yy + 1) % 16, vine[0]);
        if (i % 5 === 2) pt.px(xx + 1, yy - 1, '#e8a0b0');
      }
    }
    for (let i = 0; i < 6; i++) pt.px(rng.int(0, 15), rng.int(0, 15), '#c04a5a');
    out.push(pt.toSprite(0, 0, false));
  }
  return out;
});

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
