import { audio, SfxName } from '../core/audio';
import { Input } from '../core/input';
import { Rect, Rng, clamp, lerp, overlaps } from '../core/math';
import { Atmosphere } from '../gfx/atmosphere';
import { Backdrop, VIEW_H, VIEW_W, backdropFor } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import {
  bigTree,
  caveTufts,
  glowShroom,
  grassTufts,
  heartFlower,
  poofFrames,
  redMushroom,
  sparkFrames,
  yellowMushroom,
} from '../gfx/sprites/props';
import { paintTerrain } from '../gfx/terrain';
import { Guardian } from '../entities/boss';
import { Bat, Brute, Moblin, Slime, SpearMoblin, Spider } from '../entities/enemies';
import { AnimFx } from '../entities/effects';
import { Enemy, Entity, Layer, LootTable } from '../entities/entity';
import { HeartContainer, Pickup } from '../entities/pickups';
import { Player } from '../entities/player';
import { Bramble, BossGate, Chest, Decor, SaveStone, Squirrel, isInteractable } from '../entities/props';
import { parseRoom, Spawn } from '../world/level';
import { ItemId, RoomDef, SCREEN_COLS, SCREEN_ROWS, roomAtCell } from '../world/rooms';
import { TILE, Tile, TileMap } from '../world/tilemap';
import { Progress } from './progress';

export const SCREEN_W_PX = SCREEN_COLS * TILE;
export const SCREEN_H_PX = SCREEN_ROWS * TILE;

/** Callbacks from the world into the game shell (dialogs, saving, music...). */
export interface GameHost {
  onPlayerDying(): void;
  playerDied(): void;
  getItem(item: ItemId): void;
  collectHeartContainer(): void;
  saveAt(x: number, y: number): void;
  talkSquirrel(): void;
  onBossAwake(): void;
  onBossDying(): void;
  onBossDefeated(x: number, y: number): void;
  collectTriforce(): void;
}

export interface Entry {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  facing?: 1 | -1;
}

export interface ExitRequest {
  room: RoomDef;
  entry: Entry;
}

export class Scene {
  readonly map: TileMap;
  readonly terrain: HTMLCanvasElement;
  readonly backdrop: Backdrop;
  readonly atmosphere: Atmosphere;
  entities: Entity[] = [];
  player: Player | null = null;
  camX = 0;
  camY = 0;
  private shakeT = 0;
  private shakeAmp = 0;
  /** Freeze-frames after a solid hit, for impact. */
  private hitstop = 0;
  gate: BossGate | null = null;
  /** Set when the player walked off an edge into another room. */
  exit: ExitRequest | null = null;
  private pending: Entity[] = [];

  constructor(
    readonly def: RoomDef,
    readonly host: GameHost,
    readonly input: Input,
    readonly progress: Progress,
    entry: Entry | null,
  ) {
    const parsed = parseRoom(def);
    this.map = parsed.map;
    this.terrain = terrainFor(def, this.map);
    this.backdrop = backdropFor(def.theme);
    this.atmosphere = new Atmosphere(def.theme, this.map.widthPx, hashId(def.id));
    this.populate(parsed.spawns);

    let start = entry;
    if (!start) {
      const p = parsed.spawns.find((s) => s.kind === 'P');
      start = p ? { x: p.x, y: p.y } : { x: 40, y: 150 };
    }
    const player = new Player(start.x, start.y);
    player.body.vx = start.vx ?? 0;
    player.body.vy = start.vy ?? 0;
    player.facing = start.facing ?? 1;
    this.player = player;
    this.add(player);
    this.flushPending();
    this.snapCamera();
  }

  // ------------------------------------------------------------ population

  private populate(spawns: Spawn[]): void {
    const id = this.def.id;
    const cave = this.def.theme === 'cave';
    const brambleCells: [number, number][] = [];
    for (const s of spawns) {
      const flag = `${id}:${s.cx},${s.cy}`;
      switch (s.kind) {
        case 'm':
          this.add(new Moblin(s.x, s.y));
          break;
        case 'x':
          this.add(new SpearMoblin(s.x, s.y));
          break;
        case 'M':
          this.add(new Brute(s.x, s.y));
          break;
        case 's':
          this.add(new Slime(s.x, s.y, cave ? 'teal' : 'green'));
          break;
        case 'b':
          this.add(new Bat(s.x, s.y));
          break;
        case 'w':
          this.add(new Spider(s.x, s.y));
          break;
        case 'K':
          this.add(new Guardian(s.x, s.y));
          break;
        case 'r':
          this.add(new Pickup(s.x, s.y, 'rupee', `rupee:${flag}`));
          break;
        case '$':
          this.add(new Pickup(s.x, s.y, 'bigRupee', `rupee:${flag}`));
          break;
        case 'j':
          this.add(new Pickup(s.x, s.y, 'magic', null));
          break;
        case 'H':
          this.add(new HeartContainer(s.x, s.y, `heart:${flag}`));
          break;
        case 'c':
          if (this.def.chest) this.add(new Chest(s.x, s.y, this.def.chest, `chest:${id}`));
          break;
        case 'o':
          this.add(new SaveStone(s.x, s.y));
          break;
        case 'q':
          this.add(new Squirrel(s.x, s.y));
          break;
        case 'T':
          this.add(new Decor(s.x, s.y, bigTree()));
          break;
        case 'u':
          this.add(new Decor(s.x, s.y, yellowMushroom()));
          break;
        case 'U':
          this.add(new Decor(s.x + 4, s.y, redMushroom(), false, Layer.Effects));
          break;
        case 'f':
          this.add(new Decor(s.x, s.y, heartFlower()));
          break;
        case '*':
          brambleCells.push([s.cx, s.cy]);
          break;
      }
    }
    // Brambles: each 4-connected clump is one burnable entity.
    for (const clump of clumps(brambleCells)) {
      const [fx, fy] = clump[0];
      this.add(new Bramble(clump, `bramble:${id}:${fx},${fy}`));
    }
    if (id === 'lair') {
      const gate = new BossGate([
        [19, 7],
        [19, 8],
        [19, 9],
      ]);
      this.gate = gate;
      this.add(gate);
    }
    this.scatterDecor(spawns);
  }

  /** Sprinkles grass tufts and cave shrooms on flat ground. */
  private scatterDecor(spawns: Spawn[]): void {
    const theme = this.def.theme;
    if (theme === 'canopy' || theme === 'shrine') return;
    const rng = new Rng(hashId(this.def.id) + 3);
    const tufts = theme === 'cave' ? caveTufts() : grassTufts();
    const taken = new Set(spawns.map((s) => `${s.cx},${s.cy}`));
    const m = this.map;
    for (let cy = 1; cy < m.rows; cy++) {
      for (let cx = 0; cx < m.cols; cx++) {
        if (m.get(cx, cy) !== Tile.Solid || m.get(cx, cy - 1) !== Tile.Empty) continue;
        if (taken.has(`${cx},${cy - 1}`)) continue;
        const x = cx * TILE + rng.int(2, 14);
        const y = cy * TILE;
        if (rng.chance(theme === 'cave' ? 0.3 : 0.4)) this.add(new Decor(x, y + 1, rng.pick(tufts), rng.chance(0.5)));
        if (theme === 'cave' && rng.chance(0.12)) this.add(new Decor(x + 5, y, glowShroom()));
      }
    }
  }

  // ------------------------------------------------------------ helpers

  add(e: Entity): void {
    e.scene = this;
    this.pending.push(e);
  }

  private flushPending(): void {
    if (!this.pending.length) return;
    const list = this.pending;
    this.pending = [];
    for (const e of list) {
      this.entities.push(e);
      e.onAdded();
    }
  }

  *enemies(): Generator<Enemy> {
    for (const e of this.entities) if (e instanceof Enemy && !e.dead) yield e;
  }

  boss(): Guardian | null {
    for (const e of this.entities) if (e instanceof Guardian && !e.dead) return e;
    return null;
  }

  sfx(n: SfxName): void {
    audio.sfx(n);
  }

  freeze(ticks: number): void {
    this.hitstop = Math.max(this.hitstop, ticks);
  }

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 14;
  }

  poof(x: number, y: number): void {
    this.add(new AnimFx(x, y, poofFrames(), 4));
  }

  spark(x: number, y: number): void {
    this.add(new AnimFx(x, y, sparkFrames(), 3));
  }

  dropLoot(x: number, y: number, t: LootTable): void {
    const roll = Math.random();
    let acc = 0;
    const table: [keyof LootTable, 'rupee' | 'bigRupee' | 'heart' | 'magic'][] = [
      ['bigRupee', 'bigRupee'],
      ['heart', 'heart'],
      ['magic', 'magic'],
      ['rupee', 'rupee'],
    ];
    // Guaranteed drops (probability 1) always spawn; otherwise one weighted roll.
    for (const [k, kind] of table) if ((t[k] ?? 0) >= 1) this.add(new Pickup(x, y, kind, null, true));
    for (const [k, kind] of table) {
      const p = t[k] ?? 0;
      if (p >= 1) continue;
      acc += p * 0.55;
      if (roll < acc) {
        this.add(new Pickup(x, y, kind, null, true));
        return;
      }
    }
  }

  solidInRect(r: Rect): boolean {
    const c0 = Math.floor(r.x / TILE);
    const c1 = Math.floor((r.x + r.w - 0.01) / TILE);
    const r0 = Math.floor(r.y / TILE);
    const r1 = Math.floor((r.y + r.h - 0.01) / TILE);
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        if (this.map.isSolid(cx, cy)) return true;
        if (this.map.isSlope(this.map.get(cx, cy)) && this.map.isGroundPixel(r.x + r.w / 2, r.y + r.h - 1)) return true;
      }
    return false;
  }

  /** Ignites brambles touching `r`. Returns true if something caught fire. */
  burnAt(r: Rect): boolean {
    for (const e of this.entities)
      if (e instanceof Bramble && !e.dead && e.covers({ x: r.x - 2, y: r.y, w: r.w + 4, h: r.h })) return e.ignite() || true;
    return false;
  }

  interact(p: Player): void {
    const pr = p.body.rect();
    for (const e of this.entities) {
      if (e.dead || !isInteractable(e)) continue;
      if (overlaps(pr, e.interactBox())) {
        e.interact(p);
        return;
      }
    }
  }

  /** The interactable in reach, for drawing a hint. */
  interactableNear(p: Player): (Entity & { prompt?: string }) | null {
    const pr = p.body.rect();
    for (const e of this.entities) if (!e.dead && isInteractable(e) && overlaps(pr, e.interactBox())) return e;
    return null;
  }

  // ------------------------------------------------------------ update

  update(): void {
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    this.flushPending();
    for (const e of this.entities) if (!e.dead) e.update();
    this.flushPending();
    this.entities = this.entities.filter((e) => !e.dead || e === this.player);
    this.atmosphere.update();
    this.updateCamera();
    this.checkExit();
    if (this.shakeT > 0) this.shakeT--;
    else this.shakeAmp = 0;
  }

  private cameraTarget(): { x: number; y: number } {
    const p = this.player!;
    const maxX = Math.max(0, this.map.widthPx - VIEW_W);
    const maxY = Math.max(0, this.map.heightPx - VIEW_H);
    return {
      x: clamp(p.x - VIEW_W / 2 + p.facing * 20, 0, maxX),
      y: clamp(p.y - VIEW_H * 0.62, 0, maxY),
    };
  }

  private updateCamera(): void {
    if (!this.player) return;
    const t = this.cameraTarget();
    this.camX = lerp(this.camX, t.x, 0.1);
    this.camY = lerp(this.camY, t.y, 0.1);
  }

  snapCamera(): void {
    if (!this.player) return;
    const t = this.cameraTarget();
    this.camX = t.x;
    this.camY = t.y;
  }

  private checkExit(): void {
    const p = this.player;
    if (!p || p.state === 'dead') return;
    const b = p.body;
    const W = this.map.widthPx;
    const H = this.map.heightPx;
    let dir: 'left' | 'right' | 'up' | 'down' | null = null;
    if (b.x < 0) dir = 'left';
    else if (b.x > W) dir = 'right';
    else if (b.top < -6 && b.vy < 0) dir = 'up';
    else if (b.top > H) dir = 'down';
    if (!dir) {
      // keep the hero from getting stuck above the top edge of a closed room
      return;
    }
    // Probe just past the edge being crossed.
    const wx = this.def.gx * SCREEN_W_PX + b.x;
    const probeY = dir === 'up' ? b.top - 1 : dir === 'down' ? b.top : b.y - b.h / 2;
    const wy = this.def.gy * SCREEN_H_PX + probeY;
    const target = roomAtCell(Math.floor(wx / SCREEN_W_PX), Math.floor(wy / SCREEN_H_PX));
    if (!target || target === this.def) {
      // no room there: treat the edge as a wall
      if (dir === 'left') b.x = 0;
      if (dir === 'right') b.x = W;
      if (dir === 'up') {
        b.y = b.h - 6;
        b.vy = 0;
      }
      return;
    }
    const lx = wx - target.gx * SCREEN_W_PX;
    const ly = this.def.gy * SCREEN_H_PX + b.y - target.gy * SCREEN_H_PX;
    const tw = target.map[0].length * TILE;
    const th = target.map.length * TILE;
    const entry: Entry = { x: lx, y: ly, vx: b.vx, vy: b.vy, facing: p.facing };
    if (dir === 'left') entry.x = tw - 2;
    if (dir === 'right') entry.x = 2;
    if (dir === 'up') {
      entry.y = th - 2;
      entry.vy = Math.min(b.vy, -6.4);
    }
    if (dir === 'down') entry.y = b.h + 2;
    entry.x = clamp(entry.x, 2, tw - 2);
    this.exit = { room: target, entry };
  }

  // ------------------------------------------------------------ draw

  draw(ctx: Ctx): void {
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      sx = Math.round((Math.random() - 0.5) * this.shakeAmp);
      sy = Math.round((Math.random() - 0.5) * this.shakeAmp);
    }
    const camX = Math.round(this.camX) + sx;
    const camY = Math.round(this.camY) + sy;
    this.backdrop.draw(ctx, camX, camY);
    // decor that stands behind the terrain lip (the big tree) is drawn first
    const sorted = [...this.entities].sort((a, b) => a.layer - b.layer);
    for (const e of sorted) if (e.layer === Layer.Decor && e instanceof Decor) e.draw(ctx, camX, camY);
    ctx.drawImage(this.terrain, -camX, -camY);
    for (const e of sorted) if (e.layer !== Layer.Decor && !e.dead) e.draw(ctx, camX, camY);
    this.atmosphere.drawRays(ctx, camX);
    this.atmosphere.drawMotes(ctx, camX);
  }
}

const terrainCache = new Map<string, HTMLCanvasElement>();

/** Terrain art only depends on the room layout, so paint each room once. */
function terrainFor(def: RoomDef, map: TileMap): HTMLCanvasElement {
  let t = terrainCache.get(def.id);
  if (!t) {
    t = paintTerrain(map, def.theme, hashId(def.id));
    terrainCache.set(def.id, t);
  }
  return t;
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

function clumps(cells: [number, number][]): [number, number][][] {
  const left = new Set(cells.map(([x, y]) => `${x},${y}`));
  const out: [number, number][][] = [];
  for (const [x, y] of cells) {
    const k = `${x},${y}`;
    if (!left.has(k)) continue;
    const group: [number, number][] = [];
    const stack: [number, number][] = [[x, y]];
    left.delete(k);
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      group.push([cx, cy]);
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ]) {
        const nk = `${nx},${ny}`;
        if (left.has(nk)) {
          left.delete(nk);
          stack.push([nx, ny]);
        }
      }
    }
    out.push(group);
  }
  return out;
}
