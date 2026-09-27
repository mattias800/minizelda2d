import { hash2, valueNoise } from '../core/math';
import { Theme } from '../world/rooms';
import { TILE, Tile, TileMap } from '../world/tilemap';
import { PixelBuf, packColor } from './canvas';
import { cobble } from './paint';
import { P } from './palette';

/**
 * Paints a room's static terrain into a single bitmap. Everything is derived
 * from the collision map, so level edits never need new art.
 */

interface ThemeLook {
  grass: number[]; // dark -> light
  grassDepth: number;
  dirt: number[]; // dark -> light cobbles
  mortar: number;
  deep: number; // colour the dirt fades toward with depth
  cellW: number;
  cellH: number;
  bricks: boolean;
  foliage: boolean; // whole solid body is leaves (canopy)
}

const pk = (...hex: string[]) => hex.map((h) => packColor(h));

const LOOKS: Record<Theme, ThemeLook> = {
  forest: {
    grass: pk(P.g0, P.g1, P.g2, P.g3, P.g4, P.g5, P.g6, P.g7),
    grassDepth: 11,
    dirt: pk(P.d1, P.d2, P.d3, P.d4, P.d5, P.d6),
    mortar: packColor(P.d0),
    deep: packColor('#2c2a36'),
    cellW: 9,
    cellH: 7,
    bricks: false,
    foliage: false,
  },
  hollow: {
    grass: pk('#1a2c3a', '#1f3d4a', '#265049', '#2f6456', '#3b7b62', '#4f9470', '#6fb488', '#9ed4a0'),
    grassDepth: 9,
    dirt: pk('#3a3044', '#4a3e52', '#5c4c5e', '#6c5866', '#7c6670', '#8e7478'),
    mortar: packColor('#261f2e'),
    deep: packColor('#1b1824'),
    cellW: 9,
    cellH: 7,
    bricks: false,
    foliage: false,
  },
  cave: {
    grass: pk('#1a3140', '#1f3d4a', '#24504c', '#2d6555', '#3a7d5e', '#4f9a6c', '#6fbf84', '#98dca0'),
    grassDepth: 6,
    dirt: pk('#2e3040', '#3c3e50', '#4a4e61', '#5c5a6c', '#6e6a78', '#827c88'),
    mortar: packColor('#1e2030'),
    deep: packColor('#171a26'),
    cellW: 12,
    cellH: 9,
    bricks: false,
    foliage: false,
  },
  shrine: {
    grass: pk('#1f3d4a', '#2a5652', '#2f6b58', '#3a845f', '#48a864', '#5cbf70', '#86dd8e', '#b8ee9c'),
    grassDepth: 5,
    dirt: pk('#4e4760', '#5e5670', '#6e6682', '#807894', '#948ca6', '#aaa2ba'),
    mortar: packColor('#35304a'),
    deep: packColor('#27233a'),
    cellW: 16,
    cellH: 8,
    bricks: true,
    foliage: false,
  },
  canopy: {
    grass: pk(P.g0, P.g1, P.g2, P.g3, P.g4, P.g5, P.g6, P.g7),
    grassDepth: 99,
    dirt: pk(P.d1, P.d2, P.d3, P.d4, P.d5, P.d6),
    mortar: packColor(P.d0),
    deep: packColor(P.g0),
    cellW: 9,
    cellH: 7,
    bricks: false,
    foliage: true,
  },
};

/** 4x3 "leaf chevron" stamp; values are ramp offsets (higher = lighter). */
const LEAF = [
  [3, 2, 1, 0],
  [2, 2, 0, -1],
  [1, 0, -1, -2],
];

export function paintTerrain(map: TileMap, theme: Theme, seed: number): HTMLCanvasElement {
  const W = map.widthPx;
  const H = map.heightPx;
  const buf = new PixelBuf(W, H);
  const look = LOOKS[theme];

  // Ground mask, with the outside of the room treated as a continuation of
  // the edge so the painting doesn't get a fake rim at room borders.
  const ground = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) ground[y * W + x] = map.isGroundPixel(x, y) ? 1 : 0;
  const g = (x: number, y: number): number => {
    x = x < 0 ? 0 : x >= W ? W - 1 : x;
    if (y < 0) y = 0;
    if (y >= H) return 1;
    return ground[y * W + x];
  };

  // depth: ground pixels since the last air pixel above; under: air-distance below.
  const depth = new Uint16Array(W * H);
  const under = new Uint16Array(W * H);
  for (let x = 0; x < W; x++) {
    // Ground touching the top edge continues above the room: no grass there.
    let d = 0;
    for (let y = 0; y < H; y++) {
      if (!g(x, y)) d = 0;
      else if (y === 0 || d >= 200) d = 200;
      else d++;
      depth[y * W + x] = d;
    }
    let run = 100; // ground continues below the room
    for (let y = H - 1; y >= 0; y--) {
      run = g(x, y) ? run + 1 : 0;
      under[y * W + x] = run;
    }
  }

  // Side distance to air (horizontal), capped.
  const side = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!g(x, y)) continue;
      let s = 0;
      while (s < 6 && g(x - s - 1, y) && g(x + s + 1, y)) s++;
      side[y * W + x] = s;
    }
  }

  // Per-column grass thickness with hanging leaf tips.
  const grassT = new Uint8Array(W);
  for (let x = 0; x < W; x++) {
    const seg = Math.floor((x + 2) / 5);
    const within = (x + 2) % 5;
    const tip = 1 + Math.floor(hash2(seg, 7, seed) * 4);
    const tri = [0, 1, 2, 1, 0][within];
    grassT[x] = look.grassDepth + Math.min(tip, tri + 1) + (hash2(x, 3, seed) < 0.2 ? 1 : 0);
  }


  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ground[i]) continue;
      const d = depth[i];
      const s = side[i];
      const u = under[i];

      const bandT = grassT[x];
      const isGrass =
        look.foliage || (d <= bandT && d < 200) || (s < 2 && d <= bandT + 5 && d < 200 && look.grassDepth > 6);
      if (isGrass) {
        buf.set(x, y, grassPixel(x, y, d, s, u, look, seed));
        continue;
      }

      // Soil / rock. Cobbles get darker the deeper they sit below the surface.
      const below = d >= 200 ? 12 : d - bandT;
      let c = look.bricks ? brickPixel(x, y, look, seed) : cobblePixel(x, y, below, look, seed);
      // shadow cast by the grass lip
      if (!look.foliage && below >= 0 && below <= 1) c = look.mortar;
      // rim on exposed side faces and undersides
      if (s === 0 || (u <= 1 && y < H - 1)) c = look.mortar;
      buf.set(x, y, c);
    }
  }

  paintUndersides(buf, map, look, seed, g);
  paintTufts(buf, look, seed, g, W, H);
  paintSpecialTiles(buf, map, theme, seed);
  return buf.toCanvas();
}

function grassPixel(x: number, y: number, d: number, s: number, u: number, look: ThemeLook, seed: number): number {
  const row = Math.floor(y / 3);
  const off = (row & 1) * 2 + Math.floor(hash2(row, Math.floor(x / 16), seed) * 2);
  const lx = (x + off) & 3;
  const ly = y % 3;
  const n = hash2(Math.floor((x + off) / 4), row, seed + 5);
  let v = LEAF[ly][lx] + (n < 0.25 ? 1 : n > 0.8 ? -1 : 0);
  // Light from above: top rows brightest, deeper rows darker.
  let base: number;
  if (look.foliage) {
    // leaf clump: lit top, dark underside
    base = 5 - Math.min(4, d / 4) + Math.min(1.5, u / 6) - 1.5;
    base += valueNoise(x / 9, y / 7, seed) * 1.5 - 0.5;
  } else {
    base = 5.2 - (d / look.grassDepth) * 3.2;
  }
  if (s === 0) v -= 1;
  if (d <= 1) v += 1;
  if (u <= 1) return look.grass[0];
  return look.grass[Math.max(0, Math.min(look.grass.length - 1, Math.round(base + v * 0.8)))];
}

function cobblePixel(x: number, y: number, below: number, look: ThemeLook, seed: number): number {
  const c = cobble(x, y, look.cellW, look.cellH, seed);
  // depth of the cobble's centre (constant across the cobble)
  const cellBelow = below - (y - c.cy);
  const dark = Math.max(0, Math.floor((cellBelow + 4) / 14));
  const n = look.dirt.length;
  if (c.edge < 0.1) return dark >= 2 ? look.mortar : look.dirt[0];
  let t = n - 2 - Math.floor(c.id * 2.2) - dark; // lighter near the surface
  const light = -(c.dx * 0.6 + c.dy);
  if (light > 0.3) t += 1;
  else if (light < -0.32 || (c.edge < 0.2 && c.dy > 0)) t -= 1;
  if (t < 0) return look.mortar;
  return look.dirt[Math.min(n - 1, t)];
}

function brickPixel(x: number, y: number, look: ThemeLook, seed: number): number {
  const bh = look.cellH;
  const bw = look.cellW;
  const row = Math.floor(y / bh);
  const off = (row & 1) * (bw / 2);
  const col = Math.floor((x + off) / bw);
  const lx = (x + off) % bw;
  const ly = y % bh;
  if (lx === 0 || ly === 0) return look.mortar;
  const id = hash2(col, row, seed);
  let t = 2 + Math.floor(id * 3);
  if (ly === 1 || lx === 1) t += 1;
  if (ly === bh - 1 || lx === bw - 1) t -= 1;
  // cracks
  const cr = hash2(col, row, seed + 9);
  if (cr < 0.18 && Math.abs(lx - (3 + ((ly * 3) % 7))) < 1) t = 0;
  // speckle
  if (hash2(x, y, seed + 3) < 0.06) t -= 1;
  return look.dirt[Math.max(0, Math.min(look.dirt.length - 1, t))];
}

/** Hanging roots / moss / leaves under overhangs. */
function paintUndersides(
  buf: PixelBuf,
  map: TileMap,
  look: ThemeLook,
  seed: number,
  g: (x: number, y: number) => number,
): void {
  const W = map.widthPx;
  const H = map.heightPx;
  for (let x = 0; x < W; x++) {
    for (let y = 1; y < H - 1; y++) {
      if (!(g(x, y) && !g(x, y + 1))) continue;
      const h = hash2(x, y, seed + 11);
      if (look.foliage) {
        // leafy fringe
        const len = 1 + Math.floor(hash2(Math.floor(x / 3), y, seed) * 3);
        for (let k = 1; k <= len; k++) buf.set(x, y + k, k === len ? look.grass[1] : look.grass[2]);
      } else if (look.grassDepth <= 6 && h < 0.35) {
        // moss drips / stalactites in caves
        const len = 2 + Math.floor(hash2(x, y, seed + 12) * 6);
        for (let k = 1; k <= len; k++) buf.set(x, y + k, k < len / 2 ? look.mortar : look.grass[2 + (k & 1)]);
      } else if (h < 0.12) {
        // roots
        const len = 3 + Math.floor(hash2(x, y, seed + 13) * 7);
        let rx = x;
        for (let k = 1; k <= len; k++) {
          if (hash2(x, k, seed) < 0.25) rx += hash2(k, x, seed) < 0.5 ? -1 : 1;
          if (!g(rx, y + k)) buf.set(rx, y + k, look.dirt[0]);
        }
      }
    }
  }
}

/** Grass blades poking above surfaces. */
function paintTufts(
  buf: PixelBuf,
  look: ThemeLook,
  seed: number,
  g: (x: number, y: number) => number,
  W: number,
  H: number,
): void {
  for (let x = 0; x < W; x++) {
    for (let y = 1; y < H; y++) {
      if (!(g(x, y) && !g(x, y - 1))) continue;
      const h = hash2(x, y, seed + 21);
      const seg = hash2(Math.floor(x / 3), y, seed + 22);
      const hgt = seg < 0.45 ? 1 : seg < 0.8 ? 2 : 0;
      for (let k = 1; k <= hgt; k++) {
        if (h < 0.3 && k === hgt) continue;
        buf.set(x, y - k, look.grass[k === hgt ? 6 : 5]);
      }
    }
  }
}

function paintSpecialTiles(buf: PixelBuf, map: TileMap, theme: Theme, seed: number): void {
  const plankLight = packColor(theme === 'shrine' ? '#aaa2ba' : P.b5);
  const plankMid = packColor(theme === 'shrine' ? '#807894' : P.b3);
  const plankDark = packColor(theme === 'shrine' ? '#4e4760' : P.b1);
  const leaf = [packColor(P.g2), packColor(P.g4), packColor(P.g6)];
  const thornD = packColor('#3b2436');
  const thornM = packColor('#6b3a4e');
  const thornL = packColor('#b0627a');
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      const t = map.get(cx, cy);
      const x0 = cx * TILE;
      const y0 = cy * TILE;
      if (t === Tile.OneWay) {
        // a branch / slab: 5px tall
        for (let x = 0; x < TILE; x++) {
          const wob = hash2(cx * TILE + x, 1, seed) < 0.15 ? 1 : 0;
          buf.set(x0 + x, y0, plankLight);
          buf.set(x0 + x, y0 + 1, plankMid);
          buf.set(x0 + x, y0 + 2, hash2(x0 + x, 2, seed) < 0.2 ? plankDark : plankMid);
          buf.set(x0 + x, y0 + 3, plankMid);
          buf.set(x0 + x, y0 + 4, plankDark);
          if (wob) buf.set(x0 + x, y0 + 5, plankDark);
          if (theme !== 'shrine' && hash2(x0 + x, 5, seed) < 0.3) {
            const l = Math.floor(hash2(x0 + x, 6, seed) * 3);
            buf.set(x0 + x, y0 - 1, leaf[l]);
            if (l > 0) buf.set(x0 + x, y0 + 5, leaf[l - 1]);
          }
        }
        if (map.get(cx - 1, cy) !== Tile.OneWay) for (let y = 0; y < 5; y++) buf.set(x0, y0 + y, plankDark);
        if (map.get(cx + 1, cy) !== Tile.OneWay) for (let y = 0; y < 5; y++) buf.set(x0 + TILE - 1, y0 + y, plankDark);
      } else if (t === Tile.Thorns) {
        for (let k = 0; k < 4; k++) {
          const bx = x0 + k * 4 + Math.floor(hash2(cx, k, seed) * 2);
          const h = 6 + Math.floor(hash2(cx, k + 9, seed) * 6);
          for (let yy = 0; yy < h; yy++) {
            const wdt = Math.max(0, Math.floor(((h - yy) / h) * 2.5));
            for (let xx = -wdt; xx <= wdt; xx++) {
              const c = xx === -wdt && yy > 1 ? thornL : xx === wdt ? thornD : thornM;
              buf.set(bx + xx + 1, y0 + TILE - 1 - yy, c);
            }
          }
        }
        // vines
        for (let x = 0; x < TILE; x++) {
          const vy = y0 + 9 + Math.round(Math.sin((x0 + x) / 3) * 2);
          buf.set(x0 + x, vy, thornD);
          buf.set(x0 + x, vy + 1, thornM);
        }
      }
    }
  }
}
