import { Ctx } from '../gfx/canvas';
import { Sprite } from '../gfx/sprite';
import { Entity, Layer } from './entity';

/** Plays a list of frames once at `speed` ticks per frame, then disappears. */
export class AnimFx extends Entity {
  constructor(
    x: number,
    y: number,
    private frames: Sprite[],
    private speed = 4,
  ) {
    super(x, y, 1, 1);
    this.layer = Layer.Effects;
  }
  update(): void {
    this.age++;
    if (this.age >= this.frames.length * this.speed) this.dead = true;
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = this.frames[Math.min(this.frames.length - 1, Math.floor(this.age / this.speed))];
    f.draw(ctx, this.x - camX, this.y - camY);
  }
}

export interface ParticleOpts {
  vx: number;
  vy: number;
  color: string;
  life: number;
  gravity?: number;
  size?: number;
  drag?: number;
}

/** A single pixel-ish particle (sparks, embers, leaves, dust). */
export class Particle extends Entity {
  private vx: number;
  private vy: number;
  constructor(
    x: number,
    y: number,
    private o: ParticleOpts,
  ) {
    super(x, y, 1, 1);
    this.vx = o.vx;
    this.vy = o.vy;
    this.layer = Layer.Effects;
  }
  update(): void {
    this.age++;
    this.vy += this.o.gravity ?? 0;
    const drag = this.o.drag ?? 1;
    this.vx *= drag;
    this.vy *= drag;
    this.body.x += this.vx;
    this.body.y += this.vy;
    if (this.age >= this.o.life) this.dead = true;
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const s = this.o.size ?? 1;
    // blink out during the last few ticks
    if (this.o.life - this.age < 6 && this.age % 2) return;
    ctx.fillStyle = this.o.color;
    ctx.fillRect(Math.round(this.x - camX), Math.round(this.y - camY), s, s);
  }
}
