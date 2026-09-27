/**
 * The master palette, sampled from the style reference: warm cream light,
 * teal-leaning greens, rosy browns and navy shadows.
 */
export const P = {
  // Shadows / outlines
  ink: '#1c2230',
  navy: '#233f52',
  navy2: '#20434f',
  slate: '#303644',
  dusk: '#4a4e61',

  // Foliage & grass ramp (dark -> light)
  g0: '#1f3d4a',
  g1: '#2a5652',
  g2: '#2f6b58',
  g3: '#3a845f',
  g4: '#48a864',
  g5: '#5cbf70',
  g6: '#86dd8e',
  g7: '#b8ee9c',
  // Muted/background foliage
  m0: '#306259',
  m1: '#408064',
  m2: '#549072',
  m3: '#6abd8a',
  m4: '#8aba9a',
  m5: '#a8d4a8',
  m6: '#c6e6b8',

  // Earth (foreground dirt)
  d0: '#3a3440',
  d1: '#554856',
  d2: '#70606a',
  d3: '#8c6c68',
  d4: '#9a766d',
  d5: '#b0826f',
  d6: '#c7927b',
  // Earth (lit background cliffs)
  c0: '#947771',
  c1: '#b08878',
  c2: '#bf8d76',
  c3: '#d4a684',
  c4: '#eabb86',
  c5: '#f2cf98',

  // Sky & light
  sky0: '#fef8db',
  sky1: '#f5ecd7',
  sky2: '#e6ecc4',
  cloud: '#fffbe8',
  cloudShade: '#d9e1b7',
  haze: '#b4dcc0',

  // Bark (pale twisted trees)
  b0: '#3e3a44',
  b1: '#554e56',
  b2: '#706c65',
  b3: '#8c8277',
  b4: '#aca090',
  b5: '#d7ceaa',
  b6: '#ece4c4',

  // Accents
  pink: '#f06b86',
  pinkLight: '#ff9fb0',
  pinkDark: '#8a3350',
  red: '#d9434f',
  redDark: '#8e2c3e',
  gold: '#f4c34e',
  goldDark: '#b0772e',
  wood: '#c07a4a',
  woodLight: '#e8a868',
  woodDark: '#6e3f2e',
  white: '#ffffff',
  paper: '#fff4d6',
  paperShade: '#e8d4ae',
  text: '#6b4a3e',
} as const;

export type ColorName = keyof typeof P;
