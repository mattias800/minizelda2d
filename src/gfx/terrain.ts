import { hash2, valueNoise } from '../core/math';
import { Theme } from '../world/rooms';
import { TILE, Tile, TileMap } from '../world/tilemap';
import { PixelBuf, packColor } from './canvas';
import { cobble, leafCluster, ramp } from './paint';
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
  const leafy = (x: number, y: number) => map.isFoliage(Math.floor(x / TILE), Math.floor(y / TILE));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) ground[y * W + x] = map.isGroundPixel(x, y) && (look.foliage || !leafy(x, y)) ? 1 : 0;
  const g = (x: number, y: number): number => {
    x = x < 0 ? 0 : x >= W ? W - 1 : x;
    if (y < 0) y = 0;
    if (y >= H) return 1;
    return ground[y * W + x];
  };

  // Thorn tiles count as cover for depth, so no grass grows underneath them.
  const thorn = (x: number, y: number) => map.get(Math.floor(x / TILE), Math.floor(y / TILE)) === Tile.Thorns;

  // depth: ground pixels since the last air pixel above; under: air-distance below.
  const depth = new Uint16Array(W * H);
  const under = new Uint16Array(W * H);
  for (let x = 0; x < W; x++) {
    // Ground touching the top edge continues above the room: no grass there.
    let d = 0;
    for (let y = 0; y < H; y++) {
      if (!g(x, y) && !thorn(x, y)) d = 0;
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


  if (look.foliage) {
    paintFoliage(buf, map, ground, side, depth, under, seed, (cx, cy) => map.get(cx, cy) === Tile.Solid);
    paintSpecialTiles(buf, map, theme, seed);
    return buf.toCanvas();
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
  if (map.foliage.includes(1)) paintFoliage(buf, map, null, null, null, null, seed, (cx, cy) => map.isFoliage(cx, cy));
  return buf.toCanvas();
}

/** Canopy rooms: solid tiles become rounded masses of overlapping leaf clusters. */
function paintFoliage(
  buf: PixelBuf,
  map: TileMap,
  ground: Uint8Array | null,
  side: Uint8Array | null,
  depth: Uint16Array | null,
  under: Uint16Array | null,
  seed: number,
  isLeaf: (cx: number, cy: number) => boolean,
): void {
  const core = packColor(P.g1);
  if (ground && side && depth && under) {
    for (let i = 0; i < ground.length; i++)
      if (ground[i] && side[i] >= 3 && depth[i] >= 4 && under[i] >= 4) buf.data[i] = core;
  } else {
    // fill tile interiors so gaps between clusters stay dark
    for (let cy = 0; cy < map.rows; cy++)
      for (let cx = 0; cx < map.cols; cx++)
        if (isLeaf(cx, cy)) buf.fillRect(cx * TILE + 3, cy * TILE + 3, TILE - 6, TILE - 6, core);
  }
  const leaves = ramp(P.navy, P.g1, P.g2, P.g3, P.g4, P.g5, P.g6, P.g7);
  const rim = packColor(P.navy);
  const clusters: { x: number; y: number; r: number }[] = [];
  for (let cy = 0; cy < map.rows; cy++)
    for (let cx = 0; cx < map.cols; cx++) {
      if (!isLeaf(cx, cy)) continue;
      for (let k = 0; k < 2; k++) {
        clusters.push({
          x: cx * TILE + 3 + hash2(cx, cy * 2 + k, seed) * 10,
          y: cy * TILE + 3 + hash2(cx * 3 + k, cy, seed) * 10,
          r: 8 + hash2(cx + k, cy + 7, seed) * 3,
        });
      }
    }
  clusters.sort((a, b) => a.y - b.y);
  for (const c of clusters) leafCluster(buf, c.x, c.y, c.r, { ramp: leaves, rim, seed: Math.round(c.x * 7 + c.y), bias: ground ? -0.2 : -0.7 });
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
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      const t = map.get(cx, cy);
      if (t === Tile.OneWay) paintPlatform(buf, map, cx, cy, theme, seed);
      else if (t === Tile.Thorns) paintThorns(buf, cx, cy, seed);
    }
  }
}

/** One-way platforms: branches outdoors, slabs in the shrine, planks elsewhere. */
function paintPlatform(buf: PixelBuf, map: TileMap, cx: number, cy: number, theme: Theme, seed: number): void {
  const x0 = cx * TILE;
  const y0 = cy * TILE;
  const leftEnd = map.get(cx - 1, cy) !== Tile.OneWay;
  const rightEnd = map.get(cx + 1, cy) !== Tile.OneWay;
  if (theme === 'shrine') {
    const c = [packColor('#aaa2ba'), packColor('#948ca6'), packColor('#6e6682'), packColor('#4e4760')];
    for (let x = 0; x < TILE; x++)
      for (let y = 0; y < 6; y++) {
        let v = y === 0 ? 0 : y < 3 ? 1 : y < 5 ? 2 : 3;
        if ((x0 + x) % 16 === 0 && y > 0) v = 3;
        buf.set(x0 + x, y0 + y, c[v]);
      }
    return;
  }
  const outdoor = theme === 'forest' || theme === 'canopy';
  const bark = outdoor
    ? [packColor(P.b1), packColor(P.b2), packColor(P.b3), packColor(P.b4), packColor(P.b5)]
    : [packColor('#3a2a2e'), packColor('#5a3e3a'), packColor('#7a5446'), packColor('#946a54'), packColor('#b08868')];
  const leaf = [packColor(P.g2), packColor(P.g3), packColor(P.g4), packColor(P.g5), packColor(P.g6)];
  for (let x = 0; x < TILE; x++) {
    const wx = x0 + x;
    // a gently wavy branch, 5-6px thick, thinner toward free ends
    const wave = outdoor ? Math.round(Math.sin(wx / 9 + seed) * 0.8) : 0;
    let thick = outdoor ? 6 : 5;
    if (outdoor && leftEnd && x < 5) thick -= Math.ceil((5 - x) / 2);
    if (outdoor && rightEnd && x > 10) thick -= Math.ceil((x - 10) / 2);
    for (let y = 0; y < thick; y++) {
      let v = y === 0 ? 4 : y === 1 ? 3 : y < thick - 1 ? 2 : 0;
      if (!outdoor && hash2(wx >> 3, y, seed) < 0.1) v = 1; // plank seams
      if (outdoor && hash2(wx, y, seed + 4) < 0.08) v = Math.max(0, v - 1);
      if (!outdoor && wx % 16 === 0) v = 0;
      buf.set(wx, y0 + y + wave, bark[v]);
    }
    if (outdoor) {
      // leaf tufts sprouting along the branch
      const h = hash2(Math.floor(wx / 5), cy, seed + 8);
      if (h < 0.45) {
        const len = 1 + Math.floor(h * 6);
        for (let k = 1; k <= len; k++) buf.set(wx, y0 - k + wave, leaf[Math.min(4, 1 + k)]);
      }
      if (hash2(wx, cy, seed + 9) < 0.18) buf.set(wx, y0 + thick + wave, leaf[1]);
    }
  }
}

/** Thorny bramble spikes filling a hazard tile. */
function paintThorns(buf: PixelBuf, cx: number, cy: number, seed: number): void {
  const x0 = cx * TILE;
  const y0 = cy * TILE;
  const dark = packColor('#2a1a28');
  const mid = packColor('#5a3048');
  const lite = packColor('#8a4a64');
  const tip = packColor('#f0c8d0');
  // tangled base
  for (let x = 0; x < TILE; x++)
    for (let y = 10; y < TILE; y++) buf.set(x0 + x, y0 + y, hash2(x0 + x, y, seed) < 0.3 ? mid : dark);
  // spikes
  for (let k = 0; k < 5; k++) {
    const bx = x0 + 1 + k * 3 + Math.floor(hash2(cx, k, seed) * 2);
    const h = 8 + Math.floor(hash2(cx, k + 9, seed) * 6);
    const lean = hash2(cx, k + 3, seed) < 0.5 ? -1 : 1;
    for (let yy = 0; yy < h; yy++) {
      const px = bx + Math.round((yy / h) * lean * 2);
      const py = y0 + TILE - 1 - yy;
      const wdt = yy < h * 0.4 ? 1 : 0;
      buf.set(px, py, yy > h - 3 ? tip : lite);
      if (wdt) buf.set(px + 1, py, mid);
    }
  }
}
