import { Ctx } from '../gfx/canvas';
import { drawText, textWidth } from '../gfx/font';

const FILL = '#fff8e0';
const SHADE = '#ecdcb8';
const EDGE = '#b89a7a';
const TEXT = '#8a6a5a';

/** A little rounded speech bubble whose tail points down at (x, y). */
export function drawBubble(ctx: Ctx, text: string, x: number, y: number): void {
  const w = textWidth(text) + 8;
  const h = 13;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h - 3);
  roundedPanel(ctx, left, top, w, h, FILL, SHADE, EDGE);
  // tail
  ctx.fillStyle = EDGE;
  ctx.fillRect(Math.round(x) - 1, top + h, 4, 1);
  ctx.fillRect(Math.round(x), top + h + 1, 2, 1);
  ctx.fillRect(Math.round(x), top + h + 2, 1, 1);
  ctx.fillStyle = SHADE;
  ctx.fillRect(Math.round(x), top + h - 1, 2, 1);
  ctx.fillRect(Math.round(x), top + h, 2, 1);
  ctx.fillStyle = FILL;
  ctx.fillRect(Math.round(x), top + h - 1, 1, 1);
  drawText(ctx, text, left + 4, top + 3, TEXT);
}

/** A pixel panel with 1px cut corners, a bottom shade row and an edge. */
export function roundedPanel(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, shade: string, edge: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = shade;
  ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
}
