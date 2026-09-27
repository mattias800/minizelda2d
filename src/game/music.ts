import { Song } from '../core/audio';
import { MusicId } from '../world/rooms';

/** Original chiptune score. Notes are `pitch/length` (length 4 = a quarter note). */

const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
const beat = (kick: string, snare: string, hat: string) =>
  `${kick}/8 ${hat}/8 ${snare}/8 ${hat}/8 ${kick}/8 ${kick}/8 ${snare}/8 ${hat}/8`;
const arp = (a: string, b: string, c: string, len = 8) => `${a}/${len} ${b}/${len} ${c}/${len} ${b}/${len}`;

const forest: Song = {
  bpm: 128,
  loop: true,
  channels: [
    {
      wave: 'square',
      gain: 0.1,
      notes: [
        'e5/8 g5/8 a5/4 g5/8 e5/8 d5/4',
        'c5/8 d5/8 e5/8 g5/8 e5/2',
        'a4/8 c5/8 d5/4 e5/8 d5/8 c5/4',
        'd5/8 e5/8 d5/8 b4/8 g4/2',
        'e5/8 g5/8 a5/4 b5/8 a5/8 g5/4',
        'a5/8 g5/8 e5/8 d5/8 e5/2',
        'c5/8 d5/8 e5/8 g5/8 a5/4 g5/8 e5/8',
        'd5/8 c5/8 d5/8 e5/8 c5/2',
        'f5/4 a5/8 f5/8 e5/4 g5/8 e5/8',
        'd5/4 f5/8 d5/8 c5/4 e5/4',
        'f5/8 g5/8 a5/8 c6/8 b5/4 a5/8 g5/8',
        'a5/8 g5/8 f5/8 d5/8 g5/2',
      ].join(' '),
    },
    {
      wave: 'triangle',
      gain: 0.22,
      notes: [
        rep(arp('c3', 'g3', 'e3'), 2),
        rep(arp('c3', 'g3', 'e3'), 2),
        rep(arp('a2', 'e3', 'c3'), 2),
        rep(arp('g2', 'd3', 'b2'), 2),
        rep(arp('c3', 'g3', 'e3'), 2),
        rep(arp('a2', 'e3', 'c3'), 2),
        rep(arp('f2', 'c3', 'a2'), 2),
        'g2/8 d3/8 b2/8 d3/8 c3/2',
        rep(arp('f2', 'c3', 'a2'), 2),
        arp('d3', 'a3', 'f3') + ' ' + arp('c3', 'g3', 'e3'),
        rep(arp('f2', 'c3', 'a2'), 2),
        rep(arp('g2', 'd3', 'b2'), 2),
      ].join(' '),
    },
    { wave: 'square', gain: 0.035, notes: rep('-/4 c5/8 -/8 -/4 e5/8 -/8', 12) },
    { wave: 'noise', gain: 0.12, notes: rep(beat('c3', 'c5', 'c7'), 12) },
  ],
};

const cave: Song = {
  bpm: 84,
  loop: true,
  channels: [
    {
      wave: 'triangle',
      gain: 0.26,
      notes: [
        'a4/4 -/8 e5/8 d5/4 c5/4',
        'b4/4 -/8 c5/8 b4/2',
        'a4/4 -/8 e5/8 f5/4 e5/4',
        'd5/8 c5/8 b4/4 a4/2',
        'c5/4 -/8 g5/8 f5/4 e5/4',
        'd5/4 -/8 e5/8 d5/2',
        'c5/4 b4/8 a4/8 g#4/4 b4/4',
        'a4/1',
      ].join(' '),
    },
    { wave: 'sine', gain: 0.3, notes: 'a2/2 e2/2 g2/2 e2/2 f2/2 c3/2 e2/2 e2/2 c3/2 g2/2 g2/2 d3/2 f2/2 e2/2 a2/1' },
    {
      wave: 'square',
      gain: 0.03,
      notes: [
        rep(arp('a3', 'c4', 'e4', 16), 4),
        rep(arp('g3', 'b3', 'e4', 16), 4),
        rep(arp('f3', 'a3', 'c4', 16), 4),
        rep(arp('e3', 'g#3', 'b3', 16), 4),
        rep(arp('c4', 'e4', 'g4', 16), 4),
        rep(arp('g3', 'b3', 'd4', 16), 4),
        rep(arp('f3', 'a3', 'c4', 16), 2) + ' ' + rep(arp('e3', 'g#3', 'b3', 16), 2),
        rep(arp('a3', 'c4', 'e4', 16), 4),
      ].join(' '),
    },
  ],
};

const shrine: Song = {
  bpm: 96,
  loop: true,
  channels: [
    {
      wave: 'square',
      gain: 0.08,
      notes: [
        'd5/4 f5/8 e5/8 d5/4 a4/4',
        'c5/4 d5/8 e5/8 f5/2',
        'g5/4 f5/8 e5/8 d5/4 c5/4',
        'a4/4 c5/4 d5/2',
        'a5/4 g5/8 f5/8 e5/4 d5/4',
        'c5/4 e5/8 g5/8 f5/2',
        'e5/8 f5/8 g5/4 a5/4 c6/4',
        'b5/4 a5/4 d5/2',
      ].join(' '),
    },
    { wave: 'triangle', gain: 0.24, notes: 'd3/2 a2/2 c3/2 f2/2 g2/2 a2/2 d3/2 d3/2 f2/2 a2/2 c3/2 f2/2 c3/2 a2/2 g2/2 d3/2' },
    {
      wave: 'sine',
      gain: 0.07,
      notes: rep('d4/4 a4/4 f4/4 a4/4', 4) + ' ' + rep('f4/4 c5/4 a4/4 c5/4', 2) + ' ' + rep('g4/4 d5/4 b4/4 d5/4', 2),
    },
  ],
};

const boss: Song = {
  bpm: 158,
  loop: true,
  channels: [
    {
      wave: 'square',
      gain: 0.09,
      notes: [
        'e5/8 e5/8 g5/8 e5/8 a5/8 g5/8 f#5/8 d5/8',
        'e5/8 e5/8 g5/8 e5/8 b5/4 a5/4',
        'c6/8 b5/8 a5/8 g5/8 a5/8 g5/8 f#5/8 d5/8',
        'e5/4 b4/4 e5/2',
        'g5/8 g5/8 b5/8 g5/8 c6/8 b5/8 a5/8 f#5/8',
        'g5/8 g5/8 b5/8 g5/8 d6/4 c6/4',
        'b5/8 a5/8 g5/8 f#5/8 g5/8 f#5/8 e5/8 d#5/8',
        'e5/2 b4/2',
      ].join(' '),
    },
    {
      wave: 'sawtooth',
      gain: 0.06,
      notes: [
        rep('e2/8 e3/8', 8),
        rep('c2/8 c3/8', 4),
        rep('d2/8 d3/8', 4),
        rep('e2/8 e3/8', 4),
        rep('b1/8 b2/8', 4),
        rep('g2/8 g3/8', 8),
        rep('c2/8 c3/8', 4),
        rep('b1/8 b2/8', 4),
        rep('e2/8 e3/8', 8),
      ].join(' '),
    },
    { wave: 'noise', gain: 0.14, notes: rep('c3/8 c7/8 c5/8 c7/8 c3/8 c3/8 c5/8 c5/16 c5/16', 8) },
  ],
};

const title: Song = {
  bpm: 104,
  loop: true,
  channels: [
    {
      wave: 'square',
      gain: 0.09,
      notes: [
        'c5/4 g4/4 c5/8 d5/8 e5/8 f5/8',
        'g5/2 e5/4 c5/4',
        'a5/4 f5/4 e5/8 d5/8 c5/4',
        'd5/2 g4/2',
        'c5/4 g4/4 c5/8 d5/8 e5/8 f5/8',
        'g5/2 c6/4 b5/4',
        'a5/8 g5/8 f5/8 e5/8 d5/4 g5/4',
        'c5/1',
      ].join(' '),
    },
    { wave: 'triangle', gain: 0.24, notes: 'c3/2 e3/2 c3/2 g2/2 f2/2 a2/2 g2/2 g2/2 c3/2 e3/2 e3/2 e3/2 f2/2 g2/2 c3/1' },
    {
      wave: 'sine',
      gain: 0.06,
      notes: [
        rep('e4/8 g4/8 c5/8 g4/8', 4),
        rep('f4/8 a4/8 c5/8 a4/8', 2),
        rep('g4/8 b4/8 d5/8 b4/8', 2),
        rep('e4/8 g4/8 c5/8 g4/8', 4),
        rep('f4/8 a4/8 d5/8 a4/8', 2),
        rep('e4/8 g4/8 c5/8 g4/8', 2),
      ].join(' '),
    },
  ],
};

const ending: Song = {
  bpm: 92,
  loop: true,
  channels: [
    {
      wave: 'triangle',
      gain: 0.26,
      notes:
        'g4/8 c5/8 e5/8 g5/4 e5/8 g5/4 a5/8 g5/8 f5/8 e5/8 d5/8 e5/8 c5/2 -/8 e5/8 f5/8 g5/4 a5/8 g5/4 f5/8 e5/8 d5/8 c5/8 d5/8 b4/8 c5/2 -/4',
    },
    { wave: 'sine', gain: 0.2, notes: 'c3/2 e3/2 f2/2 g2/2 c3/2 a2/2 f2/2 g2/2 c3/2' },
  ],
};

export type SongId = MusicId | 'title' | 'ending';

const SONGS: Record<SongId, Song> = { forest, cave, shrine, boss, title, ending };

export function song(id: SongId): Song {
  return SONGS[id];
}
