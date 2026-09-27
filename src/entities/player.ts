import { Rect, approach, overlaps } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { HeroAnim, heroFrames } from '../gfx/sprites/hero';
import { Sprite } from '../gfx/sprite';
import { touchesTile } from '../world/physics';
import { Tile } from '../world/tilemap';
import { Enemy, Entity, Layer } from './entity';
import { Particle } from './effects';
import { Fireball } from './projectiles';

export const PHYS = {
  run: 1.55,
  accelGround: 0.3,
  decelGround: 0.42,
  accelAir: 0.25,
  gravity: 0.26,
  maxFall: 5.5,
  jump: 5.4,
  doubleJump: 4.6,
  coyote: 6,
  jumpBuffer: 7,
} as const;

const ATTACK_TICKS = 16;
const ACTIVE_FROM = 3;
const ACTIVE_TO = 10;
export const FIRE_COST = 4;

type State = 'normal' | 'attack' | 'hurt' | 'cast' | 'itemGet' | 'dead';

const STAND_H = 28;
const CROUCH_H = 18;

export class Player extends Entity {
  facing: 1 | -1 = 1;
  state: State = 'normal';
  private stateT = 0;
  crouching = false;
  private coyote = 0;
  private jumpBuffer = 0;
  private usedDouble = false;
  invuln = 0;
  private attackCrouch = false;
  private hitThisSwing = new Set<Enemy>();
  private walkDist = 0;
  private idleT = 0;
  /** Sprite held overhead during the item-get pose. */
  heldItem: Sprite | null = null;
  /** True while a down-thrust is aimed (in air, holding down). */
  private downThrust = false;
  private upThrust = false;
  private wasOnGround = true;

  constructor(x: number, y: number) {
    super(x, y, 10, STAND_H);
    this.layer = Layer.Player;
  }

  get busy(): boolean {
    return this.state === 'itemGet' || this.state === 'dead';
  }

  update(): void {
    const s = this.scene;
    const inp = s.input;
    const prog = s.progress;
    const b = this.body;
    this.age++;
    if (this.invuln > 0) this.invuln--;

    if (this.state === 'dead') {
      this.stateT++;
      b.vx *= 0.9;
      b.vy = Math.min(b.vy + PHYS.gravity, PHYS.maxFall);
      this.move();
      if (this.stateT === 100) s.host.playerDied();
      return;
    }
    if (this.state === 'itemGet') {
      b.vx = 0;
      b.vy = Math.min(b.vy + PHYS.gravity, PHYS.maxFall);
      this.move();
      return;
    }

    const left = inp.held('left');
    const right = inp.held('right');
    const down = inp.held('down');
    const up = inp.held('up');
    const control = this.state !== 'hurt';

    // --- timers
    if (this.state !== 'normal') {
      this.stateT--;
      if (this.stateT <= 0) this.state = 'normal';
    }
    if (b.onGround) {
      this.coyote = PHYS.coyote;
      this.usedDouble = false;
    } else if (this.coyote > 0) this.coyote--;
    if (inp.pressed('jump')) this.jumpBuffer = PHYS.jumpBuffer;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;

    // --- crouch (ground only)
    const wantCrouch = control && b.onGround && down && this.state !== 'cast';
    this.setCrouch(wantCrouch || (this.state === 'attack' && this.attackCrouch && b.onGround));

    // --- horizontal movement
    let dir = 0;
    if (control) dir = (right ? 1 : 0) - (left ? 1 : 0);
    const groundAttack = this.state === 'attack' && b.onGround;
    if (control && dir !== 0 && !groundAttack && this.state !== 'cast') this.facing = dir as 1 | -1;
    if (this.state === 'hurt') {
      // knockback: no control, just drag
      b.vx = approach(b.vx, 0, 0.05);
    } else if (this.crouching || groundAttack || this.state === 'cast') {
      b.vx = approach(b.vx, 0, PHYS.decelGround);
    } else if (dir !== 0) {
      b.vx = approach(b.vx, dir * PHYS.run, b.onGround ? PHYS.accelGround : PHYS.accelAir);
    } else {
      b.vx = approach(b.vx, 0, b.onGround ? PHYS.decelGround : PHYS.accelAir * 0.5);
    }

    // --- jumping
    if (control && this.jumpBuffer > 0 && this.state !== 'cast') {
      if (b.onGround && down && this.onOneWay()) {
        // drop through a platform
        b.dropThrough = 10;
        b.onGround = false;
        this.jumpBuffer = 0;
      } else if (this.coyote > 0) {
        b.vy = -PHYS.jump;
        b.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.setCrouch(false);
        s.sfx('jump');
      } else if (!this.usedDouble && prog.has('feather') && inp.pressed('jump')) {
        b.vy = -PHYS.doubleJump;
        this.usedDouble = true;
        this.jumpBuffer = 0;
        s.sfx('doubleJump');
        for (let i = 0; i < 10; i++)
          s.add(
            new Particle(this.x + (Math.random() - 0.5) * 10, this.y - 2, {
              vx: (Math.random() - 0.5) * 1.6,
              vy: Math.random() * 0.8,
              color: i % 2 ? '#ffffff' : '#c8d4e8',
              life: 20 + Math.random() * 10,
              drag: 0.92,
            }),
          );
      }
    }
    // variable jump height
    if (!inp.held('jump') && b.vy < -2 && this.state !== 'hurt') b.vy += PHYS.gravity * 1.6;

    // --- attack / magic
    if (control && this.state === 'normal') {
      if (inp.pressed('attack')) this.startAttack();
      else if (inp.pressed('item')) this.castFire();
    }

    // --- air thrusts
    this.downThrust = control && !b.onGround && down && this.state === 'normal';
    this.upThrust = control && !b.onGround && up && !down && this.state === 'normal';

    // --- interact
    if (control && this.state === 'normal' && b.onGround && inp.pressed('up')) s.interact(this);

    // --- physics
    b.vy = Math.min(b.vy + PHYS.gravity, PHYS.maxFall);
    this.move();
    if (b.onGround && !this.wasOnGround) {
      s.sfx('land');
      for (let i = 0; i < 6; i++)
        s.add(
          new Particle(this.x + (i - 2.5) * 2.5, this.y - 1, {
            vx: (i - 2.5) * 0.25,
            vy: -0.2 - Math.random() * 0.4,
            color: i % 2 ? '#e8dcc0' : '#c8b898',
            life: 14 + Math.random() * 8,
            drag: 0.9,
          }),
        );
    }
    this.wasOnGround = b.onGround;

    // --- sword hits
    const box = this.swordBox();
    if (box) {
      for (const e of s.enemies()) {
        if (this.hitThisSwing.has(e)) continue;
        if (!overlaps(box, e.hurtbox())) continue;
        const src = this.downThrust ? 'down' : this.upThrust ? 'up' : 'sword';
        if (e.hurt(src === 'down' ? 2 : 1, this.x, src)) {
          this.hitThisSwing.add(e);
          s.freeze(e.dead ? 5 : 3);
          if (src === 'down') {
            b.vy = -4.4;
            this.usedDouble = false;
            s.sfx('bounce');
          }
        } else if (src === 'down' && e.vulnerableTo('down') === false) {
          b.vy = -3.5;
          s.sfx('block');
        }
      }
    }
    if (!this.downThrust && !this.upThrust && this.state !== 'attack') this.hitThisSwing.clear();
    // Each separate thrust bounce may hit again.
    if ((this.downThrust || this.upThrust) && b.vy < -3) this.hitThisSwing.clear();

    // --- hazards
    if (touchesTile(b, s.map, Tile.Thorns, 3)) {
      if (this.hurt(1, this.x - this.facing)) b.vy = -4;
    }

    // --- animation bookkeeping
    if (b.onGround && Math.abs(b.vx) > 0.1) this.walkDist += Math.abs(b.vx);
    else this.walkDist = 0;
    this.idleT++;
  }

  private setCrouch(on: boolean): void {
    if (on === this.crouching) return;
    if (!on) {
      // can we stand up?
      const test = { x: this.body.left, y: this.body.y - STAND_H, w: this.body.w, h: STAND_H - CROUCH_H };
      if (this.scene.solidInRect(test)) return;
    }
    this.crouching = on;
    this.body.h = on ? CROUCH_H : STAND_H;
  }

  private onOneWay(): boolean {
    const m = this.scene.map;
    const cy = Math.floor((this.body.y + 1) / 16);
    const c0 = Math.floor(this.body.left / 16);
    const c1 = Math.floor((this.body.right - 0.01) / 16);
    for (let cx = c0; cx <= c1; cx++) if (m.get(cx, cy) !== Tile.OneWay && m.get(cx, cy) !== Tile.Empty) return false;
    return true;
  }

  private startAttack(): void {
    this.state = 'attack';
    this.stateT = ATTACK_TICKS;
    this.attackCrouch = this.crouching;
    this.hitThisSwing.clear();
    this.scene.sfx('sword');
  }

  private castFire(): void {
    const prog = this.scene.progress;
    if (!prog.has('fire')) return;
    if (prog.magic < FIRE_COST) {
      this.scene.sfx('blip');
      return;
    }
    prog.magic -= FIRE_COST;
    this.state = 'cast';
    this.stateT = 12;
    const y = this.y - (this.crouching ? 8 : 17);
    this.scene.add(new Fireball(this.x + this.facing * 10, y, this.facing));
    this.scene.sfx('fire');
  }

  /** The sword's active hitbox this tick, if any. */
  swordBox(): Rect | null {
    const b = this.body;
    if (this.downThrust) return { x: b.x - 4, y: b.y - 2, w: 8, h: 14 };
    if (this.upThrust) return { x: b.x - 4, y: b.top - 14, w: 8, h: 14 };
    if (this.state !== 'attack') return null;
    const t = ATTACK_TICKS - this.stateT;
    if (t < ACTIVE_FROM || t > ACTIVE_TO) return null;
    const low = this.attackCrouch && this.crouching;
    const y = low ? b.y - 15 : b.y - 24;
    const x0 = this.facing > 0 ? b.x + 3 : b.x - 27;
    return { x: x0, y, w: 24, h: 9 };
  }

  /** Shield check for a projectile at height `py` travelling in direction `dir`. */
  blocks(py: number, dir: number): boolean {
    if (this.state !== 'normal' || dir === this.facing) return false;
    const rel = this.y - py; // height above the feet
    return this.crouching ? rel < 14 : rel >= 13 && rel < 30;
  }

  hurt(dmg: number, fromX: number): boolean {
    if (this.invuln > 0 || this.state === 'dead' || this.state === 'itemGet') return false;
    const prog = this.scene.progress;
    prog.hp -= dmg;
    this.scene.shake(3);
    const dir = this.x >= fromX ? 1 : -1;
    this.body.vx = dir * 1.9;
    this.body.vy = -2.6;
    this.body.onGround = false;
    this.setCrouch(false);
    if (prog.hp <= 0) {
      prog.hp = 0;
      this.state = 'dead';
      this.stateT = 0;
      this.scene.sfx('hurt');
      this.scene.host.onPlayerDying();
      return true;
    }
    this.state = 'hurt';
    this.stateT = 20;
    this.invuln = 75;
    this.scene.sfx('hurt');
    return true;
  }

  beginItemGet(item: Sprite): void {
    this.state = 'itemGet';
    this.heldItem = item;
    this.body.vx = 0;
    this.setCrouch(false);
  }

  endItemGet(): void {
    this.state = 'normal';
    this.stateT = 0;
    this.heldItem = null;
  }

  private currentFrame(): Sprite {
    const f = heroFrames();
    const b = this.body;
    const pick = (anim: HeroAnim, i = 0) => f[anim][Math.min(i, f[anim].length - 1)];
    switch (this.state) {
      case 'dead':
        return this.stateT < 20 ? pick('hurt') : pick('dead');
      case 'hurt':
        return pick('hurt');
      case 'itemGet':
        return pick('itemGet');
      case 'cast':
        return pick('cast');
      case 'attack': {
        const t = ATTACK_TICKS - this.stateT;
        if (this.attackCrouch && this.crouching) return t >= ACTIVE_FROM && t <= ACTIVE_TO ? pick('crouchAttack') : pick('crouch');
        return pick('attack', t < ACTIVE_FROM ? 0 : t <= ACTIVE_TO ? 1 : 2);
      }
    }
    if (!b.onGround) {
      if (this.downThrust) return pick('downThrust');
      if (this.upThrust) return pick('upThrust');
      return b.vy < 0 ? pick('jump') : pick('fall');
    }
    if (this.crouching) return pick('crouch');
    if (Math.abs(b.vx) > 0.15) return pick('walk', Math.floor(this.walkDist / 5) % 6);
    const cycle = this.idleT % 200;
    if (cycle > 190) return pick('idle', 2);
    return pick('idle', Math.floor(this.idleT / 32) % 2);
  }

  draw(ctx: Ctx, camX: number, camY: number): void {
    if (this.invuln > 0 && this.state !== 'dead' && Math.floor(this.invuln / 3) % 2 === 0) return;
    this.currentFrame().draw(ctx, this.x - camX, this.y - camY, this.facing < 0);
    if (this.state === 'itemGet' && this.heldItem) this.heldItem.draw(ctx, this.x - camX + this.facing * 2, this.y - camY - 36);
  }
}
