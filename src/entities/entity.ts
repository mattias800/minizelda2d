import { Rect, overlaps } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { Sprite, silhouette } from '../gfx/sprite';
import type { Scene } from '../game/scene';
import { Body, moveBody } from '../world/physics';

/** Draw order buckets, back to front. */
export const enum Layer {
  Decor = 0,
  Props = 1,
  Pickups = 2,
  Actors = 3,
  Player = 4,
  Projectiles = 5,
  Effects = 6,
}

export abstract class Entity {
  readonly body: Body;
  dead = false;
  layer: Layer = Layer.Actors;
  /** Set by Scene.add(). */
  scene!: Scene;
  /** Ticks since spawn. */
  age = 0;

  constructor(x: number, y: number, w: number, h: number) {
    this.body = new Body(x, y, w, h);
  }

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }

  /** Called once when added to a scene. */
  onAdded(): void {}
  abstract update(): void;
  abstract draw(ctx: Ctx, camX: number, camY: number): void;

  protected move(): void {
    moveBody(this.body, this.scene.map);
  }
}

export type DamageSource = 'sword' | 'down' | 'up' | 'fire' | 'contact';

export interface LootTable {
  rupee?: number;
  bigRupee?: number;
  heart?: number;
  magic?: number;
}

/** Common behaviour for anything the hero can fight. */
export abstract class Enemy extends Entity {
  hp: number;
  contactDamage = 1;
  weaponDamage = 2;
  facing: 1 | -1 = -1;
  invuln = 0;
  flash = 0;
  /** 0 = full knockback, 1 = immovable. */
  knockbackResist = 0;
  /** Ticks of no AI after being hit. */
  stun = 0;
  loot: LootTable = { rupee: 0.5, heart: 0.2, magic: 0.15 };
  /** Persistent flag set on death (bosses / minibosses). */
  deathFlag: string | null = null;
  protected flashCache = new WeakMap<Sprite, Sprite>();

  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.layer = Layer.Actors;
  }

  hurtbox(): Rect {
    return this.body.rect();
  }

  /** Active weapon hitbox (club swing etc.), or null. */
  attackBox(): Rect | null {
    return null;
  }

  /** Can this attack source damage the enemy right now? */
  vulnerableTo(_src: DamageSource): boolean {
    return true;
  }

  hurt(dmg: number, fromX: number, src: DamageSource): boolean {
    if (this.invuln > 0 || this.dead || !this.vulnerableTo(src)) return false;
    this.hp -= dmg;
    this.invuln = 14;
    this.flash = 8;
    this.stun = Math.round(16 * (1 - this.knockbackResist));
    const dir = this.x >= fromX ? 1 : -1;
    this.body.vx = dir * 2.2 * (1 - this.knockbackResist);
    if (this.body.onGround && this.knockbackResist < 1) this.body.vy = -1.5 * (1 - this.knockbackResist);
    this.scene.spark(this.x, this.body.top + this.body.h / 2);
    if (this.hp <= 0) this.die();
    else this.scene.sfx(this.knockbackResist > 0.5 ? 'bossHit' : 'hit');
    return true;
  }

  die(): void {
    this.dead = true;
    this.scene.poof(this.x, this.body.top + this.body.h / 2);
    this.scene.sfx('kill');
    this.scene.dropLoot(this.x, this.body.top + this.body.h / 2, this.loot);
    if (this.deathFlag) this.scene.progress.setFlag(this.deathFlag);
  }

  /** Shared per-tick bookkeeping; subclasses call it first. */
  protected tickCommon(): void {
    this.age++;
    // enemies never wander out through a room's exits
    const half = this.body.w / 2;
    const maxX = this.scene.map.widthPx - half;
    if (this.body.x < half) this.body.x = half;
    else if (this.body.x > maxX) this.body.x = maxX;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.stun > 0) {
      this.stun--;
      this.body.vx *= 0.85;
    }
  }

  protected touchesPlayer(r: Rect = this.hurtbox()): boolean {
    const p = this.scene.player;
    return !!p && overlaps(r, p.body.rect());
  }

  /** Draws a sprite with the white hit flash applied. */
  protected drawSprite(ctx: Ctx, s: Sprite, x: number, y: number, flip: boolean): void {
    let img = s;
    if (this.flash > 0 && this.flash % 4 < 2) {
      let f = this.flashCache.get(s);
      if (!f) {
        f = silhouette(s, '#ffffff');
        this.flashCache.set(s, f);
      }
      img = f;
    }
    img.draw(ctx, x, y, flip);
  }

  protected playerDx(): number {
    const p = this.scene.player;
    return p ? p.x - this.x : 0;
  }
  protected playerDy(): number {
    const p = this.scene.player;
    return p ? p.y - this.y : 0;
  }
}
