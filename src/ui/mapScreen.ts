import { VIEW_H, VIEW_W } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import { drawText } from '../gfx/font';
import { featherIcon, fireIcon, heartContainer, triforce } from '../gfx/sprites/props';
import { Sprite } from '../gfx/sprite';
import { Progress, START_HEARTS, TOTAL_HEART_CONTAINERS } from '../game/progress';
import { parseRoom, Spawn } from '../world/level';
import { ROOMS, RoomDef, Theme, roomCells } from '../world/rooms';
import { roundedPanel } from './bubble';

const THEME_COLOR: Record<Theme, [string, string]> = {
  forest: ['#5cbf70', '#2f6b58'],
  canopy: ['#a8d4ae', '#408064'],
  cave: ['#5a6a8a', '#303644'],
  shrine: ['#948ca6', '#4e4760'],
  hollow: ['#6b4a6e', '#2a2030'],
};

const CELL_W = 34;
const CELL_H = 19;

const spawnCache = new Map<string, Spawn[]>();
function spawnsOf(def: RoomDef): Spawn[] {
  let s = spawnCache.get(def.id);
  if (!s) {
    s = parseRoom(def).spawns;
    spawnCache.set(def.id, s);
  }
  return s;
}

export function formatTime(ticks: number): string {
  const secs = Math.floor(ticks / 60);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Pause screen: explored map, collection and controls. */
export function drawMapScreen(ctx: Ctx, prog: Progress, currentRoom: string, px: number, py: number, t: number): void {
  ctx.fillStyle = 'rgba(16, 22, 29, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  roundedPanel(ctx, 8, 6, VIEW_W - 16, VIEW_H - 12, '#fff8e0', '#ecdcb8', '#8a5a44');
  drawText(ctx, 'Map of the Whispering Wood', VIEW_W / 2, 12, '#8a5a44', { align: 'center' });

  const minGx = Math.min(...ROOMS.map((r) => r.gx));
  const maxGx = Math.max(...ROOMS.map((r) => r.gx + roomCells(r).w));
  const minGy = Math.min(...ROOMS.map((r) => r.gy));
  const maxGy = Math.max(...ROOMS.map((r) => r.gy + roomCells(r).h));
  const mapW = (maxGx - minGx) * CELL_W;
  const mapH = (maxGy - minGy) * CELL_H;
  const ox = Math.round((VIEW_W - mapW) / 2);
  const oy = 26;

  ctx.fillStyle = '#e8d4ae';
  ctx.fillRect(ox - 3, oy - 3, mapW + 6, mapH + 6);

  for (const r of ROOMS) {
    const { w, h } = roomCells(r);
    const x = ox + (r.gx - minGx) * CELL_W;
    const y = oy + (r.gy - minGy) * CELL_H;
    const rw = w * CELL_W;
    const rh = h * CELL_H;
    const visited = prog.data.visited.includes(r.id);
    if (!visited) continue;
    const [fill, edge] = THEME_COLOR[r.theme];
    ctx.fillStyle = edge;
    ctx.fillRect(x + 1, y + 1, rw - 2, rh - 2);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 2, y + 2, rw - 4, rh - 4);
    // markers
    const sx = (rw - 4) / r.map[0].length;
    const sy = (rh - 4) / r.map.length;
    for (const s of spawnsOf(r)) {
      const mx = Math.round(x + 2 + s.cx * sx);
      const my = Math.round(y + 2 + s.cy * sy);
      let color: string | null = null;
      if (s.kind === 'H' && !prog.flag(`heart:${r.id}:${s.cx},${s.cy}`)) color = '#f06b86';
      else if (s.kind === 'c' && !prog.flag(`chest:${r.id}`)) color = '#f4c34e';
      else if (s.kind === 'o') color = '#62e0c0';
      else if (s.kind === 'K' && !prog.flag('boss:guardian')) color = '#8e2c3e';
      if (color) {
        ctx.fillStyle = '#1c2230';
        ctx.fillRect(mx - 1, my - 1, 4, 4);
        ctx.fillStyle = color;
        ctx.fillRect(mx, my, 2, 2);
      }
    }
    if (r.id === currentRoom) {
      if (t % 40 < 28) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, rw, 1);
        ctx.fillRect(x, y + rh - 1, rw, 1);
        ctx.fillRect(x, y, 1, rh);
        ctx.fillRect(x + rw - 1, y, 1, rh);
      }
      const hx = Math.round(x + 2 + (px / (r.map[0].length * 16)) * (rw - 4));
      const hy = Math.round(y + 2 + (py / (r.map.length * 16)) * (rh - 4));
      ctx.fillStyle = '#1c2230';
      ctx.fillRect(hx - 2, hy - 3, 5, 5);
      ctx.fillStyle = t % 20 < 10 ? '#b8ee9c' : '#ffffff';
      ctx.fillRect(hx - 1, hy - 2, 3, 3);
    }
  }
  const cur = ROOMS.find((r) => r.id === currentRoom);
  if (cur) drawText(ctx, cur.name, VIEW_W / 2, oy + mapH + 6, '#6b4a3e', { align: 'center' });

  // collection panel
  const py0 = oy + mapH + 20;
  const slot = (x: number, s: Sprite, owned: boolean, label: string) => {
    ctx.globalAlpha = owned ? 1 : 0.25;
    s.draw(ctx, x + 6, py0 + 12);
    ctx.globalAlpha = 1;
    drawText(ctx, owned ? label : '???', x + 16, py0 + 3, owned ? '#6b4a3e' : '#b89a7a');
  };
  slot(20, featherIcon(), prog.has('feather'), 'Feather');
  slot(84, fireIcon(), prog.has('fire'), 'Fire');
  const hc = prog.data.maxHearts - START_HEARTS;
  slot(140, heartContainer(), hc > 0, `Hearts ${hc}/${TOTAL_HEART_CONTAINERS}`);
  slot(234, triforce(), prog.flag('triforce'), 'Triforce');

  drawText(ctx, `Rupees ${prog.data.rupees}`, 22, py0 + 22, '#6b4a3e');
  drawText(ctx, `Time ${formatTime(prog.data.playTicks)}`, 110, py0 + 22, '#6b4a3e');
  drawText(ctx, `Found ${prog.completion()}%`, 200, py0 + 22, '#6b4a3e');

  const help = [
    'Arrows/WASD move   Z jump   X sword   C fire',
    'Down: crouch   Down in air: down-thrust   Up: talk/use',
  ];
  help.forEach((l, i) => drawText(ctx, l, VIEW_W / 2, VIEW_H - 36 + i * 9, '#8a6a5a', { align: 'center' }));
  if (t % 60 < 40) drawText(ctx, 'Enter to resume   M to mute', VIEW_W / 2, VIEW_H - 18, '#c0405e', { align: 'center' });
}
