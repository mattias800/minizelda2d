import { Rect } from '../core/math';
import { Ctx } from '../gfx/canvas';
import { squirrelFrames } from '../gfx/sprites/creatures';
import { brambleMass, chestFrames, saveStoneFrames } from '../gfx/sprites/props';
import { Sprite } from '../gfx/sprite';
import { drawBubble } from '../ui/bubble';
import { ItemId } from '../world/rooms';
import { TILE, Tile } from '../world/tilemap';
import { Entity, Layer } from './entity';
import { Particle } from './effects';
import type { Player } from './player';

/** Something the hero can use by pressing Up next to it. */
export interface Interactable {
  interactBox(): Rect;
  interact(p: Player): void;
  /** Shown as a hint above the prop when the hero is in range. */
  readonly prompt?: string;
}

export function isInteractable(e: Entity): e is Entity & Interactable {
  return typeof (e as Partial<Interactable>).interact === 'function';
}

/** Static scenery sprite. */
export class Decor extends Entity {
  constructor(
    x: number,
    y: number,
    private sprite: Sprite,
    private flip = false,
    layer: Layer = Layer.Decor,
  ) {
    super(x, y, 1, 1);
    this.layer = layer;
  }
  update(): void {}
  draw(ctx: Ctx, camX: number, camY: number): void {
    this.sprite.draw(ctx, this.x - camX, this.y - camY, this.flip);
  }
}

export class Chest extends Entity implements Interactable {
  private opened = false;
  readonly prompt = 'open';
  constructor(
    x: number,
    y: number,
    private item: ItemId,
    private flag: string,
  ) {
    super(x, y, 16, 12);
    this.layer = Layer.Props;
  }
  onAdded(): void {
    this.opened = this.scene.progress.flag(this.flag);
  }
  interactBox(): Rect {
    return this.opened ? { x: -99, y: -99, w: 0, h: 0 } : { x: this.body.left - 8, y: this.body.top - 16, w: 32, h: 30 };
  }
  interact(): void {
    if (this.opened) return;
    this.opened = true;
    this.scene.progress.setFlag(this.flag);
    this.scene.host.getItem(this.item);
  }
  update(): void {
    this.age++;
    if (!this.opened && this.age % 30 === 0)
      this.scene.add(
        new Particle(this.x + (Math.random() - 0.5) * 16, this.y - 12, { vx: 0, vy: -0.25, color: '#fff4a6', life: 30 }),
      );
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    chestFrames()[this.opened ? 1 : 0].draw(ctx, this.x - camX, this.y - camY);
  }
}

/** Heals, refills magic and saves the game. */
export class SaveStone extends Entity implements Interactable {
  readonly prompt = 'rest';
  constructor(x: number, y: number) {
    super(x, y, 16, 24);
    this.layer = Layer.Props;
  }
  interactBox(): Rect {
    return { x: this.body.left - 6, y: this.body.top, w: 28, h: 26 };
  }
  interact(): void {
    this.scene.host.saveAt(this.x, this.y);
  }
  update(): void {
    this.age++;
    if (this.age % 14 === 0)
      this.scene.add(
        new Particle(this.x + (Math.random() - 0.5) * 10, this.y - 16 - Math.random() * 6, {
          vx: 0,
          vy: -0.35,
          color: Math.random() < 0.5 ? '#9af4d8' : '#ffffff',
          life: 36,
        }),
      );
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const f = saveStoneFrames();
    const i = Math.floor(this.age / 16) % 4;
    f[[0, 1, 2, 1][i]].draw(ctx, this.x - camX, this.y - camY);
  }
}

/** The forest's chatty squirrel. Gives hints, and trades rupees for a heart. */
export class Squirrel extends Entity implements Interactable {
  readonly prompt = 'talk';
  private chirpT = 0;
  constructor(x: number, y: number) {
    super(x, y, 18, 18);
    this.layer = Layer.Props;
  }
  interactBox(): Rect {
    return { x: this.body.left - 10, y: this.body.top - 8, w: 38, h: 28 };
  }
  interact(): void {
    this.chirpT = 30;
    this.scene.sfx('blip');
    this.scene.host.talkSquirrel();
  }
  update(): void {
    this.age++;
    if (this.chirpT > 0) this.chirpT--;
    else if (this.age % 170 === 0) this.chirpT = 24;
  }
  draw(ctx: Ctx, camX: number, camY: number): void {
    const p = this.scene.player;
    const flip = !!p && p.x < this.x;
    const f = squirrelFrames();
    const hop = this.chirpT > 12 ? -Math.round(Math.sin(((this.chirpT - 12) / 12) * Math.PI) * 3) : 0;
    f[this.chirpT > 0 ? 1 : 0].draw(ctx, this.x - camX, this.y - camY + hop, flip);
    if (p && p.state === 'normal' && Math.abs(p.x - this.x) < 80 && Math.abs(p.y - this.y) < 40) drawBubble(ctx, 'kwee-koo!', this.x - camX + 2, this.body.top - camY - 6);
  }
}

/**
 * A clump of thorny brambles. Solid until burned by the fire spell, and
 * remembered as burned afterwards.
 */
export class Bramble extends Entity {
  private burning = -1;
  constructor(
    private tiles: [number, number][],
    private flag: string,
  ) {
    super(0, 0, 1, 1);
    this.layer = Layer.Props;
  }
  onAdded(): void {
    if (this.scene.progress.flag(this.flag)) {
      this.dead = true;
      return;
    }
    for (const [cx, cy] of this.tiles) this.scene.map.set(cx, cy, Tile.Bramble);
  }
  covers(r: Rect): boolean {
    return this.tiles.some(([cx, cy]) => {
      const x = cx * TILE;
      const y = cy * TILE;
      return r.x < x + TILE && r.x + r.w > x && r.y < y + TILE && r.y + r.h > y;
    });
  }
  ignite(): boolean {
    if (this.burning >= 0) return false;
    this.burning = 0;
    this.scene.sfx('burn');
    return true;
  }
  update(): void {
    this.age++;
    if (this.burning < 0) return;
    this.burning++;
    const s = this.scene;
    for (const [cx, cy] of this.tiles)
      if (Math.random() < 0.35)
        s.add(
          new Particle(cx * TILE + Math.random() * TILE, cy * TILE + Math.random() * TILE, {
            vx: (Math.random() - 0.5) * 0.4,
            vy: -0.6 - Math.random() * 0.8,
            color: ['#fff4a0', '#f8b030', '#e0503a', '#5a4a4a'][Math.floor(Math.random() * 4)],
            life: 18 + Math.random() * 16,
          }),
        );
    if (this.burning === 45) {
      for (const [cx, cy] of this.tiles) s.map.set(cx, cy, Tile.Empty);
      s.progress.setFlag(this.flag);
      this.dead = true;
    }
  }
  private art: ReturnType<typeof brambleMass> | null = null;

  draw(ctx: Ctx, camX: number, camY: number): void {
    this.art ??= brambleMass(this.tiles, this.tiles[0][0] * 31 + this.tiles[0][1]);
    const { sprite, x, y } = this.art;
    if (this.burning >= 0) {
      if (this.burning > 30 && this.burning % 4 < 2) return;
      ctx.globalAlpha = Math.max(0.15, 1 - this.burning / 48);
    }
    ctx.drawImage(sprite.img, Math.round(x - camX), Math.round(y - camY));
    ctx.globalAlpha = 1;
  }
}

/** The thorn wall that seals the boss arena while the fight is on. */
export class BossGate extends Entity {
  closed = false;
  private anim = 0;
  constructor(private tiles: [number, number][]) {
    super(0, 0, 1, 1);
    this.layer = Layer.Props;
  }
  setClosed(v: boolean): void {
    if (v === this.closed) return;
    this.closed = v;
    this.anim = 0;
    for (const [cx, cy] of this.tiles) this.scene.map.set(cx, cy, v ? Tile.Bramble : Tile.Empty);
    this.scene.sfx(v ? 'burn' : 'save');
    this.scene.shake(3);
  }
  update(): void {
    this.anim++;
  }
  private art: ReturnType<typeof brambleMass> | null = null;

  draw(ctx: Ctx, camX: number, camY: number): void {
    if (!this.closed && this.anim > 20) return;
    this.art ??= brambleMass(this.tiles, 77);
    const { sprite, x, y } = this.art;
    const grow = this.closed ? Math.min(1, this.anim / 16) : Math.max(0, 1 - this.anim / 20);
    const h = Math.round(sprite.h * grow);
    // grows up out of the ground
    ctx.drawImage(sprite.img, 0, sprite.h - h, sprite.w, h, Math.round(x - camX), Math.round(y - camY + sprite.h - h), sprite.w, h);
  }
}
