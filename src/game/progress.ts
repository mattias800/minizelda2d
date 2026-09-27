import { ItemId } from '../world/rooms';

/** Everything that persists between sessions. */
export interface SaveData {
  version: 1;
  /** Where the player respawns / continues. */
  room: string;
  x: number;
  y: number;
  maxHearts: number;
  rupees: number;
  items: ItemId[];
  /** One-time world state: opened chests, burned brambles, collected hearts, defeated bosses... */
  flags: string[];
  visited: string[];
  playTicks: number;
  deaths: number;
}

const KEY = 'minizelda2d.save.v1';
export const START_HEARTS = 3;
export const MAX_MAGIC = 32;

export const TOTAL_HEART_CONTAINERS = 4;

export class Progress {
  data: SaveData;
  /** Live (non-persisted) state. */
  hp: number;
  magic: number;

  constructor(data?: SaveData) {
    this.data = data ?? Progress.fresh();
    this.hp = this.maxHp;
    this.magic = MAX_MAGIC;
  }

  static fresh(): SaveData {
    return {
      version: 1,
      room: 'clearing',
      x: -1,
      y: -1,
      maxHearts: START_HEARTS,
      rupees: 0,
      items: [],
      flags: [],
      visited: [],
      playTicks: 0,
      deaths: 0,
    };
  }

  /** HP is counted in half hearts. */
  get maxHp(): number {
    return this.data.maxHearts * 2;
  }

  has(item: ItemId): boolean {
    return this.data.items.includes(item);
  }
  give(item: ItemId): void {
    if (!this.has(item)) this.data.items.push(item);
  }

  flag(f: string): boolean {
    return this.data.flags.includes(f);
  }
  setFlag(f: string): void {
    if (!this.flag(f)) this.data.flags.push(f);
  }

  visit(room: string): void {
    if (!this.data.visited.includes(room)) this.data.visited.push(room);
  }

  heal(halfHearts: number): void {
    this.hp = Math.min(this.maxHp, this.hp + halfHearts);
  }

  addRupees(n: number): void {
    this.data.rupees = Math.min(999, this.data.rupees + n);
  }

  /** Completion percentage for the map / ending screens. */
  completion(): number {
    const total = 2 /* items */ + TOTAL_HEART_CONTAINERS + 1 /* boss */;
    const got =
      this.data.items.length +
      (this.data.maxHearts - START_HEARTS) +
      (this.flag('boss:guardian') ? 1 : 0);
    return Math.round((got / total) * 100);
  }

  // ---------------------------------------------------------- persistence

  static hasSave(): boolean {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  static load(): Progress | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 1) return null;
      return new Progress({ ...Progress.fresh(), ...data });
    } catch {
      return null;
    }
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable: progress lasts for this session only */
    }
  }

  static erase(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
