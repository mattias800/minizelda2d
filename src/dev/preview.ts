import { backdropFor } from '../gfx/backgrounds';
import { Ctx, PixelBuf, packColor } from '../gfx/canvas';
import { leafClump, ramp } from '../gfx/paint';
import { Rng } from '../core/math';
import { Sprite } from '../gfx/sprite';
import { paintTerrain } from '../gfx/terrain';
import { parseRoom } from '../world/level';
import { Theme, roomById } from '../world/rooms';
import { heroFrames } from '../gfx/sprites/hero';
import { moblinFrames, MoblinKind } from '../gfx/sprites/moblin';

/** Developer previews, reachable with ?preview=<name>. Used for art iteration. */
export function runPreview(name: string, ctx: Ctx, q: URLSearchParams): void {
  if (name === 'layers') return previewLayer(ctx, q);
  if (name === 'clumps') return previewClumps(ctx);
  if (name === 'room') {
    const def = roomById(q.get('room') ?? 'clearing');
    const camX = Number(q.get('cam') ?? 0);
    const { map } = parseRoom(def);
    backdropFor(def.theme).draw(ctx, camX, 0);
    ctx.drawImage(paintTerrain(map, def.theme, 7), -camX, 0);
    return;
  }
  if (name === 'sheet') {
    ctx.fillStyle = '#9fb4a8';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const groups: Sprite[][] = [];
    const set = q.get('set') ?? 'hero';
    if (set === 'hero') {
      const f = heroFrames();
      groups.push(f.idle, f.walk, [...f.jump, ...f.fall, ...f.crouch, ...f.crouchAttack], f.attack, [...f.downThrust, ...f.upThrust, ...f.hurt, ...f.cast, ...f.itemGet, ...f.dead]);
    }
    if (set === 'moblin') {
      for (const k of ['moblin', 'spear', 'brute', 'boss'] as MoblinKind[]) {
        const f = moblinFrames(k);
        groups.push([...f.idle, ...f.walk, ...f.windup, ...f.swing, ...f.hurt, ...f.throw]);
      }
    }
    let y = 4;
    for (const g of groups) {
      let x = 4;
      let rowH = 0;
      for (const s of g) {
        ctx.drawImage(s.img, x, y);
        x += s.w + 2;
        rowH = Math.max(rowH, s.h);
      }
      y += rowH + 2;
    }
  }
}

/** ?preview=layers&theme=forest&only=3 draws a single parallax layer. */
export function previewLayer(ctx: Ctx, q: URLSearchParams): void {
  const b = backdropFor((q.get('theme') ?? 'forest') as Theme);
  const only = Number(q.get('only') ?? 0);
  const l = b.layers[only];
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (l) ctx.drawImage(l.img, 0, 0);
}

/** ?preview=clumps: a test canopy made with leafClump. */
function previewClumps(ctx: Ctx): void {
  const b = new PixelBuf(336, 192);
  b.fillRect(0, 0, 336, 192, packColor('#fef8db'));
  b.fillRect(0, 0, 336, 70, packColor('#233f52'));
  const leaves = ramp('#1c3444', '#233f52', '#2f6b58', '#3a845f', '#48a864', '#5cbf70', '#b0e49c');
  const rng = new Rng(4);
  for (const baseY of [0, 16, 34, 50]) {
    for (let x = -10; x < 346; x += rng.int(16, 26)) leafClump(b, x, baseY + rng.int(-4, 6), rng.int(12, 18), { ramp: leaves, seed: x + baseY });
  }
  const grass = ramp('#1f3d4a', '#2f6b58', '#3a845f', '#48a864', '#5cbf70', '#86dd8e', '#b8ee9c');
  for (let x = 0; x < 336; x += 14) leafClump(b, x, 150 + rng.int(-3, 3), 11, { ramp: grass, seed: x, leaf: 7 });
  ctx.drawImage(b.toCanvas(), 0, 0);
}
