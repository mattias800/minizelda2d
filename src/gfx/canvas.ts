export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** '#rrggbb' -> packed little-endian ABGR as used by ImageData's Uint32 view. */
export function packColor(hex: string, alpha = 255): number {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpack(c: number): [number, number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = unpack(packColor(a));
  const [br, bg, bb] = unpack(packColor(b));
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/**
 * A CPU-side pixel buffer for procedural painting. Much faster than
 * fillRect-per-pixel; blit once with `toCanvas()`.
 */
export class PixelBuf {
  readonly data: Uint32Array;
  private readonly img: ImageData;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.img = new ImageData(w, h);
    this.data = new Uint32Array(this.img.data.buffer);
  }
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x: number, y: number, c: number): void {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  alpha(x: number, y: number): number {
    return this.get(x, y) >>> 24;
  }
  fillRect(x: number, y: number, w: number, h: number, c: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  /** Blends `c` over the existing pixel with opacity `a` (0..1). */
  blend(x: number, y: number, c: number, a: number): void {
    if (!this.inBounds(x, y)) return;
    const i = (y | 0) * this.w + (x | 0);
    const d = this.data[i];
    const [dr, dg, db, da] = unpack(d);
    const [sr, sg, sb] = unpack(c);
    const r = dr + (sr - dr) * a;
    const g = dg + (sg - dg) * a;
    const b = db + (sb - db) * a;
    const na = Math.max(da, Math.round(255 * a));
    this.data[i] = ((na << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
  }
  toCanvas(): HTMLCanvasElement {
    const { canvas, ctx } = makeCanvas(this.w, this.h);
    ctx.putImageData(this.img, 0, 0);
    return canvas;
  }
  static fromCanvas(src: HTMLCanvasElement): PixelBuf {
    const pb = new PixelBuf(src.width, src.height);
    const d = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
    pb.data.set(new Uint32Array(d.data.buffer));
    return pb;
  }
}
