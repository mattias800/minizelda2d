export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'item' | 'pause' | 'mute';

const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'item', 'pause'];

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyZ: 'jump',
  Space: 'jump',
  KeyJ: 'jump',
  KeyX: 'attack',
  KeyK: 'attack',
  KeyC: 'item',
  KeyL: 'item',
  KeyM: 'mute',
  Tab: 'pause',
  Enter: 'pause',
  Escape: 'pause',
};

/**
 * Polled input. Call `update()` once per fixed tick; then `held`, `pressed`
 * and `released` describe that tick. Keyboard and the first gamepad are merged.
 */
export class Input {
  private keys = new Set<Action>();
  private prev = new Set<Action>();
  private cur = new Set<Action>();
  /** Fires on the first user gesture; audio needs one to start. */
  onFirstInteraction: (() => void) | null = null;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (a) {
        this.keys.add(a);
        e.preventDefault();
      }
      this.interacted();
    });
    target.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.keys.delete(a);
    });
    target.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('pointerdown', () => this.interacted());
  }

  private interacted(): void {
    if (this.onFirstInteraction) {
      const cb = this.onFirstInteraction;
      this.onFirstInteraction = null;
      cb();
    }
  }

  update(): void {
    this.prev = this.cur;
    this.cur = new Set(this.keys);
    this.pollGamepad(this.cur);
  }

  private pollGamepad(into: Set<Action>): void {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (b(14) || ax < -0.4) into.add('left');
      if (b(15) || ax > 0.4) into.add('right');
      if (b(12) || ay < -0.5) into.add('up');
      if (b(13) || ay > 0.5) into.add('down');
      if (b(0)) into.add('jump');
      if (b(2)) into.add('attack');
      if (b(1) || b(3)) into.add('item');
      if (b(8) || b(9)) into.add('pause');
      if (into.size > 0) this.interacted();
      break;
    }
  }

  held(a: Action): boolean {
    return this.cur.has(a);
  }
  pressed(a: Action): boolean {
    return this.cur.has(a) && !this.prev.has(a);
  }
  released(a: Action): boolean {
    return !this.cur.has(a) && this.prev.has(a);
  }
  anyPressed(): boolean {
    return ACTIONS.some((a) => this.pressed(a));
  }
}
