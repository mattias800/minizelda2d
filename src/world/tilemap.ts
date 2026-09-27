export const TILE = 16;

export const enum Tile {
  Empty = 0,
  Solid = 1,
  /** 45 degree slope whose surface rises to the right: floor at bottom-left, top-right. */
  SlopeUp = 2,
  /** 45 degree slope whose surface falls to the right. */
  SlopeDown = 3,
  /** Can be jumped through from below and dropped through with down+jump. */
  OneWay = 4,
  /** Solid until burned (owned by a Bramble entity; not painted by the terrain renderer). */
  Bramble = 5,
  /** Hurts on contact. */
  Thorns = 6,
}

export class TileMap {
  readonly tiles: Uint8Array;
  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.tiles = new Uint8Array(cols * rows);
  }

  get widthPx(): number {
    return this.cols * TILE;
  }
  get heightPx(): number {
    return this.rows * TILE;
  }

  get(cx: number, cy: number): Tile {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return Tile.Empty;
    return this.tiles[cy * this.cols + cx] as Tile;
  }

  set(cx: number, cy: number, t: Tile): void {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return;
    this.tiles[cy * this.cols + cx] = t;
  }

  /** Full blocking tiles for horizontal movement and ceilings. */
  isSolid(cx: number, cy: number): boolean {
    const t = this.get(cx, cy);
    return t === Tile.Solid || t === Tile.Bramble;
  }

  isSlope(t: Tile): boolean {
    return t === Tile.SlopeUp || t === Tile.SlopeDown;
  }

  /**
   * Returns the floor height (pixel y) of a slope tile at pixel x, or null
   * if the tile is not a slope.
   */
  slopeSurfaceY(cx: number, cy: number, px: number): number | null {
    const t = this.get(cx, cy);
    if (!this.isSlope(t)) return null;
    const lx = Math.max(0, Math.min(TILE, px - cx * TILE));
    const top = cy * TILE;
    return t === Tile.SlopeUp ? top + (TILE - lx) : top + lx;
  }

  /** True if pixel (px, py) is inside something the terrain renderer paints as ground. */
  isGroundPixel(px: number, py: number): boolean {
    const cx = Math.floor(px / TILE);
    const cy = Math.floor(py / TILE);
    const t = this.get(cx, cy);
    if (t === Tile.Solid) return true;
    if (t === Tile.SlopeUp || t === Tile.SlopeDown) {
      const s = this.slopeSurfaceY(cx, cy, px + 0.5)!;
      return py + 0.5 >= s;
    }
    return false;
  }
}
