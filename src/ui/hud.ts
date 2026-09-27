import { VIEW_H, VIEW_W } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import { drawText } from '../gfx/font';
import { hudHearts, itemRing, keyCap, magicMedallion } from '../gfx/sprites/hud';
import { fireIcon, rupeeFrames } from '../gfx/sprites/props';
import { MAX_MAGIC, Progress } from '../game/progress';
import { FIRE_COST } from '../entities/player';

const OUTLINE = '#4a2a26';

/** The in-game overlay, laid out like the reference: hearts, magic, rupees, item. */
export function drawHud(ctx: Ctx, prog: Progress, t: number, bossHp: number | null): void {
  // hearts
  const hearts = hudHearts();
  for (let i = 0; i < prog.data.maxHearts; i++) {
    const hp = prog.hp - i * 2;
    const s = hp >= 2 ? hearts.full : hp === 1 ? hearts.half : hearts.empty;
    // the last full heart pulses when low on health
    const low = prog.hp <= 2 && hp > 0 && t % 30 < 15;
    s.draw(ctx, 8 + i * 12, 4 - (low ? 1 : 0));
  }

  // magic medallion + meter
  magicMedallion().draw(ctx, 6, 16);
  const bx = 30;
  const by = 24;
  const bw = 42;
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(bx, by, bw + 2, 7);
  ctx.fillRect(bx - 1, by + 1, 1, 5);
  ctx.fillRect(bx + bw + 2, by + 1, 1, 5);
  ctx.fillStyle = '#8a4e34';
  ctx.fillRect(bx + 1, by + 1, bw, 5);
  const fill = Math.round((prog.magic / MAX_MAGIC) * bw);
  const canCast = prog.magic >= FIRE_COST;
  ctx.fillStyle = canCast ? '#fff0c8' : '#e8b48a';
  ctx.fillRect(bx + 1, by + 1, fill, 5);
  ctx.fillStyle = canCast ? '#f4c07a' : '#c88a64';
  ctx.fillRect(bx + 1, by + 4, fill, 2);
  ctx.fillStyle = '#ffffff';
  if (fill > 2) ctx.fillRect(bx + 2, by + 2, Math.max(0, fill - 3), 1);

  // rupees
  rupeeFrames().green[t % 90 < 5 ? 1 : 0].draw(ctx, 14, 52);
  drawText(ctx, String(prog.data.rupees), 22, 43, '#fff0c8', { outline: OUTLINE });

  // item ring
  const rx = VIEW_W - 36;
  const ry = 4;
  itemRing().draw(ctx, rx, ry);
  if (prog.has('fire')) fireIcon().draw(ctx, rx + 14, ry + 19);
  else keyCap().draw(ctx, rx + 8, ry + 8);
  drawText(ctx, 'Item', rx + 14, ry + 29, '#fff0c8', { outline: OUTLINE, align: 'center' });

  // boss health
  if (bossHp !== null) {
    const w = 140;
    const x = Math.round((VIEW_W - w) / 2);
    const y = VIEW_H - 14;
    drawText(ctx, 'Guardian', VIEW_W / 2, y - 10, '#fff0c8', { outline: OUTLINE, align: 'center' });
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#5a2a36';
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = '#e0505a';
    ctx.fillRect(x, y, Math.round(w * bossHp), 5);
    ctx.fillStyle = '#ff9aa4';
    ctx.fillRect(x, y, Math.round(w * bossHp), 1);
  }
}
