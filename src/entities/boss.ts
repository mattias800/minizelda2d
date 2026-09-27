import { Rect } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { moblinFrames } from '../gfx/sprites/moblin';
import { Enemy, DamageSource } from './entity';
import { Particle } from './effects';
import { Shockwave } from './projectiles';

type BossState = 'sleep' | 'roar' | 'walk' | 'windup' | 'swing' | 'crouch' | 'leap' | 'recover' | 'dying';

export const BOSS_FLAG = 'boss:guardian';
const MAX_HP = 26;

/**
 * The Guardian: a crowned moblin chieftain. Walks you down with a great
 * axe, and leaps to send shockwaves along the floor. Gets angrier at half HP.
 */
export class Guardian extends Enemy {
  private state: BossState = 'sleep';
  private t = 0;
  private walkT = 0;
  private leapCooldown = 180;
  private dyingT = 0;

  constructor(x: number, y: number) {
    super(x, y, 30, 54, MAX_HP);
    this.knockbackResist = 1;
    this.contactDamage = 2;
    this.weaponDamage = 3;
    this.facing = 1;
    this.loot = {};
  }

  onAdded(): void {
    if (this.scene.progress.flag(BOSS_FLAG)) this.dead = true;
  }

  get angry(): boolean {
    return this.hp <= MAX_HP / 2;
  }

  get hpFraction(): number {
    return Math.max(0, this.hp / MAX_HP);
  }

  get awake(): boolean {
    return this.state !== 'sleep';
  }

  vulnerableTo(_src: DamageSource): boolean {
    return this.state !== 'sleep' && this.state !== 'roar' && this.state !== 'dying';
  }

  hurt(dmg: number, fromX: number, src: DamageSource): boolean {
    const hit = super.hurt(dmg, fromX, src);
    if (hit) this.invuln = 24;
    return hit;
  }

  die(): void {
    // defer the real death: play a dramatic sequence first
    this.hp = 0;
    this.state = 'dying';
    this.dyingT = 0;
    this.scene.sfx('bossRoar');
    this.scene.host.onBossDying();
  }

  update(): void {
    this.tickCommon();
    const b = this.body;
    const s = this.scene;
    this.t++;
    const dx = this.playerDx();

    switch (this.state) {
      case 'sleep':
        if (s.player && s.player.x > this.x + 40 && s.player.x < s.map.widthPx - 48) {
          this.state = 'roar';
          this.t = 0;
          s.host.onBossAwake();
        }
        break;
      case 'roar':
        if (this.t === 20) {
          s.sfx('bossRoar');
          s.shake(8);
        }
        if (this.t > 70) this.go('walk');
        break;
      case 'walk': {
        this.facing = dx > 0 ? 1 : -1;
        b.vx = this.facing * (this.angry ? 1.0 : 0.7);
        this.walkT++;
        if (Math.abs(dx) < 64) this.go('windup');
        else if (--this.leapCooldown <= 0) this.go('crouch');
        break;
      }
      case 'windup':
        b.vx = 0;
        if (this.t > (this.angry ? 22 : 32)) {
          this.go('swing');
          s.sfx('sword');
          b.vx = this.facing * 2;
        }
        break;
      case 'swing':
        b.vx *= 0.85;
        if (this.t === 6) s.shake(3);
        if (this.t > 20) this.go('recover');
        break;
      case 'crouch':
        b.vx = 0;
        if (this.t > 24) {
          const p = s.player;
          const target = p ? p.x : this.x;
          b.vy = -6.2;
          b.vx = Math.max(-2.6, Math.min(2.6, (target - this.x) / 48));
          b.onGround = false;
          this.go('leap');
        }
        break;
      case 'leap':
        if (b.onGround && this.t > 4) {
          s.shake(7);
          s.sfx('bossHit');
          const sp = this.angry ? 2.8 : 2.2;
          s.add(new Shockwave(this.x - 16, b.y, -1, sp));
          s.add(new Shockwave(this.x + 16, b.y, 1, sp));
          if (this.angry) this.dropDebris();
          this.leapCooldown = this.angry ? 110 : 180;
          b.vx = 0;
          this.go('recover');
        }
        break;
      case 'recover':
        b.vx *= 0.8;
        if (this.t > (this.angry ? 30 : 48)) this.go('walk');
        break;
      case 'dying':
        b.vx = 0;
        this.dyingT++;
        this.flash = this.dyingT % 8 < 4 ? 2 : 0;
        if (this.dyingT % 8 === 0) {
          s.poof(this.x + (Math.random() - 0.5) * 36, this.y - Math.random() * 56);
          s.sfx('kill');
        }
        if (this.dyingT > 130) {
          this.dead = true;
          s.progress.setFlag(BOSS_FLAG);
          for (let i = 0; i < 6; i++) s.poof(this.x + (Math.random() - 0.5) * 30, this.y - Math.random() * 50);
          s.shake(10);
          s.host.onBossDefeated(this.x, this.y);
        }
        break;
    }

    b.vy = Math.min(b.vy + 0.26, 6);
    this.move();
    if (this.state !== 'dying' && this.state !== 'sleep') {
      if (this.touchesPlayer()) s.player?.hurt(this.contactDamage, this.x);
      const atk = this.attackBox();
      if (atk && this.touchesPlayer(atk)) s.player?.hurt(this.weaponDamage, this.x);
    }
  }

  private go(st: BossState): void {
    this.state = st;
    this.t = 0;
  }

  private dropDebris(): void {
    const s = this.scene;
    for (let i = 0; i < 3; i++) {
      const x = 40 + Math.random() * (s.map.widthPx - 80);
      s.add(new Debris(x, 36 + i * -20));
    }
  }

  attackBox(): Rect | null {
    if (this.state !== 'swing' || this.t > 14) return null;
    const b = this.body;
    return { x: this.facing > 0 ? b.right - 6 : b.left - 44, y: b.top - 6, w: 50, h: b.h + 6 };
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = moblinFrames('boss');
    let s = f.idle[Math.floor(this.age / 30) % 2];
    switch (this.state) {
      case 'sleep':
        s = f.idle[0];
        break;
      case 'roar':
        s = this.t > 16 ? f.windup[0] : f.idle[0];
        break;
      case 'walk':
        s = f.walk[Math.floor(this.walkT / 9) % 4];
        break;
      case 'windup':
      case 'crouch':
        s = f.windup[0];
        break;
      case 'swing':
        s = f.swing[0];
        break;
      case 'leap':
        s = f.windup[0];
        break;
      case 'recover':
        s = this.t < 14 ? f.swing[0] : f.idle[0];
        break;
      case 'dying':
        s = f.hurt[0];
        break;
    }
    const shake = this.state === 'dying' || (this.state === 'roar' && this.t > 20) ? (this.age % 2) * 2 - 1 : 0;
    const squat = this.state === 'crouch' ? 3 : 0;
    this.drawSprite(ctx, s, this.x - camX + shake, this.y - camY + squat, this.facing < 0);
  }
}

/** Rocks shaken loose from the ceiling during the guardian's rage. */
export class Debris extends Enemy {
  private vy = 0;
  private warn = 40;
  constructor(x: number, y: number) {
    super(x, y, 10, 10, 99);
    this.contactDamage = 2;
    this.loot = {};
  }
  vulnerableTo(): boolean {
    return false;
  }
  update(): void {
    this.age++;
    if (this.warn > 0) {
      this.warn--;
      return;
    }
    this.vy = Math.min(this.vy + 0.25, 5);
    this.body.y += this.vy;
    if (this.touchesPlayer()) {
      this.scene.player?.hurt(this.contactDamage, this.x);
      this.shatter();
    } else if (this.scene.solidInRect(this.body.rect())) this.shatter();
  }
  private shatter(): void {
    this.dead = true;
    for (let i = 0; i < 8; i++)
      this.scene.add(
        new Particle(this.x, this.y - 4, {
          vx: (Math.random() - 0.5) * 2.5,
          vy: -Math.random() * 2.5,
          color: i % 2 ? '#706c65' : '#aca090',
          life: 24,
          gravity: 0.2,
          size: 2,
        }),
      );
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const x = Math.round(this.x - camX);
    if (this.warn > 0) {
      // falling dust as a warning
      if (this.age % 4 < 2) {
        ctx.fillStyle = '#d8c8a8';
        ctx.fillRect(x - 3 + (this.age % 7), 34 + ((this.age * 3) % 20), 1, 2);
      }
      return;
    }
    const y = Math.round(this.y - camY);
    ctx.fillStyle = '#3e3a44';
    ctx.fillRect(x - 6, y - 11, 12, 11);
    ctx.fillStyle = '#8c8277';
    ctx.fillRect(x - 5, y - 10, 10, 9);
    ctx.fillStyle = '#aca090';
    ctx.fillRect(x - 5, y - 10, 6, 4);
  }
}
