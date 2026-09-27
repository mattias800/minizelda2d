import { PixelBuf, packColor } from './canvas';
import { Palette, Sprite, addOutline } from './sprite';

/**
 * Pixel-exact drawing primitives (no anti-aliasing) for building sprites in
 * code. Colours are hex strings; everything lands on an integer grid.
 */
export class Painter {
  readonly buf: PixelBuf;
  private cache = new Map<string, number>();
  constructor(w: number, h: number) {
    this.buf = new PixelBuf(w, h);
  }

  private c(hex: string): number {
    let v = this.cache.get(hex);
    if (v === undefined) {
      v = packColor(hex);
      this.cache.set(hex, v);
    }
    return v;
  }

  px(x: number, y: number, hex: string): void {
    this.buf.set(Math.round(x), Math.round(y), this.c(hex));
  }

  rect(x: number, y: number, w: number, h: number, hex: string): void {
    this.buf.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), this.c(hex));
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, hex: string): void {
    const c = this.c(hex);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.buf.set(x, y, c);
      }
    }
  }

  /** Thick line with square-ish caps. */
  line(x0: number, y0: number, x1: number, y1: number, hex: string, thick = 1): void {
    const c = this.c(hex);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const r = (thick - 1) / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      for (let oy = -Math.floor(r); oy <= Math.ceil(r); oy++)
        for (let ox = -Math.floor(r); ox <= Math.ceil(r); ox++) this.buf.set(Math.round(x + ox), Math.round(y + oy), c);
    }
  }

  /** Filled polygon (even-odd scanline). */
  poly(pts: [number, number][], hex: string): void {
    const c = this.c(hex);
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.buf.set(x, y, c);
    }
  }

  /** Stamps a character grid (see spriteFromGrid) with its top-left at (x, y). */
  grid(rows: string[], pal: Palette, x: number, y: number, flip = false): void {
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.' || ch === ' ') continue;
        const hex = pal[ch];
        if (!hex) throw new Error(`Unknown palette key '${ch}'`);
        const px = flip ? x + (w - 1 - rx) : x + rx;
        this.buf.set(Math.round(px), Math.round(y + ry), this.c(hex));
      }
    });
  }

  /** Recolours already painted pixels inside a region matching `from`. */
  swap(from: string, to: string): void {
    const f = this.c(from);
    const t = this.c(to);
    const d = this.buf.data;
    for (let i = 0; i < d.length; i++) if (d[i] === f) d[i] = t;
  }

  toSprite(ax: number, ay: number, outline: 'sel' | string | false = 'sel'): Sprite {
    if (outline) addOutline(this.buf, outline);
    return new Sprite(this.buf.toCanvas(), ax, ay);
  }
}
