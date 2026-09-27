import { Rng, hash2 } from '../core/math';
import { PixelBuf, packColor } from './canvas';

/** Procedural painting helpers shared by backgrounds and props. */

export type Ramp = number[];
export const ramp = (...hex: string[]): Ramp => hex.map((h) => packColor(h));

/** Writes with horizontal wrap-around, for seamlessly repeating layers. */
export function setWrap(buf: PixelBuf, x: number, y: number, c: number): void {
  const w = buf.w;
  buf.set(((Math.round(x) % w) + w) % w, y, c);
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
        const px = Math.round(p.x + dx);
        // flat, slightly wavy shadow band along the cloud base
        const shadeLine = baseY - height * 0.3 + Math.round(Math.sin(px / 7) * 1.5);
        const lit = -(dx / p.r) * 0.4 - (dy / p.r) * 0.8;
        let c = colors.mid;
        if (lit > 0.35) c = colors.light;
        if (py > shadeLine) c = colors.shade;
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
      set(x, y, bark[Math.max(0, Math.min(n - 1, Math.round(v)))]);
    }
  }
}

/** Fills a vertical gradient as clean flat bands (no dithering, like the reference). */
export function ditherGradient(buf: PixelBuf, y0: number, y1: number, rampTopToBottom: Ramp): void {
  const n = rampTopToBottom.length - 1;
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / Math.max(1, y1 - y0)) * n;
    for (let x = 0; x < buf.w; x++) {
      const i = Math.min(n, Math.floor(t + 0.5));
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

export interface ClumpOpts {
  /** Dark -> light. Index 0 is the deep shadow, the last entry is a pale glint. */
  ramp: Ramp;
  seed?: number;
  wrap?: boolean;
  /** Shift the overall brightness (in ramp steps). */
  bias?: number;
  /** Leaf chevron spacing; larger = bigger leaves. */
  leaf?: number;
  /** Chance a lit leaf becomes a pale glint. */
  glint?: number;
}

/**
 * A clump of foliage in the reference's style. The clump is tiled with small,
 * diagonally drooping leaf cells; each leaf takes one flat colour from the
 * clump's lighting (top-left lit) plus a little variation, and gets a darker
 * underside, so individual leaves read as clean 2-4px shapes. Leaves whose
 * centre falls outside the clump are dropped, giving a naturally ragged edge.
 */
export function leafClump(buf: PixelBuf, cx: number, cy: number, r: number, o: ClumpOpts): void {
  const seed = o.seed ?? 1;
  const R = o.ramp;
  const n = R.length;
  const bias = o.bias ?? 0;
  const size = o.leaf ?? 6;
  const set = o.wrap ? (x: number, y: number, c: number) => setWrap(buf, x, y, c) : (x: number, y: number, c: number) => buf.set(x, y, c);
  const Ri = Math.ceil(r + 3);
  for (let dy = -Ri; dy <= Ri; dy++)
    for (let dx = -Ri; dx <= Ri; dx++) {
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      // leaves fan outward: drooping down-left on the left half, down-right on the right
      const ang = dx < 0 ? -0.6 : 0.6;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      // leaf lattice in a rotated frame so leaves droop down-right
      const u = x * ca + y * sa;
      const v = -x * sa + y * ca;
      const cell = cobble(u, v, size, size * 0.55, seed + (dx < 0 ? 17 : 0));
      const lcu = u - cell.dx * size;
      const lcv = v - cell.dy * size * 0.55;
      const lx = lcu * ca - lcv * sa - cx; // leaf centre relative to the clump
      const ly = lcu * sa + lcv * ca - cy;
      const d2 = lx * lx + ly * ly;
      const lim = ly > 0 ? r + 1.5 : r;
      if (d2 > lim * lim) continue;
      const light = -((lx / r) * 0.55 + (ly / r) * 0.85);
      let val = 2.1 + light * 2.1 + bias + (cell.id - 0.5) * 1.8;
      // underside of each leaf is darker, the upper-left rim a touch lighter
      if (cell.edge < 0.2 && cell.dy > 0) val -= 1.4;
      else if (cell.edge < 0.2 && cell.dy < -0.1) val += 0.7;
      const glint = light > 0.3 && cell.id > 1 - (o.glint ?? 0.05) && cell.dy < 0.15;
      val = glint ? n - 1 : Math.min(n - 2, val);
      set(x, y, R[Math.max(0, Math.min(n - 1, Math.round(val)))]);
    }
}
