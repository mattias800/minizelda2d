import { Rect } from '../core/math';
import { TILE, Tile, TileMap } from './tilemap';

/**
 * An axis aligned body anchored at its feet: (x, y) is bottom-center.
 * Handles solid tiles, 45 degree slopes and one-way platforms.
 */
export class Body {
  vx = 0;
  vy = 0;
  onGround = false;
  hitWallLeft = false;
  hitWallRight = false;
  hitCeiling = false;
  /** Set for a few frames to fall through one-way platforms. */
  dropThrough = 0;

  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  get left(): number {
    return this.x - this.w / 2;
  }
  get right(): number {
    return this.x + this.w / 2;
  }
  get top(): number {
    return this.y - this.h;
  }
  rect(): Rect {
    return { x: this.left, y: this.top, w: this.w, h: this.h };
  }
}

/** How far a grounded body may step up / snap down per tick (for slopes). */
const STEP = 8;

export function moveBody(b: Body, map: TileMap): void {
  b.hitWallLeft = b.hitWallRight = b.hitCeiling = false;
  if (b.dropThrough > 0) b.dropThrough--;
  const wasGrounded = b.onGround;

  // ---- horizontal, pixel stepped
  let remaining = b.vx;
  while (remaining !== 0) {
    const step = Math.abs(remaining) < 1 ? remaining : Math.sign(remaining);
    const nx = b.x + step;
    if (blockedHorizontally(b, nx, map, wasGrounded)) {
      if (step > 0) b.hitWallRight = true;
      else b.hitWallLeft = true;
      b.vx = 0;
      break;
    }
    b.x = nx;
    remaining -= step;
  }

  // ---- vertical
  if (b.vy < 0) {
    const newTop = b.top + b.vy;
    const hitY = ceilingBetween(b, newTop, b.top, map);
    if (hitY !== null) {
      b.y = hitY + b.h;
      b.vy = 0;
      b.hitCeiling = true;
    } else {
      b.y += b.vy;
    }
    b.onGround = false;
  } else {
    const from = wasGrounded ? b.y - STEP : b.y;
    const snap = wasGrounded ? STEP : 0;
    const to = b.y + b.vy + snap;
    const surface = floorBetween(b, from, to, map);
    if (surface !== null) {
      b.y = surface;
      b.vy = 0;
      b.onGround = true;
    } else {
      b.y += b.vy;
      b.onGround = false;
    }
  }
}

function blockedHorizontally(b: Body, nx: number, map: TileMap, grounded: boolean): boolean {
  const left = nx - b.w / 2;
  const right = nx + b.w / 2;
  const top = b.top;
  const bottom = b.y - (grounded ? STEP : 1);
  const c0 = Math.floor(left / TILE);
  const c1 = Math.floor((right - 0.001) / TILE);
  const r0 = Math.floor(top / TILE);
  const r1 = Math.floor((bottom - 0.001) / TILE);
  // Rooms are closed by their edges unless a neighbouring room continues there;
  // the scene handles exits, so treat out of bounds as open here.
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      if (map.isSolid(cx, cy)) return true;
    }
  }
  return false;
}

function ceilingBetween(b: Body, newTop: number, oldTop: number, map: TileMap): number | null {
  const c0 = Math.floor(b.left / TILE);
  const c1 = Math.floor((b.right - 0.001) / TILE);
  const r0 = Math.floor(newTop / TILE);
  const r1 = Math.floor((oldTop - 0.001) / TILE);
  for (let cy = r1; cy >= r0; cy--) {
    for (let cx = c0; cx <= c1; cx++) {
      if (map.isSolid(cx, cy)) return (cy + 1) * TILE;
    }
  }
  return null;
}

/** Highest walkable surface y in [from, to] under the body, or null. */
function floorBetween(b: Body, from: number, to: number, map: TileMap): number | null {
  const c0 = Math.floor(b.left / TILE);
  const c1 = Math.floor((b.right - 0.001) / TILE);
  const r0 = Math.floor(from / TILE);
  const r1 = Math.floor(to / TILE);
  const centerCol = Math.floor(b.x / TILE);
  let best: number | null = null;
  const consider = (s: number) => {
    if (s >= from - 0.001 && s <= to && (best === null || s < best)) best = s;
  };
  for (let cy = r0; cy <= r1; cy++) {
    // Slopes are sampled only under the feet center, so corners don't catch.
    const cs = map.slopeSurfaceY(centerCol, cy, b.x);
    if (cs !== null) consider(cs);
    for (let cx = c0; cx <= c1; cx++) {
      const t = map.get(cx, cy);
      if (t === Tile.Solid || t === Tile.Bramble) {
        // A solid tile directly under a slope is its body, not a surface.
        const above = map.get(cx, cy - 1);
        if (map.isSlope(above)) continue;
        if (map.isSolid(cx, cy - 1)) continue;
        consider(cy * TILE);
      } else if (t === Tile.OneWay && b.dropThrough === 0) {
        const s = cy * TILE;
        if (from <= s + 0.001) consider(s);
      }
    }
  }
  return best;
}

/** True if the body stands on (or overlaps) thorn tiles. */
export function touchesTile(b: Body, map: TileMap, kind: Tile, inset = 2): boolean {
  const c0 = Math.floor((b.left + inset) / TILE);
  const c1 = Math.floor((b.right - inset) / TILE);
  const r0 = Math.floor((b.top + inset) / TILE);
  const r1 = Math.floor((b.y + 1) / TILE);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) if (map.get(cx, cy) === kind) return true;
  return false;
}

/** Is there ground right under point (px, py)? Used by patrolling AI to avoid ledges. */
export function groundAt(map: TileMap, px: number, py: number): boolean {
  const cx = Math.floor(px / TILE);
  const cy = Math.floor((py + 2) / TILE);
  const t = map.get(cx, cy);
  return t === Tile.Solid || t === Tile.Bramble || t === Tile.OneWay || map.isSlope(t) || map.isSlope(map.get(cx, cy - 1));
}
