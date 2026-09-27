import { audio } from './core/audio';
import { Input } from './core/input';
import { runPreview } from './dev/preview';
import { VIEW_H, VIEW_W } from './gfx/backgrounds';
import { Game } from './game/game';
import { validateRooms } from './world/rooms';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('screen') as HTMLCanvasElement;

/** Integer-scale the 336x192 screen to fit the window. */
function fit(): void {
  const z = Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));
  canvas.style.width = `${VIEW_W * z}px`;
  canvas.style.height = `${VIEW_H * z}px`;
}

const preview = q.get('preview');
if (preview) {
  // Developer art previews (see src/dev/preview.ts).
  const zoom = Number(q.get('zoom') ?? 4);
  canvas.width = VIEW_W * (4 / zoom);
  canvas.height = VIEW_H * (4 / zoom);
  canvas.style.width = `${VIEW_W * 4}px`;
  canvas.style.height = `${VIEW_H * 4}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  runPreview(preview, ctx, q);
} else {
  validateRooms();
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  fit();
  addEventListener('resize', fit);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const input = new Input(window);
  input.onFirstInteraction = () => audio.unlock();
  const game = new Game(input);
  applyDevParams(game);

  // Fixed 60 Hz simulation, rendered on animation frames.
  const STEP = 1000 / 60;
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      game.update();
      acc -= STEP;
    }
    game.draw(ctx);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Dev shortcuts: `?room=cavern&items=feather,fire&x=100&y=160` jumps straight
 * into a room with the given items.
 */
function applyDevParams(game: Game): void {
  const room = q.get('room');
  if (!room) return;
  const x = q.get('x');
  game.startAt(room, x ? { x: Number(x), y: Number(q.get('y') ?? 150) } : null);
  for (const it of (q.get('items') ?? '').split(',').filter(Boolean)) game.progress.give(it as 'feather' | 'fire');
  const hearts = q.get('hearts');
  if (hearts) {
    game.progress.data.maxHearts = Number(hearts);
    game.progress.hp = game.progress.maxHp;
  }
  const rupees = q.get('rupees');
  if (rupees) game.progress.data.rupees = Number(rupees);
}
