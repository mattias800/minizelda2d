import { Rng, bayer, hash2, valueNoise } from '../core/math';
import { Theme } from '../world/rooms';
import { Ctx, PixelBuf, packColor } from './canvas';
import { cloudBank, cobble, ditherGradient, leafCluster, ramp, setWrap, trunk } from './paint';
import { P } from './palette';

export const VIEW_W = 336;
export const VIEW_H = 192;

/** One horizontally repeating parallax layer. */
export interface Layer {
  img: HTMLCanvasElement;
  /** 0 = fixed to the screen, 1 = moves with the world. */
  factor: number;
  /** Vertical parallax factor (rooms taller than a screen). */
  factorY?: number;
}

export class Backdrop {
  constructor(readonly layers: Layer[]) {}
  draw(ctx: Ctx, camX: number, camY: number): void {
    for (const l of this.layers) {
      const w = l.img.width;
      const ox = -Math.round(camX * l.factor);
      const oy = -Math.round(camY * (l.factorY ?? 0));
      let x = ((ox % w) + w) % w;
      if (x > 0) x -= w;
      for (; x < VIEW_W; x += w) ctx.drawImage(l.img, x, oy);
    }
  }
}

const cache = new Map<Theme, Backdrop>();

export function backdropFor(theme: Theme): Backdrop {
  let b = cache.get(theme);
  if (!b) {
    b = new Backdrop(BUILDERS[theme]());
    cache.set(theme, b);
  }
  return b;
}

const BUILDERS: Record<Theme, () => Layer[]> = {
  forest: forestLayers,
  canopy: canopyLayers,
  cave: caveLayers,
  shrine: shrineLayers,
  hollow: hollowLayers,
};

// ------------------------------------------------------------------ forest

function forestSky(w: number, seed: number): PixelBuf {
  const b = new PixelBuf(w, VIEW_H);
  ditherGradient(b, 0, VIEW_H, ramp('#e9f0cf', P.sky1, P.sky0, P.sky0, P.sky0, '#eef0cc', '#d6ead0'));
  const rng = new Rng(seed);
  const colors = { light: packColor(P.cloud), mid: packColor(P.sky0), shade: packColor(P.cloudShade) };
  for (let x = 0; x < w; x += rng.int(90, 150)) cloudBank(b, x, rng.int(92, 112), rng.int(60, 120), rng.int(24, 36), colors, rng);
  return b;
}

function farTrees(b: PixelBuf, seed: number, groundY: number, pale: string[], barkHex: string[]): void {
  const rng = new Rng(seed);
  const leaves = ramp(...pale);
  const bark = ramp(...barkHex);
  // hazy ground
  for (let y = groundY; y < VIEW_H; y++)
    for (let x = 0; x < b.w; x++) b.set(x, y, leaves[Math.min(leaves.length - 1, 1 + ((bayer(x, y) * 1.5) | 0))]);
  for (let x = rng.int(0, 30); x < b.w; x += rng.int(40, 80)) {
    const top = rng.int(70, 100);
    trunk(b, x, top, groundY + 4, 3, rng.int(5, 8), bark, rng.int(0, 99), 3);
    const cr = rng.int(16, 26);
    for (let k = 0; k < 5; k++)
      leafCluster(b, x + rng.range(-cr, cr), top + rng.range(-cr * 0.6, cr * 0.4), cr * rng.range(0.5, 0.8), {
        ramp: leaves,
        wrap: true,
        seed: seed + k,
        texture: 0.6,
      });
  }
  // low bushes along the ground
  for (let x = 0; x < b.w; x += rng.int(10, 20))
    leafCluster(b, x, groundY + rng.int(-2, 4), rng.int(7, 12), { ramp: leaves, wrap: true, seed, texture: 0.5, bias: -0.3 });
}

interface CliffShape {
  len: [number, number];
  gapChance: number;
  gap: [number, number];
}

/** Warm earthen cliffs with grassy caps (mid distance). */
function cliffs(
  b: PixelBuf,
  seed: number,
  minTop: number,
  maxTop: number,
  earth: string[],
  grass: string[],
  shape: CliffShape = { len: [70, 160], gapChance: 0.35, gap: [20, 50] },
): void {
  const rng = new Rng(seed);
  const e = ramp(...earth);
  const g = ramp(...grass);
  const tops = new Int16Array(b.w).fill(VIEW_H);
  let x = 0;
  while (x < b.w) {
    const len = rng.int(shape.len[0], shape.len[1]);
    const top = rng.int(minTop, maxTop);
    const gap = rng.chance(shape.gapChance) ? rng.int(shape.gap[0], shape.gap[1]) : 0;
    for (let i = 0; i < len && x + i < b.w; i++) {
      // rounded shoulders at each end
      const edge = Math.min(i, len - 1 - i);
      tops[x + i] = top + (edge < 6 ? Math.round((6 - edge) * (6 - edge) * 0.25) : 0);
    }
    x += len + gap;
  }
  const lit = e.slice(3); // warm sunlit clay
  const dark = e.slice(0, 3); // shadowed lower wall
  for (let x2 = 0; x2 < b.w; x2++) {
    const t = tops[x2];
    const capT = 9 + Math.round(hash2(Math.floor(x2 / 4), 0, seed) * 3);
    // how far the sunlit clay reaches down this column: vertical drips
    const drip = 16 + Math.round(valueNoise(x2 / 3.5, 1, seed) * 20 + valueNoise(x2 / 11, 2, seed) * 14);
    for (let y = t; y < VIEW_H; y++) {
      const d = y - t;
      if (d < capT) {
        // grassy lip with chevron leaves, hanging tips at the bottom edge
        const row = Math.floor(y / 3);
        const lx = (x2 + (row & 1) * 2) & 3;
        const v = 4.4 - (d / capT) * 3 + [1, 0.5, 0, -0.5][lx] + (hash2(x2 >> 2, row, seed) < 0.2 ? 1 : 0);
        b.set(x2, y, g[Math.max(0, Math.min(g.length - 1, Math.round(v)))]);
        continue;
      }
      const dd = d - capT;
      if (dd < 2) {
        b.set(x2, y, dark[0]); // shadow under the lip
        continue;
      }
      // tall narrow lumps give the eroded, streaky look
      const cb = cobble(x2, y, 6, 11, seed);
      if (dd < drip) {
        let v = 1 + Math.floor(cb.id * 1.6);
        if (-cb.dy > 0.25) v++;
        if (cb.dy > 0.3 || cb.edge < 0.08) v--;
        // fade into shadow toward the drip tips
        if (dd > drip - 6 && bayer(x2, y) < (dd - drip + 6) / 6) v = -1;
        b.set(x2, y, v < 0 ? dark[2] : lit[Math.min(lit.length - 1, v)]);
      } else {
        // shadowed wall: mostly flat with a few soft lumps
        let v = 1;
        if (cb.id > 0.72 && -cb.dy > 0.1) v = 2;
        if (cb.edge < 0.07 && cb.id < 0.4) v = 0;
        if (dd > drip + 50) v = Math.min(v, 1);
        b.set(x2, y, dark[v]);
      }
    }
    // shaded cliff side faces
    const prev = tops[(x2 - 1 + b.w) % b.w];
    if (prev > t)
      for (let y = t + capT; y < Math.min(VIEW_H, prev + 4); y++) b.set(x2, y, dark[1]);
    const next = tops[(x2 + 1) % b.w];
    if (next > t)
      for (let y = t + capT; y < VIEW_H; y++) {
        b.set(x2, y, dark[0]);
        b.set(x2 - 1, y, dark[1]);
      }
  }
}

/** Dense leaf ceiling across the top of the screen, with some trunks. */
function canopyCeiling(b: PixelBuf, seed: number, depth: number, leaves: string[], rimHex: string, bark?: string[]): void {
  const rng = new Rng(seed);
  const lr = ramp(...leaves);
  const rim = packColor(rimHex);
  if (bark) {
    const br = ramp(...bark);
    for (let x = rng.int(20, 80); x < b.w; x += rng.int(170, 260))
      trunk(b, x, 10, VIEW_H + 10, rng.int(10, 14), rng.int(16, 22), br, rng.int(0, 99), 7);
  }
  // back rows first, then lower (front) rows so lower clusters overlap
  const rowsY = [-14, 0, 14, depth - 16, depth - 6];
  rowsY.forEach((baseY, ri) => {
    for (let x = rng.int(0, 20); x < b.w + 20; x += rng.int(14, 26)) {
      const r = rng.int(12, 20) - ri;
      const y = baseY + rng.int(-6, 8) + (ri >= 3 ? Math.round(valueNoise(x / 60, ri, seed) * 22) - 8 : 0);
      if (ri >= 3 && valueNoise(x / 45, 9, seed) < 0.35) continue; // gaps to the sky
      leafCluster(b, x, y, r, { ramp: lr, rim, wrap: true, seed: seed + ri * 13 + x, bias: ri * 0.3 - 1.2 });
    }
  });
}

function forestLayers(): Layer[] {
  const sky = forestSky(VIEW_W * 2, 11);

  const far = new PixelBuf(640, VIEW_H);
  farTrees(far, 21, 150, ['#7fb09a', '#8fc0a4', '#a8d4ae', '#c2e4bc', '#d8eecb'], ['#9aa89a', '#b0bba8', '#c8ccb4']);

  const mid = new PixelBuf(760, VIEW_H);
  // a few mid trees behind the cliffs
  const midRng = new Rng(5);
  for (let x = 60; x < mid.w; x += midRng.int(160, 240)) {
    trunk(mid, x, 40, 150, 5, 9, ramp('#707a6e', '#8c9484', '#a8ac98', '#c4c4ac'), midRng.int(0, 99), 8);
    for (let k = 0; k < 6; k++)
      leafCluster(mid, x + midRng.range(-30, 30), 40 + midRng.range(-20, 14), midRng.range(12, 20), {
        ramp: ramp('#2a5652', '#356a5c', '#447e66', '#569474', '#6eac84', '#8cc898'),
        rim: packColor(P.navy),
        bias: -0.4,
        wrap: true,
        seed: k + x,
      });
  }
  cliffs(mid, 31, 104, 128, ['#a08a88', '#b09490', '#bca098', P.c2, P.c3, P.c4], [P.m1, P.m2, P.m3, '#7fcf8c', P.g6, P.g7]);

  // The shadowed earthen wall right behind the play area, with sunlit
  // openings onto the distance.
  const wall = new PixelBuf(900, VIEW_H);
  cliffs(wall, 57, 62, 96, ['#5e5462', '#70606a', '#806a70', P.c2, P.c3, P.c4], [P.g1, P.g2, P.g3, P.g4, P.g5, P.g6, P.g7], {
    len: [110, 220],
    gapChance: 0.6,
    gap: [60, 120],
  });

  const top = new PixelBuf(820, VIEW_H);
  canopyCeiling(top, 41, 58, [P.navy, '#2a4a52', P.m0, '#3a6e62', P.m1, P.m2, '#6abd8a', '#a8e0a0'], P.navy, [P.b1, P.b2, P.b3, P.b4, P.b5]);

  return [
    { img: sky.toCanvas(), factor: 0.03 },
    { img: far.toCanvas(), factor: 0.15 },
    { img: mid.toCanvas(), factor: 0.3 },
    { img: wall.toCanvas(), factor: 0.5 },
    { img: top.toCanvas(), factor: 0.65 },
  ];
}

// ------------------------------------------------------------------ canopy

function canopyLayers(): Layer[] {
  const sky = new PixelBuf(VIEW_W * 2, VIEW_H);
  ditherGradient(sky, 0, VIEW_H, ramp('#bfe3d4', '#d7eed6', '#eef4d8', P.sky0, P.sky0, '#f6f0d0'));
  const rng = new Rng(3);
  const colors = { light: packColor(P.cloud), mid: packColor(P.sky0), shade: packColor(P.cloudShade) };
  for (let x = 0; x < sky.w; x += rng.int(80, 140)) cloudBank(sky, x, rng.int(60, 130), rng.int(70, 130), rng.int(26, 44), colors, rng);

  const far = new PixelBuf(600, VIEW_H);
  for (let x = 0; x < far.w; x += 11)
    leafCluster(far, x, 150 + Math.round(valueNoise(x / 50, 1, 2) * 26), 16 + ((x * 7) % 9), {
      ramp: ramp('#7fb09a', '#8fc0a4', '#a8d4ae', '#c2e4bc', '#d8eecb'),
      wrap: true,
      seed: x,
      texture: 0.6,
    });
  const near = new PixelBuf(700, VIEW_H);
  for (let x = 0; x < near.w; x += 13)
    leafCluster(near, x, 178 + Math.round(valueNoise(x / 40, 5, 4) * 24), 18 + ((x * 5) % 8), {
      ramp: ramp(P.m0, P.m1, P.m2, P.m3, '#8fcf98', P.g6),
      rim: packColor(P.m0),
      wrap: true,
      seed: x + 3,
    });
  return [
    { img: sky.toCanvas(), factor: 0.03 },
    { img: far.toCanvas(), factor: 0.12 },
    { img: near.toCanvas(), factor: 0.3 },
  ];
}

// ------------------------------------------------------------------ cave

function rockSpires(b: PixelBuf, seed: number, colorsHex: string[], fromTop: boolean, density: number, len: [number, number]): void {
  const rng = new Rng(seed);
  const c = ramp(...colorsHex);
  for (let x = 0; x < b.w; x += rng.int(density, density * 2)) {
    const w = rng.int(10, 26);
    const l = rng.int(len[0], len[1]);
    for (let i = 0; i < l; i++) {
      const t = i / l;
      const half = (w / 2) * (1 - t * t) + 1;
      const y = fromTop ? i : VIEW_H - 1 - i;
      for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
        const u = (dx + half) / (half * 2);
        let v = u < 0.3 ? 2 : u > 0.75 ? 0 : 1;
        if (hash2(x + dx, Math.floor(y / 4), seed) < 0.08) v = Math.max(0, v - 1);
        setWrap(b, x + dx, y, c[v]);
      }
    }
  }
}

function caveLayers(): Layer[] {
  const back = new PixelBuf(VIEW_W * 2, VIEW_H);
  ditherGradient(back, 0, VIEW_H, ramp('#121822', '#18202c', '#1e2836', '#243040', '#1e2836'));
  rockSpires(back, 7, ['#1f2733', '#262f3d', '#2d3747'], true, 20, [30, 90]);
  rockSpires(back, 8, ['#1f2733', '#262f3d', '#2d3747'], false, 24, [30, 80]);
  // glimmering crystals
  const rng = new Rng(9);
  for (let i = 0; i < 60; i++) {
    const x = rng.int(0, back.w - 1);
    const y = rng.int(20, 170);
    const c = packColor(rng.pick(['#5fd0c0', '#8ce8d8', '#4aa0b0']));
    back.set(x, y, c);
    if (rng.chance(0.4)) back.set(x, y - 1, c);
  }
  const mid = new PixelBuf(720, VIEW_H);
  rockSpires(mid, 17, ['#252b3a', '#2f3748', '#3b4456'], true, 34, [20, 60]);
  rockSpires(mid, 18, ['#252b3a', '#2f3748', '#3b4456'], false, 40, [30, 70]);
  // mossy rock blobs on the mid layer floor
  for (let x = 0; x < mid.w; x += 26)
    leafCluster(mid, x, 184, 10 + (x % 7), { ramp: ramp('#1a3140', '#1f3d4a', '#24504c', '#2d6555'), wrap: true, seed: x });
  return [
    { img: back.toCanvas(), factor: 0.1 },
    { img: mid.toCanvas(), factor: 0.35 },
  ];
}

// ------------------------------------------------------------------ shrine

function shrineLayers(): Layer[] {
  const wall = new PixelBuf(VIEW_W, VIEW_H);
  const st = ramp('#2e2a40', '#3a3550', '#443e5c', '#4e4868', '#5a5476');
  for (let y = 0; y < VIEW_H; y++) {
    for (let x = 0; x < wall.w; x++) {
      const bh = 12;
      const bw = 24;
      const row = Math.floor(y / bh);
      const off = (row & 1) * 12;
      const lx = (x + off) % bw;
      const ly = y % bh;
      let v = 2 + Math.floor(hash2(Math.floor((x + off) / bw), row, 4) * 2);
      if (lx === 0 || ly === 0) v = 0;
      else if (ly === 1 || lx === 1) v += 1;
      else if (ly === bh - 1) v -= 1;
      wall.set(x, y, st[Math.max(0, Math.min(4, v))]);
    }
  }
  // tall arched windows with light
  for (const wx of [60, 168, 276]) {
    for (let y = 36; y < 150; y++) {
      for (let x = wx - 14; x <= wx + 14; x++) {
        const dy = y - 50;
        const inArch = y >= 50 ? true : (x - wx) * (x - wx) + dy * dy <= 14 * 14;
        if (!inArch) continue;
        const edge = Math.abs(x - wx) >= 13 || (y < 50 && (x - wx) * (x - wx) + dy * dy > 12 * 12);
        const t = (y - 36) / 114;
        const c = edge ? '#2e2a40' : t < 0.5 ? (bayer(x, y) > t * 2 ? '#fef8db' : '#d8ecc4') : bayer(x, y) > (t - 0.5) * 2 ? '#b8dcc0' : '#86b8a0';
        wall.set(x, y, packColor(c));
      }
    }
  }
  const pillars = new PixelBuf(480, VIEW_H);
  const pr = ramp('#3e3850', '#4e4760', '#5e5670', '#6e6682', '#807894', '#948ca6');
  for (let px = 40; px < pillars.w; px += 120) {
    for (let y = 0; y < VIEW_H; y++) {
      const capital = y < 30 && y > 18;
      const half = capital ? 14 : 10;
      for (let dx = -half; dx <= half; dx++) {
        const u = (dx + half) / (half * 2);
        let v = Math.round((1 - u) * 5);
        if (!capital && (dx === -4 || dx === 3)) v -= 2; // fluting
        if (capital && (y === 19 || y === 29)) v = 0;
        setWrap(pillars, px + dx, y, pr[Math.max(0, Math.min(5, v))]);
      }
    }
    // hanging vines
    for (let k = 0; k < 5; k++) {
      const vx = px - 12 + k * 6;
      const len = 30 + ((k * 37) % 50);
      for (let y = 0; y < len; y++) setWrap(pillars, vx + Math.round(Math.sin(y / 6 + k) * 1.5), y, packColor(y % 5 === 0 ? P.g5 : P.g3));
    }
  }
  return [
    { img: wall.toCanvas(), factor: 0.1 },
    { img: pillars.toCanvas(), factor: 0.4 },
  ];
}

// ------------------------------------------------------------------ hollow

function hollowLayers(): Layer[] {
  const back = new PixelBuf(VIEW_W * 2, VIEW_H);
  ditherGradient(back, 0, VIEW_H, ramp('#0f1822', '#142230', '#1a2c38', '#20363e', '#1a2c38'));
  farTrees(back, 51, 160, ['#16283a', '#1a3040', '#1f3a46', '#26464e', '#2e5256'], ['#16222e', '#1c2a36', '#22323c']);
  const mid = new PixelBuf(680, VIEW_H);
  const rng = new Rng(61);
  for (let x = 40; x < mid.w; x += rng.int(120, 190)) {
    trunk(mid, x, 0, VIEW_H, 12, 18, ramp('#1a1e2a', '#232838', '#2c3244', '#363c50'), rng.int(0, 99), 10);
  }
  // hanging thorny vines
  for (let x = 0; x < mid.w; x += rng.int(8, 22)) {
    const len = rng.int(20, 70);
    for (let y = 0; y < len; y++) {
      const vx = x + Math.round(Math.sin(y / 5 + x) * 2);
      setWrap(mid, vx, y, packColor(y % 7 === 3 ? '#6b3a4e' : '#2a2030'));
      if (y % 7 === 3) setWrap(mid, vx + 1, y - 1, packColor('#6b3a4e'));
    }
  }
  canopyCeiling(mid, 71, 34, ['#0f1a24', '#142430', '#1a3040', '#203c48', '#2a4a4c'], '#0c141c');
  return [
    { img: back.toCanvas(), factor: 0.12 },
    { img: mid.toCanvas(), factor: 0.4 },
  ];
}
