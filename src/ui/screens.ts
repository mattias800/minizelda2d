import { audio } from '../core/audio';
import { Input } from '../core/input';
import { Atmosphere } from '../gfx/atmosphere';
import { VIEW_H, VIEW_W, backdropFor } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import { bigText, drawText } from '../gfx/font';
import { heroFrames } from '../gfx/sprites/hero';
import { squirrelFrames } from '../gfx/sprites/creatures';
import { bigTree, redMushroom, triforce, yellowMushroom } from '../gfx/sprites/props';
import { paintTerrain } from '../gfx/terrain';
import { Progress } from '../game/progress';
import { parseRoom } from '../world/level';
import { roomById } from '../world/rooms';
import { formatTime } from './mapScreen';
import { roundedPanel } from './bubble';

const INK = '#4a2a26';
const CREAM = '#fff0c8';

/** Title: the clearing drifts by behind the logo. */
export class TitleScreen {
  private t = 0;
  private sel = 0;
  private options: ('new' | 'continue')[];
  private terrain: HTMLCanvasElement;
  private atmo: Atmosphere;
  private logo = bigText('MINI ZELDA II', '#f4c34e', 3, INK);
  private logoShadow = bigText('MINI ZELDA II', '#8a4e34', 3);
  private maxPan: number;

  constructor() {
    const def = roomById('clearing');
    const map = parseRoom(def).map;
    this.terrain = paintTerrain(map, def.theme, 1234);
    this.maxPan = map.widthPx - VIEW_W;
    this.atmo = new Atmosphere('forest', map.widthPx, 3);
    this.options = Progress.hasSave() ? ['continue', 'new'] : ['new'];
  }

  update(input: Input): 'new' | 'continue' | null {
    this.t++;
    this.atmo.update();
    if (this.t < 20) return null;
    if (input.pressed('up') || input.pressed('down')) {
      this.sel = (this.sel + 1) % this.options.length;
      audio.sfx('blip');
    }
    if (input.pressed('jump') || input.pressed('attack') || input.pressed('pause')) {
      audio.sfx('menu');
      return this.options[this.sel];
    }
    return null;
  }

  draw(ctx: Ctx): void {
    const camX = Math.round((Math.sin(this.t / 900 - Math.PI / 2) * 0.5 + 0.5) * this.maxPan);
    backdropFor('forest').draw(ctx, camX, 0);
    bigTree().draw(ctx, 15 * 16 + 8 - camX, 160);
    ctx.drawImage(this.terrain, -camX, 0);
    yellowMushroom().draw(ctx, 12 * 16 + 8 - camX, 96);
    squirrelFrames()[Math.floor(this.t / 40) % 5 === 0 ? 1 : 0].draw(ctx, 19 * 16 + 8 - camX, 160);
    heroFrames().idle[Math.floor(this.t / 32) % 2].draw(ctx, 21 * 16 + 8 - camX, 160);
    redMushroom().draw(ctx, 29 * 16 + 12 - camX, 160);
    this.atmo.drawRays(ctx, camX);
    this.atmo.drawMotes(ctx, camX);

    // logo
    const lx = Math.round((VIEW_W - this.logo.width) / 2);
    const ly = 30 + Math.round(Math.sin(this.t / 50) * 1.5);
    triforce().draw(ctx, VIEW_W / 2, ly - 2);
    ctx.drawImage(this.logoShadow, lx + 1, ly + 3);
    ctx.drawImage(this.logo, lx, ly);
    drawText(ctx, 'The Whispering Wood', VIEW_W / 2, ly + 28, CREAM, { outline: INK, align: 'center' });

    // menu
    const labels = { new: 'New Game', continue: 'Continue' };
    const my = 118;
    roundedPanel(ctx, VIEW_W / 2 - 48, my - 6, 96, 14 + this.options.length * 11, '#fff8e0', '#ecdcb8', '#8a5a44');
    this.options.forEach((o, i) => {
      const active = i === this.sel;
      drawText(ctx, (active ? '> ' : '') + labels[o] + (active ? ' <' : ''), VIEW_W / 2, my + i * 11, active ? '#c0405e' : '#8a6a5a', {
        align: 'center',
      });
    });
    if (this.t % 70 < 50)
      drawText(ctx, 'Press Z to start', VIEW_W / 2, VIEW_H - 22, CREAM, { outline: INK, align: 'center' });
    const hint = audio.locked ? 'Click or press any key to enable sound' : 'M: mute   Enter / Start: map';
    drawText(ctx, hint, VIEW_W / 2, VIEW_H - 11, '#d8ecb2', { outline: INK, align: 'center' });
  }
}

export class GameOverScreen {
  private t = 0;
  private title = bigText('GAME OVER', '#f06b86', 2, INK);
  update(input: Input): boolean {
    this.t++;
    return this.t > 60 && (input.pressed('jump') || input.pressed('attack') || input.pressed('pause'));
  }
  draw(ctx: Ctx): void {
    ctx.globalAlpha = Math.min(0.85, this.t / 40);
    ctx.fillStyle = '#10161d';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    if (this.t < 20) return;
    ctx.drawImage(this.title, Math.round((VIEW_W - this.title.width) / 2), 70);
    if (this.t > 60 && this.t % 60 < 40)
      drawText(ctx, 'Press Z to try again from your last rest', VIEW_W / 2, 110, CREAM, { align: 'center' });
  }
}

export class EndingScreen {
  private t = 0;
  private big = bigText('THE END', '#f4c34e', 3, INK);
  private atmo = new Atmosphere('canopy', VIEW_W * 2, 5);
  constructor(private prog: Progress) {}
  update(input: Input): boolean {
    this.t++;
    this.atmo.update();
    return this.t > 180 && (input.pressed('jump') || input.pressed('attack') || input.pressed('pause'));
  }
  draw(ctx: Ctx): void {
    backdropFor('canopy').draw(ctx, this.t * 0.6, 0);
    this.atmo.drawRays(ctx, this.t * 0.6);
    this.atmo.drawMotes(ctx, this.t * 0.6);
    triforce().draw(ctx, VIEW_W / 2, 30 + Math.round(Math.sin(this.t / 30) * 2));
    ctx.drawImage(this.big, Math.round((VIEW_W - this.big.width) / 2), 40);
    const d = this.prog.data;
    const lines = [
      'The Guardian is defeated and the Triforce is home.',
      'The Whispering Wood whispers once more.',
      '',
      `Time  ${formatTime(d.playTicks)}      Found  ${this.prog.completion()}%`,
      `Rupees  ${d.rupees}      Falls  ${d.deaths}`,
    ];
    roundedPanel(ctx, 30, 72, VIEW_W - 60, 62, '#fff8e0', '#ecdcb8', '#8a5a44');
    lines.forEach((l, i) => drawText(ctx, l, VIEW_W / 2, 79 + i * 10, '#6b4a3e', { align: 'center' }));
    const hero = heroFrames();
    hero.itemGet[0].draw(ctx, VIEW_W / 2 - 40, 176);
    squirrelFrames()[Math.floor(this.t / 30) % 2].draw(ctx, VIEW_W / 2 + 40, 176, true);
    if (this.t > 180 && this.t % 60 < 40) drawText(ctx, 'Thanks for playing!  Press Z', VIEW_W / 2, 150, CREAM, { outline: INK, align: 'center' });
  }
}
