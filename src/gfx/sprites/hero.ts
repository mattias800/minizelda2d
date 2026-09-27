import { Painter } from '../painter';
import { Palette, Sprite } from '../sprite';

/**
 * The hero: a hand-pixeled head on a posed, procedurally drawn body. Poses
 * are data, so new animations are cheap to add.
 */

export type HeroAnim =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'fall'
  | 'crouch'
  | 'attack'
  | 'crouchAttack'
  | 'downThrust'
  | 'upThrust'
  | 'hurt'
  | 'cast'
  | 'itemGet'
  | 'dead';

export const HERO_CANVAS_W = 56;
export const HERO_CANVAS_H = 58;
/** Feet anchor inside the frame canvas. */
const AX = 26;
const AY = 46;

const C = {
  capL: '#d8f7a0',
  cap: '#8fd46a',
  capS: '#4f9e55',
  capD: '#336f4a',
  tunicL: '#c4ef8a',
  tunic: '#8fd46a',
  tunicS: '#5cae5a',
  tunicD: '#3d7f50',
  hair: '#f7dd8c',
  hairS: '#d9a85a',
  hairD: '#a8723c',
  skin: '#ffd9b4',
  skinS: '#eaa882',
  skinD: '#c77a64',
  eye: '#3a7de0',
  eyeD: '#1f3f8a',
  line: '#5a2e2e',
  leather: '#9a5f45',
  leatherD: '#6e3f36',
  pants: '#c79468',
  pantsS: '#9a6a4e',
  boot: '#5e3a32',
  bootD: '#3e2630',
  gold: '#f4c34e',
  steel: '#f2f6fa',
  steelS: '#b4c0cc',
  steelD: '#7888a0',
  hilt: '#4fc4c8',
  hiltD: '#2e8a9a',
  woodL: '#8a6a6e',
  wood: '#6a4a52',
  woodD: '#4a3440',
  iron: '#b8b2c0',
  ironD: '#7a7488',
};

const HEAD_PAL: Palette = {
  L: C.capL,
  G: C.cap,
  g: C.capS,
  e: C.capD,
  Y: C.hair,
  y: C.hairS,
  z: C.hairD,
  S: C.skin,
  s: C.skinS,
  r: C.skinD,
  B: C.eye,
  b: C.eyeD,
  k: C.line,
  W: '#ffffff',
};

// 14 x 15, facing right. Cap tail and pointed ear at the back (left).
const HEAD = [
  '......gGGg....',
  '....gGLLLGg...',
  '...gGLLGGGGg..',
  '..gGLGGGGGGGg.',
  '.gGGGGGGGGGGGg',
  '.gGGGzYYYYYYYz',
  'gGGgzYYYyYYYyY',
  'gGgzYYyzYYYzYY',
  'gGgSzYSSSzSSSY',
  'egSSSSSSkSSSkS',
  'egsSSsSSBSSSBS',
  '.esSSSSSBSSSBS',
  '..esSSSSSSSSSs',
  '....ssSSSSkSs.',
  '.....rssssss..',
];

const HEAD_HURT = HEAD.map((r, i) => (i === 10 ? 'egsSSsSSkSSSkS' : i === 11 ? '.esSSSSSSSSSSS' : r));
const HEAD_BLINK = HEAD.map((r, i) => (i === 10 ? 'egsSSsSSSSSSSS' : i === 11 ? '.esSSSSSkSSSkS' : r));

// 13 x 14 round wooden shield with an iron rim and boss.
const SHIELD_PAL: Palette = { I: C.iron, i: C.ironD, W: C.woodL, w: C.wood, d: C.woodD, o: C.gold };
const SHIELD = [
  '....iiiii....',
  '..iiWWwwwii..',
  '.iWWWwwwwwdi.',
  '.iWWwwwwwwdi.',
  'iWWwwwwwwwwdi',
  'iWwwwwIwwwwdi',
  'IWwwwIoIwwwdI',
  'IWwwwwIwwwwdI',
  'iwwwwwwwwwddi',
  'iwwwwwwwwwddi',
  '.iwwwwwwwddi.',
  '.iwwwwwwdddi.',
  '..iiwwdddii..',
  '....iiiii....',
];

interface Pose {
  /** Body vertical offset (+ down). */
  by?: number;
  /** Lean of the upper body (+ forward). */
  lean?: number;
  /** Feet [x offset from center, lift]. */
  front: [number, number];
  back: [number, number];
  /** Hands, relative to the shoulder of that arm. */
  handF: [number, number];
  handB: [number, number];
  /** Sword: held in the back hand, pointing at angle (degrees, 0 = forward, 90 = down). */
  sword?: { angle: number; len?: number } | null;
  shield?: 'front' | 'low' | 'up' | 'back' | 'none';
  head?: string[];
  headDy?: number;
  /** Degrees; rotates the whole frame result for the death pose. */
  lying?: boolean;
}

function drawHero(p: Pose): Sprite {
  const pt = new Painter(HERO_CANVAS_W, HERO_CANVAS_H);
  const by = p.by ?? 0;
  const lean = p.lean ?? 0;
  const hipX = AX + Math.round(lean * 0.3);
  const hipY = AY - 15 + by;
  const shX = AX + lean;
  const shY = hipY - 11;
  const shoulderB: [number, number] = [shX - 3, shY + 1];
  const shoulderF: [number, number] = [shX + 3, shY + 1];
  const handB: [number, number] = [shoulderB[0] + p.handB[0], shoulderB[1] + p.handB[1]];
  const handF: [number, number] = [shoulderF[0] + p.handF[0], shoulderF[1] + p.handF[1]];

  const leg = (hx: number, foot: [number, number], shade: boolean) => {
    const fx = AX + foot[0];
    const fy = AY - 1 - foot[1];
    const kx = (hx + fx) / 2 + 2;
    const ky = (hipY + fy) / 2;
    pt.line(hx, hipY, kx, ky, shade ? C.pantsS : C.pants, 3);
    pt.line(kx, ky, fx, fy - 3, shade ? C.boot : C.boot, 3);
    pt.rect(fx - 1, fy - 2, 5, 3, shade ? C.bootD : C.boot);
    pt.px(fx + 3, fy, C.bootD);
    pt.px(kx - 1, ky, shade ? C.bootD : C.leatherD);
  };

  const sword = () => {
    if (!p.sword) return;
    const a = (p.sword.angle * Math.PI) / 180;
    const len = p.sword.len ?? 13;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const [hx, hy] = handB;
    // grip behind the hand, crossguard at the hand
    pt.line(hx - dx * 3, hy - dy * 3, hx, hy, C.hiltD, 2);
    const gx = -dy;
    const gy = dx;
    pt.line(hx + dx + gx * 3, hy + dy + gy * 3, hx + dx - gx * 3, hy + dy - gy * 3, C.hilt, 2);
    const bx0 = hx + dx * 2;
    const by0 = hy + dy * 2;
    const bx1 = hx + dx * len;
    const by1 = hy + dy * len;
    pt.line(bx0, by0, bx1, by1, C.steelS, 3);
    pt.line(bx0 - gx * 0.6, by0 - gy * 0.6, bx1 - gx * 0.6, by1 - gy * 0.6, C.steel, 1);
    pt.px(bx1 + dx, by1 + dy, C.steelD);
  };

  const arm = (from: [number, number], to: [number, number], front: boolean) => {
    const mx = (from[0] + to[0]) / 2;
    const my = (from[1] + to[1]) / 2;
    pt.line(from[0], from[1], mx, my, front ? C.tunicS : C.tunicD, 3);
    pt.line(mx, my, to[0], to[1], front ? C.leather : C.leatherD, 3);
    pt.rect(to[0] - 1, to[1] - 1, 3, 3, front ? C.skin : C.skinS);
  };

  const shield = () => {
    const mode = p.shield ?? 'front';
    if (mode === 'none') return;
    let [sx, sy] = handF;
    if (mode === 'low') sy += 2;
    if (mode === 'back') {
      sx = shX - 7;
      sy = shY + 2;
    }
    pt.grid(SHIELD, SHIELD_PAL, sx - 6, sy - 7);
  };

  // --- back layer
  if (p.shield === 'back') shield();
  arm(shoulderB, handB, false);
  leg(hipX - 2, p.back, true);

  // --- torso (tunic with skirt), belt and strap
  pt.poly(
    [
      [shX - 5, shY - 1],
      [shX + 5, shY - 1],
      [hipX + 7, hipY + 4],
      [hipX - 7, hipY + 4],
    ],
    C.tunic,
  );
  pt.poly(
    [
      [shX - 5, shY - 1],
      [shX - 1, shY - 1],
      [hipX - 2, hipY + 4],
      [hipX - 7, hipY + 4],
    ],
    C.tunicS,
  );
  pt.line(shX + 1, shY, shX + 4, shY, C.tunicL, 1);
  pt.line(shX + 3, shY + 1, hipX + 5, hipY + 2, C.tunicL, 1);
  pt.line(hipX - 7, hipY + 4, hipX + 7, hipY + 4, C.tunicD, 1);
  // skirt notches
  pt.px(hipX - 2, hipY + 4, C.tunicD);
  pt.px(hipX + 3, hipY + 3, C.tunicS);
  // strap and belt
  pt.line(shX + 4, shY, hipX - 4, hipY - 2, C.leatherD, 1);
  pt.line(hipX - 6, hipY - 2, hipX + 6, hipY - 2, C.leatherD, 2);
  pt.rect(hipX + 1, hipY - 3, 3, 3, C.gold);

  // --- front leg in front of the tunic hem, then the blade over the legs
  leg(hipX + 2, p.front, false);
  sword();

  // --- head
  const head = p.head ?? HEAD;
  pt.grid(head, HEAD_PAL, shX - 7, shY - 14 + (p.headDy ?? 0));

  // --- front arm + shield
  arm(shoulderF, handF, true);
  if (p.shield !== 'back') shield();

  const s = pt.toSprite(AX, AY);
  if (!p.lying) return s;
  return rotateLying(s);
}

function rotateLying(s: Sprite): Sprite {
  const pt = new Painter(HERO_CANVAS_W, HERO_CANVAS_H);
  const ctx = pt.buf.toCanvas().getContext('2d')!;
  ctx.translate(AX, AY);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(s.img, -AX - 4, -AY + 12);
  return new Sprite(ctx.canvas, AX, AY);
}

const IDLE_BASE: Pose = {
  front: [5, 0],
  back: [-5, 0],
  handF: [6, 6],
  handB: [-1, 9],
  sword: { angle: 38 },
  shield: 'front',
};

function walkPose(i: number, n: number): Pose {
  const ph = (i / n) * Math.PI * 2;
  const fx = Math.round(Math.cos(ph) * 5);
  const lift = Math.max(0, Math.round(Math.sin(ph) * 3));
  const bx = Math.round(Math.cos(ph + Math.PI) * 5);
  const blift = Math.max(0, Math.round(Math.sin(ph + Math.PI) * 3));
  const bob = Math.abs(Math.sin(ph)) > 0.7 ? -1 : 0;
  return {
    ...IDLE_BASE,
    by: bob,
    lean: 1,
    front: [fx + 1, lift],
    back: [bx - 1, blift],
    handB: [-1 - Math.round(Math.cos(ph) * 2), 9],
    handF: [6, 6 + (bob ? 0 : 1)],
  };
}

let frames: Record<HeroAnim, Sprite[]> | null = null;

export function heroFrames(): Record<HeroAnim, Sprite[]> {
  if (frames) return frames;
  frames = {
    idle: [
      drawHero(IDLE_BASE),
      drawHero({ ...IDLE_BASE, by: 1, headDy: 0, handF: [6, 7], handB: [-1, 10] }),
      drawHero({ ...IDLE_BASE, head: HEAD_BLINK }),
    ],
    walk: Array.from({ length: 6 }, (_, i) => drawHero(walkPose(i, 6))),
    jump: [drawHero({ ...IDLE_BASE, by: -2, front: [5, 6], back: [-3, 3], handB: [-3, 6], sword: { angle: 20 } })],
    fall: [drawHero({ ...IDLE_BASE, by: -1, front: [3, 2], back: [-5, 4], handB: [-4, 3], handF: [5, 1], sword: { angle: 10 } })],
    crouch: [
      drawHero({ ...IDLE_BASE, by: 8, front: [6, 0], back: [-6, 0], handF: [4, 4], handB: [0, 5], sword: { angle: 20 }, shield: 'low' }),
    ],
    attack: [
      drawHero({ ...IDLE_BASE, lean: -1, handB: [-6, 0], sword: { angle: -150 }, handF: [3, 4] }),
      drawHero({ ...IDLE_BASE, lean: 2, front: [6, 0], back: [-6, 0], handB: [11, 3], sword: { angle: 0, len: 15 }, handF: [0, 5], shield: 'back' }),
      drawHero({ ...IDLE_BASE, lean: 1, front: [5, 0], back: [-5, 0], handB: [8, 5], sword: { angle: 12, len: 14 }, handF: [1, 5], shield: 'back' }),
    ],
    crouchAttack: [
      drawHero({ ...IDLE_BASE, by: 8, lean: 2, front: [7, 0], back: [-6, 0], handB: [11, 2], sword: { angle: 0, len: 15 }, handF: [1, 4], shield: 'back' }),
    ],
    downThrust: [
      drawHero({ ...IDLE_BASE, by: -3, front: [3, 7], back: [-3, 5], handB: [4, 9], sword: { angle: 90, len: 15 }, handF: [4, 1] }),
    ],
    upThrust: [
      drawHero({ ...IDLE_BASE, by: -2, front: [3, 5], back: [-3, 2], handB: [5, -9], sword: { angle: -90, len: 14 }, handF: [4, 3] }),
    ],
    hurt: [drawHero({ ...IDLE_BASE, lean: -3, front: [5, 2], back: [-4, 0], handB: [-5, -2], sword: { angle: -60 }, handF: [5, -1], head: HEAD_HURT, headDy: 1 })],
    cast: [drawHero({ ...IDLE_BASE, lean: 1, handF: [8, 0], handB: [-2, 8], shield: 'back' })],
    itemGet: [drawHero({ ...IDLE_BASE, handF: [2, -12], handB: [4, -12], sword: null, shield: 'back' })],
    dead: [drawHero({ ...IDLE_BASE, head: HEAD_HURT, lying: true, sword: null, shield: 'none' })],
  };
  return frames;
}
