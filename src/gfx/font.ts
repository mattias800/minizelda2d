import { Ctx, PixelBuf, makeCanvas, packColor } from './canvas';

/**
 * A small hand-made proportional pixel font. Glyphs are 7 rows tall: rows
 * 0-5 sit on the baseline, row 6 is for descenders.
 */
const G: Record<string, string> = {
  A: '.##.|#..#|#..#|####|#..#|#..#|....',
  B: '###.|#..#|###.|#..#|#..#|###.|....',
  C: '.###|#...|#...|#...|#...|.###|....',
  D: '###.|#..#|#..#|#..#|#..#|###.|....',
  E: '####|#...|###.|#...|#...|####|....',
  F: '####|#...|###.|#...|#...|#...|....',
  G: '.###|#...|#.##|#..#|#..#|.###|....',
  H: '#..#|#..#|####|#..#|#..#|#..#|....',
  I: '###|.#.|.#.|.#.|.#.|###|...',
  J: '..##|...#|...#|...#|#..#|.##.|....',
  K: '#..#|#.#.|##..|#.#.|#..#|#..#|....',
  L: '#...|#...|#...|#...|#...|####|....',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|.....',
  N: '#..#|##.#|#.##|#..#|#..#|#..#|....',
  O: '.##.|#..#|#..#|#..#|#..#|.##.|....',
  P: '###.|#..#|#..#|###.|#...|#...|....',
  Q: '.##.|#..#|#..#|#..#|#.#.|.#.#|....',
  R: '###.|#..#|#..#|###.|#.#.|#..#|....',
  S: '.###|#...|.##.|...#|...#|###.|....',
  T: '#####|..#..|..#..|..#..|..#..|..#..|.....',
  U: '#..#|#..#|#..#|#..#|#..#|.##.|....',
  V: '#...#|#...#|#...#|.#.#.|.#.#.|..#..|.....',
  W: '#...#|#...#|#...#|#.#.#|##.##|#...#|.....',
  X: '#..#|#..#|.##.|.##.|#..#|#..#|....',
  Y: '#...#|.#.#.|..#..|..#..|..#..|..#..|.....',
  Z: '####|...#|..#.|.#..|#...|####|....',
  a: '....|....|.###|#..#|#..#|.###|....',
  b: '#...|#...|###.|#..#|#..#|###.|....',
  c: '...|...|.##|#..|#..|.##|...',
  d: '...#|...#|.###|#..#|#..#|.###|....',
  e: '....|....|.##.|####|#...|.###|....',
  f: '.##|#..|###|#..|#..|#..|...',
  g: '....|....|.###|#..#|.###|...#|.##.',
  h: '#...|#...|###.|#..#|#..#|#..#|....',
  i: '#|.|#|#|#|#|.',
  j: '.#|..|.#|.#|.#|.#|#.',
  k: '#...|#...|#..#|###.|#.#.|#..#|....',
  l: '#.|#.|#.|#.|#.|.#|..',
  m: '.....|.....|####.|#.#.#|#.#.#|#.#.#|.....',
  n: '....|....|###.|#..#|#..#|#..#|....',
  o: '....|....|.##.|#..#|#..#|.##.|....',
  p: '....|....|###.|#..#|###.|#...|#...',
  q: '....|....|.###|#..#|.###|...#|...#',
  r: '...|...|#.#|##.|#..|#..|...',
  s: '...|...|.##|##.|..#|##.|...',
  t: '#..|#..|###|#..|#..|.##|...',
  u: '....|....|#..#|#..#|#..#|.###|....',
  v: '....|....|#..#|#..#|.##.|.##.|....',
  w: '.....|.....|#...#|#.#.#|#.#.#|.#.#.|.....',
  x: '...|...|#.#|.#.|.#.|#.#|...',
  y: '....|....|#..#|#..#|.###|...#|.##.',
  z: '....|....|####|..#.|.#..|####|....',
  '0': '.##.|#..#|#.##|##.#|#..#|.##.|....',
  '1': '.#.|##.|.#.|.#.|.#.|###|...',
  '2': '.##.|#..#|..#.|.#..|#...|####|....',
  '3': '###.|...#|.##.|...#|...#|###.|....',
  '4': '#..#|#..#|####|...#|...#|...#|....',
  '5': '####|#...|###.|...#|...#|###.|....',
  '6': '.##.|#...|###.|#..#|#..#|.##.|....',
  '7': '####|...#|..#.|..#.|.#..|.#..|....',
  '8': '.##.|#..#|.##.|#..#|#..#|.##.|....',
  '9': '.##.|#..#|#..#|.###|...#|.##.|....',
  ' ': '..|..|..|..|..|..|..',
  '.': '.|.|.|.|.|#|.',
  ',': '..|..|..|..|..|.#|#.',
  '!': '#|#|#|#|.|#|.',
  '?': '.##.|#..#|..#.|.#..|....|.#..|....',
  "'": '#|#|.|.|.|.|.',
  '-': '...|...|...|###|...|...|...',
  ':': '.|.|#|.|.|#|.',
  '/': '...#|..#.|..#.|.#..|.#..|#...|....',
  '+': '...|...|.#.|###|.#.|...|...',
  '(': '.#|#.|#.|#.|#.|.#|..',
  ')': '#.|.#|.#|.#|.#|#.|..',
  '%': '#..#|...#|..#.|.#..|#...|#..#|....',
  '>': '#..|.#.|..#|.#.|#..|...|...',
  '<': '..#|.#.|#..|.#.|..#|...|...',
  '*': '.....|#.#.#|.###.|#.#.#|.....|.....|.....',
  // arrows / buttons used in the tutorial
  '^': '..#..|.###.|#.#.#|..#..|..#..|.....|.....',
};

const LINE_H = 9;
export const FONT_LINE_H = LINE_H;

interface Glyph {
  w: number;
  rows: string[];
}
const glyphs = new Map<string, Glyph>();
for (const [ch, def] of Object.entries(G)) {
  const rows = def.split('|');
  glyphs.set(ch, { w: rows[0].length, rows });
}

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (glyphs.get(ch) ?? glyphs.get('?')!).w + 1;
  return Math.max(0, w - 1);
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Renders text into a cached bitmap. `outline` draws a 1px border all around
 * (like the HUD numbers); `shadow` drops a 1px shadow under the glyphs.
 */
export function renderText(s: string, color: string, opts: { outline?: string; shadow?: string } = {}): HTMLCanvasElement {
  const key = `${s}|${color}|${opts.outline ?? ''}|${opts.shadow ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pad = opts.outline ? 1 : 0;
  const w = textWidth(s) + pad * 2 + (opts.shadow ? 1 : 0);
  const h = 7 + pad * 2 + (opts.shadow ? 1 : 0);
  const buf = new PixelBuf(Math.max(1, w), h);
  const fg = packColor(color);
  const plot = (x: number, y: number, c: number) => buf.set(x, y, c);
  const draw = (ox: number, oy: number, c: number) => {
    let x = ox;
    for (const ch of s) {
      const g = glyphs.get(ch) ?? glyphs.get('?')!;
      g.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') plot(x + rx, oy + ry, c);
      });
      x += g.w + 1;
    }
  };
  if (opts.outline) {
    const oc = packColor(opts.outline);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) draw(pad + dx, pad + dy, oc);
  }
  if (opts.shadow) draw(pad, pad + 1, packColor(opts.shadow));
  draw(pad, pad, fg);
  const c = buf.toCanvas();
  cache.set(key, c);
  return c;
}

export function drawText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  color: string,
  opts: { outline?: string; shadow?: string; align?: 'left' | 'center' | 'right' } = {},
): void {
  const img = renderText(s, color, opts);
  let dx = x;
  if (opts.align === 'center') dx = x - Math.floor(img.width / 2);
  else if (opts.align === 'right') dx = x - img.width;
  ctx.drawImage(img, Math.round(dx), Math.round(y));
}

/** Greedy word wrap to a pixel width. */
export function wrapText(s: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (textWidth(test) > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Scales a text bitmap up by an integer factor (title screen). */
export function bigText(s: string, color: string, scale: number, outline?: string): HTMLCanvasElement {
  const src = renderText(s, color, outline ? { outline } : {});
  const { canvas, ctx } = makeCanvas(src.width * scale, src.height * scale);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}
