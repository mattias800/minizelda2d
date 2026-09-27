import { backdropFor } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import { Sprite } from '../gfx/sprite';
import { paintTerrain } from '../gfx/terrain';
import { parseRoom } from '../world/level';
import { Theme, roomById } from '../world/rooms';
import { heroFrames } from '../gfx/sprites/hero';
import { moblinFrames, MoblinKind } from '../gfx/sprites/moblin';

/** Developer previews, reachable with ?preview=<name>. Used for art iteration. */
export function runPreview(name: string, ctx: Ctx, q: URLSearchParams): void {
  if (name === 'layers') return previewLayer(ctx, q);
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
