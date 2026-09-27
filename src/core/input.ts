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
  /** Actions held by a script (automated play-tests); merged with real input. */
  scripted = new Set<Action>();
  /** Set briefly when a controller connects, for an on-screen notice. */
  padNotice: { name: string; t: number } | null = null;
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
    target.addEventListener('gamepadconnected', (e) => {
      this.padNotice = { name: (e as GamepadEvent).gamepad.id.replace(/\s*\(.*\)\s*/g, ' ').trim(), t: 180 };
    });
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
    if (this.padNotice && --this.padNotice.t <= 0) this.padNotice = null;
    this.prev = this.cur;
    this.cur = new Set([...this.keys, ...this.scripted]);
    this.pollGamepad(this.cur);
  }

  /**
   * Merges every connected pad: Windows often lists phantom devices (headsets,
   * duplicate driver entries) before the real controller.
   */
  private pollGamepad(into: Set<Action>): void {
    const pads = navigator.getGamepads?.() ?? [];
    const before = into.size;
    for (const pad of pads) {
      if (pad && pad.connected) readPad(pad, into);
    }
    if (into.size > before) this.interacted();
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

const STICK = 0.45;

/**
 * Standard mapping (Xbox layout): A jump, B/X sword, Y/shoulders fire,
 * Start/Back map. Non-standard pads get a best-effort mapping: first stick,
 * a POV hat axis if present, and the first four buttons.
 */
function readPad(pad: Gamepad, into: Set<Action>): void {
  const b = (i: number) => {
    const btn = pad.buttons[i];
    return !!btn && (btn.pressed || btn.value > 0.5);
  };
  const ax = pad.axes[0] ?? 0;
  const ay = pad.axes[1] ?? 0;
  if (ax < -STICK) into.add('left');
  if (ax > STICK) into.add('right');
  if (ay < -STICK - 0.1) into.add('up');
  if (ay > STICK + 0.1) into.add('down');

  if (pad.mapping === 'standard') {
    if (b(14)) into.add('left');
    if (b(15)) into.add('right');
    if (b(12)) into.add('up');
    if (b(13)) into.add('down');
    if (b(0)) into.add('jump');
    if (b(1) || b(2)) into.add('attack');
    if (b(3) || b(4) || b(5) || b(6) || b(7)) into.add('item');
    if (b(8) || b(9)) into.add('pause');
    return;
  }

  // Generic DirectInput-style pads: the d-pad is often a POV hat on one axis,
  // reported as -1 (up) stepping clockwise to 1, and ~3.3 when centred.
  const hat = pad.axes.length > 9 ? pad.axes[9] : undefined;
  if (hat !== undefined && hat >= -1.05 && hat <= 1.05) {
    const dir = Math.round((hat + 1) * 3.5) % 8; // 0 up, 2 right, 4 down, 6 left
    if (dir === 7 || dir === 0 || dir === 1) into.add('up');
    if (dir >= 1 && dir <= 3) into.add('right');
    if (dir >= 3 && dir <= 5) into.add('down');
    if (dir >= 5 && dir <= 7) into.add('left');
  }
  if (b(0)) into.add('jump');
  if (b(1) || b(2)) into.add('attack');
  if (b(3) || b(4) || b(5)) into.add('item');
  if (b(8) || b(9)) into.add('pause');
}
