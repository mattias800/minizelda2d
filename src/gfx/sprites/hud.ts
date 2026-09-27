import { Painter } from '../painter';
import { Palette, Sprite, spriteFromGrid } from '../sprite';

const once = <T>(fn: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v ??= fn());
};

const HEART = [
  '.ppp.ppp.',
  'pPHHpPPPp',
  'pHHPPPPPp',
  'pPPPPPPPp',
  '.pPPPPPp.',
  '..pPPPp..',
  '...pPp...',
  '....p....',
];
const HEART_HALF = [
  '.ppp.eee.',
  'pPHHpEEEe',
  'pHHPpEEEe',
  'pPPPpEEEe',
  '.pPPpEEe.',
  '..pPpEe..',
  '...pPe...',
  '....p....',
];
const HEART_EMPTY = [
  '.eee.eee.',
  'eEEEeEEEe',
  'eEeeEeeEe',
  'eEeeeeeEe',
  '.eEeeeEe.',
  '..eEeEe..',
  '...eEe...',
  '....e....',
];
const HEART_PAL: Palette = { p: '#c0405e', P: '#f06b86', H: '#ffb6c4', e: '#8a9ea4', E: '#b4c6c4' };

export const hudHearts = once(() => ({
  full: spriteFromGrid(HEART, HEART_PAL, { outline: '#4a2438', ax: 0, ay: 0 }),
  half: spriteFromGrid(HEART_HALF, HEART_PAL, { outline: '#4a2438', ax: 0, ay: 0 }),
  empty: spriteFromGrid(HEART_EMPTY, HEART_PAL, { outline: '#3e4a54', ax: 0, ay: 0 }),
}));

/** Round wooden medallion with a flame rune: the magic meter's icon. */
export const magicMedallion = once(() => {
  const pt = new Painter(20, 20);
  pt.ellipse(10, 10, 9, 9, '#8a4e34');
  pt.ellipse(10, 10, 8, 8, '#e0a060');
  pt.ellipse(9.5, 9.5, 6.5, 6.5, '#f4c07a');
  pt.ellipse(11, 11, 6, 6, '#e0a060');
  // rune
  const r = '#fff0c8';
  pt.line(10, 5, 10, 15, r);
  pt.line(7, 7, 10, 10, r);
  pt.line(13, 7, 10, 10, r);
  pt.line(7, 13, 10, 11, r);
  pt.px(9, 4, r);
  pt.px(11, 16, '#b86e40');
  return pt.toSprite(0, 0, '#4a2a26');
});

export const itemRing = once(() => {
  const pt = new Painter(26, 26);
  pt.ellipse(13, 13, 12, 12, '#8a4e34');
  pt.ellipse(13, 13, 11, 11, '#e8a868');
  pt.ellipse(12.5, 12.5, 9.5, 9.5, '#fff0c8');
  pt.ellipse(13, 13, 8, 8, '#3a5a5a');
  pt.ellipse(13, 13, 7.5, 7.5, '#2a4046');
  return pt.toSprite(0, 0, '#4a2a26');
});

/** Little key cap shown in the item ring before an item is equipped. */
export const keyCap = once(() =>
  spriteFromGrid(
    ['.WWWWWW.', 'WWWWWWWW', 'WWkkkWWW', 'WWkWWkWW', 'WWkkkWWW', 'WWkWWkWW', 'WWkkkWWW', 'SSSSSSSS', '.SSSSSS.'],
    { W: '#f4f0e8', S: '#b8b0a8', k: '#6a6470' },
    { outline: '#4a4450', ax: 0, ay: 0 },
  ),
);

export type HudSprites = ReturnType<typeof hudHearts>;
export type { Sprite };
