import { Palette, Sprite, spriteFromGrid } from '../sprite';

/** Small enemies and the squirrel NPC, as hand-pixeled grids. */

const once = <T>(fn: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v ??= fn());
};

// ------------------------------------------------------------------ squirrel

const SQ_PAL: Palette = {
  T: '#6e4632',
  t: '#a8744c',
  u: '#c89868',
  B: '#b07a54',
  b: '#8a5a44',
  C: '#f6e4bc',
  c: '#dcc090',
  E: '#2a1e24',
  W: '#ffffff',
  N: '#5a3a3a',
  L: '#7fdc72',
  l: '#3a8a4a',
  P: '#f0a0a0',
};

const SQUIRREL = [
  '..............l.....',
  '.............lLl....',
  '..TTTT.......lLL....',
  '.TttuuT...bbbBbb....',
  'TtuTTutT.bBBBBBBb...',
  'TtT..TtTbBBBBBBBBb..',
  'TtT...TtbBCCCBBCCb..',
  'TtT...TtbCCECCCECCb.',
  'TtTT..TtbCCWCCCWCCN.',
  '.TtT.TtTbCPCCCCCPCb.',
  '.TtuTttbbbCCCCCCCb..',
  '..TtutbBBBbCCCCCbB..',
  '..TtttbBBBBCCCCCBBb.',
  '...TtbBBBBBCCCCCBBb.',
  '...TtbBBBBBCCCCBBb..',
  '....bbBBBBBBBBBBbb..',
  '....bBBb.....bBBb...',
  '....bbb.......bbb...',
];

// Tail flicked up a little, eyes closed: a cheerful chirp.
const SQUIRREL_CHIRP = SQUIRREL.map((r, i) => {
  if (i === 7) return 'TtT...TtbCCCCCCCCCCb.'.slice(0, 20);
  if (i === 8) return 'TtTT..TtbCCECCCECCN.';
  return r;
});

export const squirrelFrames = once(() => [
  spriteFromGrid(SQUIRREL, SQ_PAL),
  spriteFromGrid(SQUIRREL_CHIRP, SQ_PAL),
]);

// ------------------------------------------------------------------ slime

const SLIME = [
  '.....gggg.....',
  '...gGGGGGGg...',
  '..gGLLGGGGGg..',
  '.gGLLGGGGGGGg.',
  '.gGLGGEGGEGGg.',
  'gGGGGGEGGEGGGg',
  'gGGGGGGGGGGGGg',
  'gGGGGGGGGGGGGg',
  '.gggGGGGGGggg.',
  '..gggggggggg..',
];
const SLIME_SQUASH = [
  '......gggg......',
  '...ggGGGGGGgg...',
  '..gGLLGGGGGGGg..',
  '.gGLGGGEGGEGGGg.',
  'gGGGGGGEGGEGGGGg',
  'gGGGGGGGGGGGGGGg',
  '.ggGGGGGGGGGGgg.',
  '..gggggggggggg..',
];
const SLIME_STRETCH = [
  '....ggg....',
  '...gGGGg...',
  '..gGLGGGg..',
  '.gGLGGGGGg.',
  '.gLGEGGEGg.',
  '.gGGEGGEGg.',
  'gGGGGGGGGGg',
  'gGGGGGGGGGg',
  'gGGGGGGGGGg',
  '.gGGGGGGGg.',
  '..ggggggg..',
];

export type SlimeColor = 'green' | 'teal';
const SLIME_PALS: Record<SlimeColor, Palette> = {
  green: { G: '#7ad67a', L: '#d4f7c4', g: '#3a8a54', E: '#1c2230' },
  teal: { G: '#62c4c8', L: '#c8f4f0', g: '#2e7a8e', E: '#1c2230' },
};

const slimeCache = new Map<SlimeColor, Sprite[]>();
export function slimeFrames(color: SlimeColor): Sprite[] {
  let f = slimeCache.get(color);
  if (!f) {
    const pal = SLIME_PALS[color];
    f = [spriteFromGrid(SLIME, pal), spriteFromGrid(SLIME_SQUASH, pal), spriteFromGrid(SLIME_STRETCH, pal)];
    slimeCache.set(color, f);
  }
  return f;
}

// ------------------------------------------------------------------ bat

const BAT_PAL: Palette = { D: '#4a3a62', d: '#2e2440', R: '#ff6a5a', W: '#7a5f9a', w: '#56437a', f: '#f2e6ff' };
const BAT_UP = [
  'W................W',
  'WW..............WW',
  'wWW.....dd.....WWw',
  '.wWW...dDDd...WWw.',
  '..wWW.dDRRDd.WWw..',
  '...wwwdDDDDdwww...',
  '......dDffDd......',
  '.......dDDd.......',
  '........dd........',
];
const BAT_DOWN = [
  '........dd........',
  '.......dDDd.......',
  '......dDRRDd......',
  '...wwwdDDDDdwww...',
  '..wWWWdDffDdWWWw..',
  '.wWWW..dDDd..WWWw.',
  'wWW.....dd.....WWw',
  'WW..............WW',
  'W................W',
];
export const batFrames = once(() => [spriteFromGrid(BAT_UP, BAT_PAL, { ay: 5 }), spriteFromGrid(BAT_DOWN, BAT_PAL, { ay: 5 })]);

// ------------------------------------------------------------------ spider

const SPIDER_PAL: Palette = { b: '#6a2e3e', B: '#a8454e', H: '#d8707a', E: '#ffe070', l: '#3a2030' };
const SPIDER_A = [
  '..l........l..',
  '.l.l......l.l.',
  'l...lbbbbl...l',
  '.l..bBHBBb..l.',
  '..lbBHBBBBbl..',
  '.l.bBEBBEBb.l.',
  'l..bBBBBBBb..l',
  '....bBBBBb....',
  '...l.bbbb.l...',
  '..l..l..l..l..',
];
const SPIDER_B = [
  '..............',
  'l.l........l.l',
  '.l..lbbbbl..l.',
  '..l.bBHBBb.l..',
  'l..bBHBBBBb..l',
  '.llbBEBBEBbll.',
  '...bBBBBBBb...',
  '..l.bBBBBb.l..',
  '.l...bbbb...l.',
  'l...l....l...l',
];
export const spiderFrames = once(() => [spriteFromGrid(SPIDER_A, SPIDER_PAL, { ay: 0 }), spriteFromGrid(SPIDER_B, SPIDER_PAL, { ay: 0 })]);
