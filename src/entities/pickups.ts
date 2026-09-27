import { overlaps } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { heartContainer, magicJar, rupeeFrames, smallHeart, triforce } from '../gfx/sprites/props';
import { Entity, Layer } from './entity';
import { Particle } from './effects';

export type PickupKind = 'rupee' | 'bigRupee' | 'heart' | 'magic';

/**
 * Small collectibles. Dropped ones bounce and expire; placed ones (with a
 * `flag`) are collected once for good.
 */
export class Pickup extends Entity {
  private life: number;
  constructor(
    x: number,
    y: number,
    readonly kind: PickupKind,
    private flag: string | null = null,
    dropped = false,
  ) {
    super(x, y, 8, 10);
    this.layer = Layer.Pickups;
    this.life = dropped ? 480 : Infinity;
    if (dropped) {
      this.body.vy = -2.5;
      this.body.vx = (Math.random() - 0.5) * 1.2;
    }
  }

  onAdded(): void {
    if (this.flag && this.scene.progress.flag(this.flag)) this.dead = true;
  }

  update(): void {
    this.age++;
    const b = this.body;
    if (this.life !== Infinity || !b.onGround) {
      b.vy = Math.min(b.vy + 0.2, 4);
      b.vx *= 0.96;
      this.move();
      if (b.onGround) b.vx = 0;
    }
    if (--this.life <= 0) this.dead = true;
    const p = this.scene.player;
    if (p && p.state !== 'dead' && overlaps(p.body.rect(), b.rect())) this.collect();
  }

  private collect(): void {
    const s = this.scene;
    const prog = s.progress;
    this.dead = true;
    if (this.flag) prog.setFlag(this.flag);
    switch (this.kind) {
      case 'rupee':
        prog.addRupees(1);
        s.sfx('rupee');
        break;
      case 'bigRupee':
        prog.addRupees(5);
        s.sfx('rupee');
        break;
      case 'heart':
        prog.heal(2);
        s.sfx('heart');
        break;
      case 'magic':
        prog.magic = Math.min(32, prog.magic + 10);
        s.sfx('heart');
        break;
    }
    for (let i = 0; i < 5; i++)
      s.add(
        new Particle(this.x, this.y - 5, {
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 1.5,
          color: '#ffffff',
          life: 12,
        }),
      );
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    if (this.life < 90 && this.age % 6 < 3) return;
    const x = this.x - camX;
    const bob = this.body.onGround && this.life === Infinity ? Math.round(Math.sin(this.age / 15)) : 0;
    const y = this.y - camY + bob;
    switch (this.kind) {
      case 'rupee':
      case 'bigRupee': {
        const r = rupeeFrames()[this.kind === 'rupee' ? 'green' : 'blue'];
        r[this.age % 60 < 6 ? 1 : 0].draw(ctx, x, y);
        break;
      }
      case 'heart':
        smallHeart().draw(ctx, x, y);
        break;
      case 'magic':
        magicJar().draw(ctx, x, y);
        break;
    }
  }
}

/** Raises max hearts by one. Triggers the item fanfare. */
export class HeartContainer extends Entity {
  constructor(
    x: number,
    y: number,
    private flag: string,
  ) {
    super(x, y, 12, 12);
    this.layer = Layer.Pickups;
  }
  onAdded(): void {
    if (this.scene.progress.flag(this.flag)) this.dead = true;
  }
  update(): void {
    this.age++;
    const p = this.scene.player;
    if (p && p.state === 'normal' && overlaps(p.body.rect(), this.body.rect())) {
      this.dead = true;
      this.scene.progress.setFlag(this.flag);
      this.scene.host.collectHeartContainer();
    }
    if (this.age % 20 === 0)
      this.scene.add(
        new Particle(this.x + (Math.random() - 0.5) * 14, this.y - 6 - Math.random() * 10, {
          vx: 0,
          vy: -0.3,
          color: '#fff4d6',
          life: 24,
        }),
      );
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    heartContainer().draw(ctx, this.x - camX, this.y - camY - 1 + Math.round(Math.sin(this.age / 18) * 1.5));
  }
}

/** The prize: descends where the guardian fell. Touch it to win. */
export class Triforce extends Entity {
  private targetY: number;
  constructor(x: number, y: number) {
    super(x, -20, 14, 12);
    this.targetY = y - 18;
    this.layer = Layer.Pickups;
  }
  update(): void {
    this.age++;
    const b = this.body;
    if (b.y < this.targetY) b.y = Math.min(this.targetY, b.y + 1.2);
    const p = this.scene.player;
    if (b.y >= this.targetY && p && p.state === 'normal' && overlaps(p.body.rect(), { x: b.left - 4, y: b.top - 4, w: b.w + 8, h: b.h + 30 })) {
      this.dead = true;
      this.scene.host.collectTriforce();
    }
    if (this.age % 6 === 0)
      this.scene.add(
        new Particle(this.x + (Math.random() - 0.5) * 20, this.y - 6 + (Math.random() - 0.5) * 16, {
          vx: 0,
          vy: -0.2,
          color: Math.random() < 0.5 ? '#fff4a6' : '#ffffff',
          life: 30,
        }),
      );
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const bob = Math.round(Math.sin(this.age / 20) * 2);
    // soft glow
    ctx.globalAlpha = 0.25 + Math.sin(this.age / 10) * 0.1;
    ctx.fillStyle = '#fff4a6';
    const x = Math.round(this.x - camX);
    const y = Math.round(this.y - camY - 6 + bob);
    ctx.fillRect(x - 12, y - 10, 24, 20);
    ctx.fillRect(x - 9, y - 13, 18, 26);
    ctx.globalAlpha = 1;
    triforce().draw(ctx, this.x - camX, this.y - camY + bob);
  }
}
