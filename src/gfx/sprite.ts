import { Ctx, PixelBuf, makeCanvas, packColor, unpack } from './canvas';

/** A bitmap with an anchor point (usually bottom-center: the feet). */
export class Sprite {
  private flippedImg: HTMLCanvasElement | null = null;
  constructor(
    readonly img: HTMLCanvasElement,
    /** Anchor x, in sprite pixels. */
    readonly ax: number,
    /** Anchor y, in sprite pixels. */
    readonly ay: number,
  ) {}
  get w(): number {
    return this.img.width;
  }
  get h(): number {
    return this.img.height;
  }
  private flipped(): HTMLCanvasElement {
    if (!this.flippedImg) {
      const { canvas, ctx } = makeCanvas(this.w, this.h);
      ctx.translate(this.w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, 0, 0);
      this.flippedImg = canvas;
    }
    return this.flippedImg;
  }
  /** Draws with the anchor at (x, y). `flip` mirrors around the anchor. */
  draw(ctx: Ctx, x: number, y: number, flip = false): void {
    if (flip) ctx.drawImage(this.flipped(), Math.round(x - (this.w - this.ax)), Math.round(y - this.ay));
    else ctx.drawImage(this.img, Math.round(x - this.ax), Math.round(y - this.ay));
  }
}

export type Palette = Record<string, string>;

export interface GridOptions {
  /** Auto-outline colour mode: 'sel' darkens the neighbouring colour (sel-out); a hex string uses a flat colour. */
  outline?: 'sel' | string | false;
  /** Anchor; defaults to bottom-center. */
  ax?: number;
  ay?: number;
}

const OUTLINE_BASE = packColor('#241c2a');

/**
 * Builds a sprite from rows of characters. Each character maps to a colour in
 * `pal`; '.' and ' ' are transparent. An outline is added around the shape.
 */
export function spriteFromGrid(rows: string[], pal: Palette, opts: GridOptions = {}): Sprite {
  const pad = opts.outline === false ? 0 : 1;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const buf = new PixelBuf(w + pad * 2, h + pad * 2);
  const packed: Record<string, number> = {};
  for (const k in pal) packed[k] = packColor(pal[k]);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = packed[ch];
      if (c === undefined) throw new Error(`Unknown palette key '${ch}'`);
      buf.set(x + pad, y + pad, c);
    }
  }
  if (opts.outline !== false) addOutline(buf, opts.outline ?? 'sel');
  const ax = (opts.ax ?? Math.floor(w / 2)) + pad;
  const ay = (opts.ay ?? h) + pad;
  return new Sprite(buf.toCanvas(), ax, ay);
}

/** Adds a 1px outline around every opaque region of the buffer (in place). */
export function addOutline(buf: PixelBuf, mode: 'sel' | string = 'sel'): void {
  const flat = mode === 'sel' ? 0 : packColor(mode);
  const src = buf.data.slice();
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= buf.w || y >= buf.h ? 0 : src[y * buf.w + x];
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (at(x, y) >>> 24) continue;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].find((c) => c >>> 24);
      if (!n) continue;
      buf.set(x, y, mode === 'sel' ? darkOutline(n) : flat);
    }
  }
}

function darkOutline(c: number): number {
  const [r, g, b] = unpack(c);
  const [br, bg, bb] = unpack(OUTLINE_BASE);
  const t = 0.72;
  const R = Math.round(r * 0.35 * (1 - t) + br * t);
  const G = Math.round(g * 0.35 * (1 - t) + bg * t);
  const B = Math.round(b * 0.35 * (1 - t) + bb * t);
  return ((255 << 24) | (B << 16) | (G << 8) | R) >>> 0;
}

/** Recolours a sprite by mapping exact colours to new ones (palette swap). */
export function recolor(src: Sprite, map: Record<string, string>): Sprite {
  const buf = PixelBuf.fromCanvas(src.img);
  const lut = new Map<number, number>();
  for (const k in map) lut.set(packColor(k), packColor(map[k]));
  for (let i = 0; i < buf.data.length; i++) {
    const r = lut.get(buf.data[i]);
    if (r !== undefined) buf.data[i] = r;
  }
  return new Sprite(buf.toCanvas(), src.ax, src.ay);
}

/** Returns a copy with every opaque pixel painted `hex` (hit flashes, silhouettes). */
export function silhouette(src: Sprite, hex: string): Sprite {
  const buf = PixelBuf.fromCanvas(src.img);
  const c = packColor(hex);
  for (let i = 0; i < buf.data.length; i++) if (buf.data[i] >>> 24) buf.data[i] = c;
  return new Sprite(buf.toCanvas(), src.ax, src.ay);
}
