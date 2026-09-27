import { Rect } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { batFrames, slimeFrames, SlimeColor, spiderFrames } from '../gfx/sprites/creatures';
import { MoblinKind, moblinFrames } from '../gfx/sprites/moblin';
import { groundAt } from '../world/physics';
import { Enemy } from './entity';
import { Spear } from './projectiles';

const GRAVITY = 0.26;

// ================================================================= moblins

type MoblinState = 'patrol' | 'windup' | 'swing' | 'recover' | 'throw';

/**
 * Club-swinging pig brute. Patrols, and when the hero comes close it winds up
 * a big overhead swing: back off, then punish.
 */
export class Moblin extends Enemy {
  protected state: MoblinState = 'patrol';
  protected t = 0;
  protected walkT = 0;
  protected homeX: number;
  protected speed = 0.45;
  protected reach = 56;
  protected windupTicks = 26;
  protected swingTicks = 14;
  protected recoverTicks = 40;

  constructor(
    x: number,
    y: number,
    protected kind: MoblinKind = 'moblin',
    hp = 3,
  ) {
    super(x, y, 16, 30, hp);
    this.homeX = x;
    this.loot = { rupee: 0.7, bigRupee: 0.1, heart: 0.3, magic: 0.2 };
  }

  update(): void {
    this.tickCommon();
    const b = this.body;
    if (this.stun <= 0) this.think();
    b.vy = Math.min(b.vy + GRAVITY, 5);
    this.move();
    if (this.touchesPlayer()) this.scene.player?.hurt(this.contactDamage, this.x);
    const atk = this.attackBox();
    if (atk && this.touchesPlayer(atk)) this.scene.player?.hurt(this.weaponDamage, this.x);
  }

  protected think(): void {
    const b = this.body;
    const dx = this.playerDx();
    const near = Math.abs(dx) < this.reach && Math.abs(this.playerDy()) < 40;
    this.t++;
    switch (this.state) {
      case 'patrol': {
        if (near && this.t > 20) {
          this.facing = dx > 0 ? 1 : -1;
          this.state = 'windup';
          this.t = 0;
          b.vx = 0;
          break;
        }
        // approach if the hero is around, otherwise wander near home
        const chase = Math.abs(dx) < 150 && Math.abs(this.playerDy()) < 48;
        let want: number;
        if (chase) want = dx > 0 ? 1 : -1;
        else {
          if (Math.abs(this.x - this.homeX) > 40) this.facing = this.x > this.homeX ? -1 : 1;
          want = this.facing;
        }
        this.facing = want as 1 | -1;
        const aheadX = this.x + this.facing * 12;
        if (!groundAt(this.scene.map, aheadX, b.y) || (this.facing > 0 ? b.hitWallRight : b.hitWallLeft)) {
          this.facing = -this.facing as 1 | -1;
          b.vx = 0;
        } else b.vx = this.facing * this.speed;
        this.walkT++;
        break;
      }
      case 'windup':
        b.vx = 0;
        if (this.t >= this.windupTicks) {
          this.state = 'swing';
          this.t = 0;
          this.scene.sfx('sword');
          b.vx = this.facing * 1.2;
        }
        break;
      case 'swing':
        b.vx *= 0.8;
        if (this.t >= this.swingTicks) {
          this.state = 'recover';
          this.t = 0;
        }
        break;
      case 'recover':
        b.vx = 0;
        if (this.t >= this.recoverTicks) {
          this.state = 'patrol';
          this.t = 0;
        }
        break;
    }
  }

  attackBox(): Rect | null {
    if (this.state !== 'swing' || this.t > 10) return null;
    const b = this.body;
    return { x: this.facing > 0 ? b.right - 2 : b.left - 22, y: b.top + 4, w: 24, h: b.h - 2 };
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = moblinFrames(this.kind);
    let s = f.idle[Math.floor(this.age / 30) % 2];
    if (this.stun > 0) s = f.hurt[0];
    else if (this.state === 'windup') s = f.windup[0];
    else if (this.state === 'swing' || (this.state === 'recover' && this.t < 12)) s = f.swing[0];
    else if (this.state === 'throw') s = f.throw[0];
    else if (Math.abs(this.body.vx) > 0.1) s = f.walk[Math.floor(this.walkT / 8) % 4];
    // shake during windup
    const shake = this.state === 'windup' && this.t > this.windupTicks - 10 ? (this.t % 2) * 2 - 1 : 0;
    this.drawSprite(ctx, s, this.x - camX + shake, this.y - camY, this.facing < 0);
  }
}

/** Keeps its distance and hurls spears at head or knee height. */
export class SpearMoblin extends Moblin {
  private throwCooldown = 70;
  private throwLow = false;

  constructor(x: number, y: number) {
    super(x, y, 'spear', 4);
    this.speed = 0.5;
  }

  protected think(): void {
    const b = this.body;
    const dx = this.playerDx();
    this.facing = dx > 0 ? 1 : -1;
    this.t++;
    if (this.state === 'throw') {
      b.vx = 0;
      if (this.t === 10) {
        const y = this.throwLow ? this.y - 8 : this.y - 22;
        this.scene.add(new Spear(this.x + this.facing * 10, y, this.facing));
        this.scene.sfx('sword');
      }
      if (this.t > 26) {
        this.state = 'patrol';
        this.t = 0;
      }
      return;
    }
    // keep a comfortable distance
    const dist = Math.abs(dx);
    let move = 0;
    if (dist < 70) move = -this.facing;
    else if (dist > 130) move = this.facing;
    const aheadX = this.x + move * 12;
    if (move !== 0 && groundAt(this.scene.map, aheadX, b.y) && !(move > 0 ? b.hitWallRight : b.hitWallLeft)) {
      b.vx = move * this.speed;
      this.walkT++;
    } else b.vx = 0;
    if (--this.throwCooldown <= 0 && dist < 200 && Math.abs(this.playerDy()) < 40) {
      this.state = 'throw';
      this.t = 0;
      this.throwLow = Math.random() < 0.45;
      this.throwCooldown = 80 + Math.floor(Math.random() * 50);
    }
  }

  attackBox(): Rect | null {
    return null;
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = moblinFrames('spear');
    let s = f.idle[Math.floor(this.age / 30) % 2];
    if (this.stun > 0) s = f.hurt[0];
    else if (this.state === 'throw') s = this.t < 10 ? (this.throwLow ? f.swing[0] : f.windup[0]) : f.throw[0];
    else if (Math.abs(this.body.vx) > 0.1) s = f.walk[Math.floor(this.walkT / 8) % 4];
    this.drawSprite(ctx, s, this.x - camX, this.y - camY, this.facing < 0);
  }
}

/** The cavern's armoured miniboss: big axe, slow, tough. */
export class Brute extends Moblin {
  constructor(x: number, y: number) {
    super(x, y, 'brute', 10);
    this.body.w = 20;
    this.body.h = 40;
    this.knockbackResist = 0.75;
    this.contactDamage = 1;
    this.weaponDamage = 2;
    this.speed = 0.6;
    this.reach = 62;
    this.windupTicks = 30;
    this.swingTicks = 16;
    this.recoverTicks = 46;
    this.deathFlag = 'boss:brute';
    this.loot = { bigRupee: 1, heart: 1 };
  }

  onAdded(): void {
    if (this.scene.progress.flag('boss:brute')) this.dead = true;
  }

  attackBox(): Rect | null {
    if (this.state !== 'swing' || this.t > 12) return null;
    const b = this.body;
    return { x: this.facing > 0 ? b.right - 4 : b.left - 30, y: b.top, w: 34, h: b.h };
  }

  die(): void {
    super.die();
    this.scene.shake(6);
    for (let i = 0; i < 4; i++) this.scene.poof(this.x + (Math.random() - 0.5) * 24, this.y - 10 - Math.random() * 30);
  }
}

// ================================================================= slime

/** Hops toward the hero. One hit. */
export class Slime extends Enemy {
  private hopT: number;
  constructor(
    x: number,
    y: number,
    private color: SlimeColor = 'green',
  ) {
    super(x, y, 12, 9, 1);
    this.hopT = 30 + Math.floor(Math.random() * 40);
    this.loot = { rupee: 0.4, heart: 0.15, magic: 0.25 };
  }

  update(): void {
    this.tickCommon();
    const b = this.body;
    if (b.onGround && this.stun <= 0) {
      b.vx *= 0.7;
      if (--this.hopT <= 0) {
        const dx = this.playerDx();
        const dir = Math.abs(dx) < 180 ? Math.sign(dx) || 1 : Math.random() < 0.5 ? -1 : 1;
        b.vx = dir * 1.1;
        b.vy = -3 - Math.random();
        this.hopT = 40 + Math.floor(Math.random() * 30);
      }
    }
    b.vy = Math.min(b.vy + GRAVITY, 5);
    this.move();
    if (this.touchesPlayer()) this.scene.player?.hurt(this.contactDamage, this.x);
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = slimeFrames(this.color);
    const b = this.body;
    let s = f[0];
    if (!b.onGround) s = f[2];
    else if (this.hopT < 8 || this.hopT > 36) s = f[1];
    this.drawSprite(ctx, s, this.x - camX, this.y - camY, false);
  }
}

// ================================================================= bat

/** Hangs still until the hero comes near, then swoops in sine waves. */
export class Bat extends Enemy {
  private awake = false;
  private t = 0;
  private baseY: number;
  constructor(x: number, y: number) {
    super(x, y - 4, 12, 8, 1);
    this.baseY = y - 8;
    this.loot = { rupee: 0.4, magic: 0.3 };
  }

  update(): void {
    this.tickCommon();
    const b = this.body;
    const dx = this.playerDx();
    if (!this.awake) {
      if (Math.abs(dx) < 90 && Math.abs(this.playerDy()) < 110) this.awake = true;
      return;
    }
    this.t++;
    if (this.stun > 0) {
      b.x += b.vx;
      return;
    }
    const p = this.scene.player;
    const targetY = p ? p.y - 18 : this.baseY;
    this.baseY += Math.sign(targetY - this.baseY) * 0.35;
    b.vx += Math.sign(dx) * 0.05;
    b.vx = Math.max(-1.3, Math.min(1.3, b.vx));
    b.x += b.vx;
    b.y = this.baseY + Math.sin(this.t / 12) * 14;
    if (this.touchesPlayer()) this.scene.player?.hurt(this.contactDamage, this.x);
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = batFrames();
    const s = this.awake ? f[Math.floor(this.age / 6) % 2] : f[1];
    this.drawSprite(ctx, s, this.x - camX, this.y - camY - 4, false);
  }
}

// ================================================================= spider

/** Dangles on a silk thread and drops on anyone passing underneath. */
export class Spider extends Enemy {
  private anchorY: number;
  private dropTo: number;
  private phase: 'wait' | 'drop' | 'climb' = 'wait';
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y, 12, 10, 2);
    this.anchorY = y - 16;
    this.body.y = this.anchorY + 26;
    this.dropTo = y + 70;
    this.loot = { rupee: 0.6, heart: 0.2 };
  }

  update(): void {
    this.tickCommon();
    const b = this.body;
    this.t++;
    const dx = Math.abs(this.playerDx());
    switch (this.phase) {
      case 'wait':
        b.y = this.anchorY + 26 + Math.sin(this.t / 20) * 3;
        if (dx < 34 && this.playerDy() > 0) {
          this.phase = 'drop';
          this.t = 0;
        }
        break;
      case 'drop':
        b.y = Math.min(this.dropTo, b.y + 3);
        if (b.y >= this.dropTo || this.scene.solidInRect(b.rect())) {
          this.phase = 'climb';
          this.t = 0;
        }
        break;
      case 'climb':
        if (this.t > 40) b.y = Math.max(this.anchorY + 26, b.y - 0.8);
        if (b.y <= this.anchorY + 26) this.phase = 'wait';
        break;
    }
    if (this.touchesPlayer()) this.scene.player?.hurt(this.contactDamage, this.x);
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const x = Math.round(this.x - camX);
    ctx.fillStyle = '#e8f0f0';
    const top = Math.round(this.anchorY - camY);
    const bot = Math.round(this.body.top - camY);
    for (let y = top; y < bot; y++) if (y % 3 !== 2) ctx.fillRect(x, y, 1, 1);
    const f = spiderFrames();
    this.drawSprite(ctx, f[Math.floor(this.age / 10) % 2], this.x - camX, this.body.top - camY - 1, false);
  }
}
