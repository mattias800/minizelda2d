import { Rect, overlaps } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { fireballFrames, spearSprite } from '../gfx/sprites/props';
import { Entity, Layer } from './entity';
import { Particle } from './effects';

/** The hero's fire spell: burns brambles and scorches enemies. */
export class Fireball extends Entity {
  constructor(
    x: number,
    y: number,
    private dir: 1 | -1,
  ) {
    super(x, y, 8, 6);
    this.layer = Layer.Projectiles;
  }

  update(): void {
    const s = this.scene;
    this.age++;
    this.body.x += this.dir * 3.4;
    this.body.y += Math.sin(this.age / 3) * 0.3;
    if (this.age % 2 === 0)
      s.add(
        new Particle(this.x - this.dir * 4, this.y - 3 + (Math.random() - 0.5) * 4, {
          vx: -this.dir * 0.3,
          vy: -0.3 - Math.random() * 0.4,
          color: Math.random() < 0.5 ? '#f8b030' : '#e0503a',
          life: 14,
        }),
      );
    const r = this.body.rect();
    if (s.burnAt(r)) return this.explode();
    for (const e of s.enemies()) {
      if (overlaps(r, e.hurtbox()) && e.hurt(2, this.x - this.dir * 10, 'fire')) return this.explode();
    }
    if (s.solidInRect(r) || this.age > 80 || this.x < -16 || this.x > s.map.widthPx + 16) this.explode();
  }

  private explode(): void {
    this.dead = true;
    for (let i = 0; i < 10; i++)
      this.scene.add(
        new Particle(this.x, this.y - 3, {
          vx: (Math.random() - 0.5) * 2.4,
          vy: (Math.random() - 0.8) * 2,
          color: ['#fff4a0', '#f8b030', '#e0503a'][i % 3],
          life: 16 + Math.random() * 10,
          gravity: 0.08,
        }),
      );
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = fireballFrames()[Math.floor(this.age / 4) % 2];
    f.draw(ctx, this.x - camX, this.y - camY - 1, this.dir < 0);
  }
}

/** Thrown by spear moblins at head or knee height. The shield stops it. */
export class Spear extends Entity {
  private deflected = false;
  private vy = 0;
  private spin = 0;
  constructor(
    x: number,
    y: number,
    private dir: 1 | -1,
  ) {
    super(x, y, 14, 3);
    this.layer = Layer.Projectiles;
  }

  update(): void {
    const s = this.scene;
    this.age++;
    if (this.deflected) {
      this.vy += 0.25;
      this.body.x -= this.dir * 1.2;
      this.body.y += this.vy;
      this.spin++;
      if (this.age > 50) this.dead = true;
      return;
    }
    this.body.x += this.dir * 2.5;
    const p = s.player;
    const r: Rect = this.body.rect();
    if (p && p.state !== 'dead' && overlaps(r, p.body.rect())) {
      if (p.blocks(this.y - 1, this.dir)) {
        this.deflected = true;
        this.age = 0;
        this.vy = -2.5;
        s.sfx('block');
        s.spark(this.x + this.dir * 7, this.y - 1);
      } else if (p.hurt(2, this.x - this.dir * 20)) this.dead = true;
    }
    if (s.solidInRect(r) || this.age > 200) this.dead = true;
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const img = spearSprite();
    if (this.deflected && this.spin % 8 < 4) {
      ctx.save();
      ctx.translate(Math.round(this.x - camX), Math.round(this.y - camY));
      ctx.rotate(Math.PI / 2);
      img.draw(ctx, 0, 0, this.dir < 0);
      ctx.restore();
      return;
    }
    img.draw(ctx, this.x - camX, this.y - camY, this.dir < 0);
  }
}

/** A ground-hugging shockwave from the guardian's leap. Jump over it! */
export class Shockwave extends Entity {
  constructor(
    x: number,
    y: number,
    private dir: 1 | -1,
    private speed = 2.2,
  ) {
    super(x, y, 10, 12);
    this.layer = Layer.Projectiles;
  }
  update(): void {
    const s = this.scene;
    this.age++;
    this.body.x += this.dir * this.speed;
    const r = this.body.rect();
    const p = s.player;
    if (p && overlaps(r, p.body.rect())) p.hurt(2, this.x - this.dir * 10);
    if (this.age % 3 === 0)
      s.add(
        new Particle(this.x, this.y - 2, {
          vx: (Math.random() - 0.5) * 0.6,
          vy: -1 - Math.random(),
          color: Math.random() < 0.5 ? '#d8c8a8' : '#9a766d',
          life: 18,
          gravity: 0.1,
        }),
      );
    if (s.solidInRect({ x: r.x, y: r.y, w: r.w, h: r.h - 2 }) || this.age > 240) this.dead = true;
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const x = Math.round(this.x - camX);
    const y = Math.round(this.y - camY);
    const h = 8 + Math.round(Math.sin(this.age / 2) * 2);
    ctx.fillStyle = '#fff4d6';
    ctx.fillRect(x - 2, y - h, 4, h);
    ctx.fillStyle = '#f4c34e';
    ctx.fillRect(x - 4, y - h + 3, 2, h - 3);
    ctx.fillRect(x + 2, y - h + 3, 2, h - 3);
    ctx.fillStyle = '#e0503a';
    ctx.fillRect(x - 5, y - 3, 10, 3);
  }
}
