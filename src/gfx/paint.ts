import { Rng, bayer, hash2, valueNoise } from '../core/math';
import { PixelBuf, packColor } from './canvas';

/** Procedural painting helpers shared by backgrounds and props. */

export type Ramp = number[];
export const ramp = (...hex: string[]): Ramp => hex.map((h) => packColor(h));

/** Writes with horizontal wrap-around, for seamlessly repeating layers. */
export function setWrap(buf: PixelBuf, x: number, y: number, c: number): void {
  const w = buf.w;
  buf.set(((Math.round(x) % w) + w) % w, y, c);
}

const LEAF = [
  [2, 1, 1, 0],
  [1, 1, 0, -1],
  [0, 0, -1, -1],
];

export interface ClusterOpts {
  ramp: Ramp;
  /** Base brightness offset (0 = middle of ramp). */
  bias?: number;
  /** Outline/gap colour painted under the cluster's lower rim. */
  rim?: number;
  wrap?: boolean;
  seed?: number;
  /** 0..1 how strong the leaf chevron texture is. */
  texture?: number;
}

/**
 * Paints one leaf cluster: a jagged disc lit from the top-left with a chevron
 * leaf texture. Overlapping clusters painted top-to-bottom produce the dense,
 * clumpy foliage seen in the reference.
 */
export function leafCluster(buf: PixelBuf, cx: number, cy: number, r: number, o: ClusterOpts): void {
  const seed = o.seed ?? 1;
  const n = o.ramp.length;
  const tex = o.texture ?? 1;
  const set = o.wrap ? (x: number, y: number, c: number) => setWrap(buf, x, y, c) : (x: number, y: number, c: number) => buf.set(x, y, c);
  const R = Math.ceil(r + 3);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      const ang = Math.atan2(dy, dx);
      // jagged leafy edge: small triangular teeth around the rim
      const tooth = Math.abs(((ang / (Math.PI * 2)) * Math.max(8, r * 1.6) + hash2(Math.round(cx), Math.round(cy), seed)) % 1 - 0.5) * 2;
      const rr = r * (0.92 + 0.08 * valueNoise(ang * 3 + cx, cy, seed)) + tooth * 2.2 - 1;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > rr) {
        if (o.rim !== undefined && d <= rr + 1.5 && dy > r * 0.2) set(x, y, o.rim);
        continue;
      }
      const nx = dx / r;
      const ny = dy / r;
      const light = -(nx * 0.55 + ny * 0.85); // -1..1
      const row = Math.floor(y / 3);
      const lx = (x + (row & 1) * 2) & 3;
      const ly = ((y % 3) + 3) % 3;
      let v = (n - 1) / 2 + (o.bias ?? 0) + light * (n / 2.6) + LEAF[ly][lx] * 0.9 * tex;
      if (hash2(Math.floor(x / 4), row, seed) < 0.15) v += 1;
      // soft ordered dither between steps
      v += (bayer(x, y) - 0.5) * 0.6;
      set(x, y, o.ramp[Math.max(0, Math.min(n - 1, Math.round(v)))]);
    }
  }
}

/** A puffy cumulus cloud bank made of overlapping discs with a flat, shaded base. */
export function cloudBank(
  buf: PixelBuf,
  x0: number,
  baseY: number,
  width: number,
  height: number,
  colors: { light: number; mid: number; shade: number },
  rng: Rng,
  wrap = true,
): void {
  const puffs: { x: number; y: number; r: number }[] = [];
  let x = x0;
  while (x < x0 + width) {
    const r = rng.range(height * 0.35, height * 0.75);
    puffs.push({ x, y: baseY - r * rng.range(0.5, 0.9), r });
    x += r * rng.range(0.7, 1.2);
  }
  const set = (px: number, py: number, c: number) => (wrap ? setWrap(buf, px, py, c) : buf.set(px, py, c));
  for (const p of puffs) {
    const R = Math.ceil(p.r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > p.r * p.r) continue;
        const py = Math.round(p.y + dy);
        if (py > baseY) continue;
        const shadeT = (py - (baseY - height * 0.35)) / (height * 0.35);
        const lit = -(dx / p.r) * 0.4 - (dy / p.r) * 0.8;
        let c = colors.mid;
        if (lit > 0.35) c = colors.light;
        if (shadeT > bayer(Math.round(p.x + dx), py) * 1.2 + 0.1) c = colors.shade;
        set(Math.round(p.x + dx), py, c);
      }
    }
  }
}

/**
 * A tapered, gently swaying trunk with vertical bark stripes. Light from the
 * left. `ramp` is dark -> light.
 */
export function trunk(
  buf: PixelBuf,
  cx: number,
  top: number,
  bottom: number,
  wTop: number,
  wBottom: number,
  bark: Ramp,
  seed: number,
  sway = 6,
  wrap = true,
): void {
  const n = bark.length;
  const set = (px: number, py: number, c: number) => (wrap ? setWrap(buf, px, py, c) : buf.set(px, py, c));
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    const w = wTop + (wBottom - wTop) * t * t;
    const center = cx + Math.sin(t * 2.6 + seed) * sway * (1 - t * 0.5);
    const flare = t > 0.85 ? (t - 0.85) * 60 : 0;
    const half = w / 2 + flare;
    for (let x = Math.floor(center - half); x <= Math.ceil(center + half); x++) {
      const u = (x - (center - half)) / (half * 2); // 0..1 across
      let v = (1 - u) * (n - 1) * 0.95; // light on the left
      const stripe = Math.sin(u * 9 + Math.sin(y / 11 + seed) * 2.2 + seed);
      if (stripe > 0.75) v -= 1.2;
      if (hash2(x, Math.floor(y / 3), seed) < 0.05) v -= 1;
      v += (bayer(x, y) - 0.5) * 0.8;
      set(x, y, bark[Math.max(0, Math.min(n - 1, Math.round(v)))]);
    }
  }
}

/** Fills a vertical gradient using ordered dithering between ramp steps. */
export function ditherGradient(buf: PixelBuf, y0: number, y1: number, rampTopToBottom: Ramp): void {
  const n = rampTopToBottom.length - 1;
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / Math.max(1, y1 - y0)) * n;
    for (let x = 0; x < buf.w; x++) {
      const i = Math.min(n, Math.floor(t + bayer(x, y) - 0.5 + 0.5));
      buf.set(x, y, rampTopToBottom[Math.max(0, i)]);
    }
  }
}

export interface CobbleSample {
  /** Distance to the cell border (small = mortar). */
  edge: number;
  /** Offset from the cell centre, normalised to the cell size. */
  dx: number;
  dy: number;
  /** Stable random id of the cell, 0..1. */
  id: number;
  /** Pixel y of the cell centre. */
  cy: number;
}

/** Jittered, row-staggered Voronoi cells: irregular cobbles / rocks. */
export function cobble(x: number, y: number, cw: number, ch: number, seed: number): CobbleSample {
  const gy = Math.floor(y / ch);
  const gx = Math.floor((x + (gy & 1) * (cw / 2)) / cw);
  let best = 1e9;
  let second = 1e9;
  const out: CobbleSample = { edge: 0, dx: 0, dy: 0, id: 0, cy: 0 };
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const ro = (cy & 1) * (cw / 2);
      const sx = cx * cw - ro + cw * (0.25 + 0.5 * hash2(cx, cy, seed));
      const sy = cy * ch + ch * (0.25 + 0.5 * hash2(cx, cy, seed + 1));
      const dx = (x - sx) / cw;
      const dy = (y - sy) / ch;
      const dist = dx * dx + dy * dy;
      if (dist < best) {
        second = best;
        best = dist;
        out.dx = dx;
        out.dy = dy;
        out.cy = sy;
        out.id = hash2(cx, cy, seed + 2);
      } else if (dist < second) second = dist;
    }
  }
  out.edge = Math.sqrt(second) - Math.sqrt(best);
  return out;
}
