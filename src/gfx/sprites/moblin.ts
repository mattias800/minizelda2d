import { Painter } from '../painter';
import { Palette, Sprite } from '../sprite';

/**
 * Moblins: a family of pig-orc brutes sharing one parametric body painter.
 * Variants differ by palette, head, scale and weapon.
 */

export type MoblinAnim = 'idle' | 'walk' | 'windup' | 'swing' | 'hurt' | 'throw';

interface SkinRamp {
  hi: string;
  base: string;
  shade: string;
  dark: string;
}

export interface MoblinStyle {
  skin: SkinRamp;
  horn: string;
  hornHi: string;
  eye: string;
  cloth: string;
  clothShade: string;
  legs: string;
  legsDark: string;
  weapon: 'club' | 'spear' | 'axe';
  scale: number;
  head: string[];
  crown?: boolean;
}

// 14 x 13 facing right: horns, heavy brow, snout with tusks, earring at the back.
const HEAD = [
  '.KK.......KK..',
  '.KkK.....KkK..',
  '..KRRRRRRRK...',
  '..RHHHRRRRRr..',
  '.RHHRRRRRRRRr.',
  '.RHRRRddRRRRr.',
  'oRRRRdWERRRRRr',
  'oRrRRRddRRRRRr',
  '.rRRRRRRRRRHHR',
  '.rrRRRTmmTRRRR',
  '..rrRRTmmmmTRr',
  '...rrrRRRRRRr.',
  '....rrrrrrrr..',
];

// 18 x 16 helmeted brute head.
const BRUTE_HEAD = [
  '..KK..........KK..',
  '..KkK........KkK..',
  '...KkKIIIIIIKkK...',
  '....IiiiiiiiiiI...',
  '...IiiiIIIIiiiiI..',
  '..IIIIIIIIIIIIIII.',
  '..RRRRddRRRddRRRr.',
  '.oRRRdWERRRdWERRr.',
  '.oRrRRddRRRRddRRRr',
  '..rRRRRRRRRRRRHHHR',
  '..rrRRRTmmmmTRRRRR',
  '...rrRRTmmmmmmTRRr',
  '...rrrRRTTRRTTRRr.',
  '....rrrRRRRRRRRr..',
  '.....rrrrrrrrrr...',
  '..................',
];

// 20 x 18 chieftain head with a bone crown.
const BOSS_HEAD = [
  '....o...o...o...o...',
  '...ooo.ooo.ooo.ooo..',
  '..KKooooooooooooKK..',
  '.KkKTTTTTTTTTTTTKkK.',
  '.KkRRRRRRRRRRRRRRKk.',
  '..RHHHRRRRRRRRRRRr..',
  '.RHHRRRRddRRRRddRRr.',
  '.RHRRRRdWEdRRRdWERr.',
  'oRRRRRRddRRRRRRddRRr',
  'oRrRRRRRRRRRRRRRRRRr',
  '.rRRRRRRRRRRRRRRHHHR',
  '.rrRRRRRTTmmmmTTRRRR',
  '..rrRRRRTmmmmmmTRRRr',
  '..rrrRRRRTmmmmTRRRr.',
  '...rrrRRRTTRRTTRRRr.',
  '....rrrRRRRRRRRRRr..',
  '.....rrrrrrrrrrrr...',
  '....................',
];

export const MOBLIN_STYLES = {
  moblin: {
    skin: { hi: '#f6a67f', base: '#e8825f', shade: '#c05d4a', dark: '#8e3b3e' },
    horn: '#3e3a48',
    hornHi: '#6a6478',
    eye: '#58c878',
    cloth: '#ead2a0',
    clothShade: '#bf9a6e',
    legs: '#7a4638',
    legsDark: '#4e2c2c',
    weapon: 'club',
    scale: 1,
    head: HEAD,
  },
  spear: {
    skin: { hi: '#9ad0e8', base: '#5f9fd0', shade: '#3f72a8', dark: '#2a4a7a' },
    horn: '#3e3a48',
    hornHi: '#7a7488',
    eye: '#f4c34e',
    cloth: '#c97a5a',
    clothShade: '#8e4e3e',
    legs: '#4e3a4a',
    legsDark: '#2e2432',
    weapon: 'spear',
    scale: 1,
    head: HEAD,
  },
  brute: {
    skin: { hi: '#b8a6d8', base: '#8a78b4', shade: '#62568a', dark: '#40385e' },
    horn: '#2a2634',
    hornHi: '#5a5468',
    eye: '#ff6a5a',
    cloth: '#7a6a5a',
    clothShade: '#524538',
    legs: '#3e3040',
    legsDark: '#241c28',
    weapon: 'axe',
    scale: 1.3,
    head: BRUTE_HEAD,
  },
  boss: {
    skin: { hi: '#f08a7a', base: '#c8504e', shade: '#96383e', dark: '#62222e' },
    horn: '#2a2634',
    hornHi: '#5a5468',
    eye: '#ffe066',
    cloth: '#3e3a52',
    clothShade: '#28253a',
    legs: '#3a2630',
    legsDark: '#22161c',
    weapon: 'axe',
    scale: 1.65,
    head: BOSS_HEAD,
    crown: true,
  },
} satisfies Record<string, MoblinStyle>;

export type MoblinKind = keyof typeof MOBLIN_STYLES;

interface MPose {
  by?: number;
  lean?: number;
  front: [number, number];
  back: [number, number];
  /** Weapon angle in degrees (0 = forward, -90 = up), held in the back hand. */
  weapon: number;
  handB: [number, number];
  handF: [number, number];
  hurt?: boolean;
  noWeapon?: boolean;
}

function drawMoblin(st: MoblinStyle, p: MPose): Sprite {
  const s = st.scale;
  const W = Math.ceil(64 * s);
  const H = Math.ceil(60 * s);
  const AX = Math.round(W * 0.42);
  const AY = H - 4;
  const pt = new Painter(W, H);
  const S = (v: number) => Math.round(v * s);
  const by = S(p.by ?? 0);
  const lean = S(p.lean ?? 0);
  const hipX = AX;
  const hipY = AY - S(14) + by;
  const shX = AX + lean + S(1);
  const shY = hipY - S(12);
  const hB: [number, number] = [shX - S(6) + S(p.handB[0]), shY + S(3) + S(p.handB[1])];
  const hF: [number, number] = [shX + S(6) + S(p.handF[0]), shY + S(3) + S(p.handF[1])];
  const k = st.skin;

  const leg = (hx: number, foot: [number, number], back: boolean) => {
    const fx = AX + S(foot[0]);
    const fy = AY - 1 - S(foot[1]);
    pt.line(hx, hipY, fx, fy - S(2), back ? st.legsDark : st.legs, S(5));
    pt.rect(fx - S(3), fy - S(3), S(7), S(4), back ? st.legsDark : st.legs);
    pt.rect(fx - S(3), fy, S(7), 1, st.legsDark);
  };

  const weapon = () => {
    if (p.noWeapon) return;
    const a = (p.weapon * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const [x, y] = hB;
    if (st.weapon === 'club') {
      // a heavy stone slab on a short handle
      pt.line(x - dx * S(2), y - dy * S(2), x + dx * S(4), y + dy * S(4), '#5e3a32', S(3));
      const x0 = x + dx * S(4);
      const y0 = y + dy * S(4);
      const x1 = x + dx * S(15);
      const y1 = y + dy * S(15);
      pt.line(x0, y0, x1, y1, '#5a5e70', S(7));
      pt.line(x0 - dy * S(1.5), y0 + dx * S(1.5), x1 - dy * S(1.5), y1 + dx * S(1.5), '#7a7e92', S(3));
      pt.line(x0 - dy * S(2.5), y0 + dx * S(2.5), x1 - dy * S(2.5), y1 + dx * S(2.5), '#a0a6b8', 1);
    } else if (st.weapon === 'spear') {
      pt.line(x - dx * S(8), y - dy * S(8), x + dx * S(14), y + dy * S(14), '#8a5a44', S(2));
      const tx = x + dx * S(14);
      const ty = y + dy * S(14);
      pt.poly(
        [
          [tx - dy * S(3), ty + dx * S(3)],
          [tx + dx * S(7), ty + dy * S(7)],
          [tx + dy * S(3), ty - dx * S(3)],
        ],
        '#c8d0dc',
      );
      pt.line(tx, ty, tx + dx * S(5), ty + dy * S(5), '#f2f6fa', 1);
    } else {
      // great axe
      pt.line(x - dx * S(4), y - dy * S(4), x + dx * S(16), y + dy * S(16), '#6e4a3a', S(3));
      const hx = x + dx * S(13);
      const hy = y + dy * S(13);
      const nx = -dy;
      const ny = dx;
      pt.poly(
        [
          [hx - dx * S(4), hy - dy * S(4)],
          [hx - dx * S(6) + nx * S(9), hy - dy * S(6) + ny * S(9)],
          [hx + dx * S(6) + nx * S(9), hy + dy * S(6) + ny * S(9)],
          [hx + dx * S(4), hy + dy * S(4)],
        ],
        '#8a90a4',
      );
      pt.line(hx - dx * S(6) + nx * S(9), hy - dy * S(6) + ny * S(9), hx + dx * S(6) + nx * S(9), hy + dy * S(6) + ny * S(9), '#d4dae6', S(2));
    }
  };

  // back arm + weapon go behind the body
  pt.line(shX - S(4), shY + S(2), hB[0], hB[1], k.shade, S(5));
  pt.ellipse(hB[0], hB[1], S(2.5), S(2.5), k.shade);
  weapon();
  leg(hipX - S(3), p.back, true);

  // hunched torso + belly
  pt.ellipse(shX - S(1), shY + S(6), S(9), S(9), k.base);
  pt.ellipse(shX - S(3), shY + S(3), S(5), S(4), k.hi);
  pt.ellipse(hipX + S(2), hipY - S(4), S(7), S(6), k.base);
  pt.ellipse(hipX + S(3), hipY - S(5), S(4), S(3), k.hi);
  pt.ellipse(shX - S(6), shY + S(9), S(3), S(5), k.shade);
  // strap
  pt.line(shX + S(5), shY - S(1), hipX - S(5), hipY - S(4), k.dark, S(2));
  // loincloth + belt
  pt.rect(hipX - S(7), hipY - S(3), S(15), S(3), st.clothShade);
  pt.poly(
    [
      [hipX - S(6), hipY - S(1)],
      [hipX + S(7), hipY - S(1)],
      [hipX + S(5), hipY + S(5)],
      [hipX - S(4), hipY + S(5)],
    ],
    st.cloth,
  );
  pt.line(hipX - S(3), hipY + S(4), hipX + S(4), hipY + S(4), st.clothShade, 1);

  leg(hipX + S(3), p.front, false);

  // head on the shoulders, jutting forward
  const pal: Palette = {
    K: st.horn,
    k: st.hornHi,
    R: p.hurt ? '#ffffff' : k.base,
    H: p.hurt ? '#ffffff' : k.hi,
    r: k.shade,
    d: k.dark,
    W: '#ffffff',
    E: st.eye,
    T: '#fff4d6',
    m: '#3a5a80',
    o: '#f4c34e',
    I: '#9aa0b4',
    i: '#6a7088',
  };
  const hw = st.head[0].length;
  const hh = st.head.length;
  const headX = shX - Math.round(hw / 2) + S(4);
  const headY = shY - hh + S(4);
  // a dark copy one pixel lower separates the jaw from the chest
  const shadow: Palette = {};
  for (const key in pal) shadow[key] = k.dark;
  pt.grid(st.head, shadow, headX, headY + 1);
  pt.grid(st.head, pal, headX, headY);

  // front arm
  pt.line(shX + S(5), shY + S(3), hF[0], hF[1], k.base, S(5));
  pt.ellipse(hF[0], hF[1], S(2.5), S(2.5), k.hi);

  return pt.toSprite(AX, AY);
}

const cache = new Map<MoblinKind, Record<MoblinAnim, Sprite[]>>();

export function moblinFrames(kind: MoblinKind): Record<MoblinAnim, Sprite[]> {
  let f = cache.get(kind);
  if (f) return f;
  const st: MoblinStyle = MOBLIN_STYLES[kind];
  const idle: MPose = { front: [5, 0], back: [-5, 0], weapon: -100, handB: [0, -6], handF: [3, 6] };
  const walk = (i: number): MPose => {
    const ph = (i / 4) * Math.PI * 2;
    return {
      ...idle,
      by: Math.abs(Math.sin(ph)) > 0.7 ? -1 : 0,
      front: [Math.round(Math.cos(ph) * 5) + 1, Math.max(0, Math.round(Math.sin(ph) * 3))],
      back: [Math.round(-Math.cos(ph) * 5) - 1, Math.max(0, Math.round(-Math.sin(ph) * 3))],
      handF: [3, 6 + Math.round(Math.sin(ph))],
    };
  };
  const spear = st.weapon === 'spear';
  f = {
    idle: [drawMoblin(st, idle), drawMoblin(st, { ...idle, by: 1, handF: [3, 7] })],
    walk: [0, 1, 2, 3].map((i) => drawMoblin(st, walk(i))),
    windup: [drawMoblin(st, { ...idle, lean: -2, weapon: spear ? -170 : -140, handB: [-2, -9] })],
    swing: [drawMoblin(st, { ...idle, lean: 3, front: [7, 0], back: [-6, 0], weapon: spear ? 0 : 30, handB: [12, 2], handF: [0, 7] })],
    hurt: [drawMoblin(st, { ...idle, lean: -3, hurt: true, weapon: -120 })],
    throw: [drawMoblin(st, { ...idle, lean: 2, weapon: 0, handB: [10, -4], noWeapon: true })],
  };
  cache.set(kind, f);
  return f;
}
