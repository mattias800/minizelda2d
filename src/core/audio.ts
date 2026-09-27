/**
 * Tiny chiptune synth: procedural sound effects plus a lookahead music
 * sequencer. Everything is synthesized with WebAudio, so there are no files.
 */

export type SfxName =
  | 'jump'
  | 'doubleJump'
  | 'sword'
  | 'hit'
  | 'kill'
  | 'hurt'
  | 'rupee'
  | 'heart'
  | 'fanfare'
  | 'fire'
  | 'burn'
  | 'blip'
  | 'menu'
  | 'block'
  | 'bounce'
  | 'save'
  | 'land'
  | 'bossHit'
  | 'bossRoar';

type Wave = OscillatorType | 'noise';

export interface Song {
  bpm: number;
  /** Each channel: space separated tokens `note/len`, e.g. `e5/8`, `-/4` for rest. len = 1/len of a whole note. */
  channels: { wave: Wave; gain: number; notes: string }[];
  loop: boolean;
}

const NOTE_INDEX: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function noteFreq(token: string): number | null {
  const m = /^([a-g])([#b]?)(\d)$/.exec(token);
  if (!m) return null;
  let n = NOTE_INDEX[m[1]];
  if (m[2] === '#') n++;
  if (m[2] === 'b') n--;
  const midi = (parseInt(m[3], 10) + 1) * 12 + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ParsedNote {
  freq: number | null;
  beats: number;
}

function parseChannel(notes: string): ParsedNote[] {
  const out: ParsedNote[] = [];
  for (const tok of notes.trim().split(/\s+/)) {
    if (!tok) continue;
    const [n, l] = tok.split('/');
    const len = parseFloat(l ?? '4');
    out.push({ freq: n === '-' ? null : noteFreq(n), beats: 4 / len });
  }
  return out;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private song: Song | null = null;
  private songId = '';
  private parsed: ParsedNote[][] = [];
  private cursors: { i: number; t: number }[] = [];
  private timer: number | null = null;
  muted = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.song) this.startSequencer();
  }

  /** True until a key press or click has allowed audio to start. */
  get locked(): boolean {
    return !this.ctx || this.ctx.state !== 'running';
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  // ---------------------------------------------------------------- tones

  private tone(
    wave: Wave,
    freq: number,
    start: number,
    dur: number,
    vol: number,
    bus: AudioNode,
    slideTo?: number,
  ): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.005);
    g.gain.setValueAtTime(vol, start + Math.max(0.006, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(bus);
    if (wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(freq, start);
      if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      src.connect(f).connect(g);
      src.start(start, Math.random() * 0.5, dur + 0.05);
    } else {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(freq, start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      o.connect(g);
      o.start(start);
      o.stop(start + dur + 0.02);
    }
  }

  sfx(name: SfxName): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const b = this.sfxBus;
    const T = (w: Wave, f: number, dt: number, d: number, v: number, s?: number) =>
      this.tone(w, f, t + dt, d, v, b, s);
    switch (name) {
      case 'jump':
        T('square', 220, 0, 0.12, 0.18, 520);
        break;
      case 'doubleJump':
        T('square', 330, 0, 0.1, 0.16, 780);
        T('triangle', 660, 0.05, 0.12, 0.2, 1200);
        break;
      case 'sword':
        T('noise', 2600, 0, 0.09, 0.5, 900);
        break;
      case 'hit':
        T('square', 180, 0, 0.08, 0.25, 90);
        T('noise', 900, 0, 0.06, 0.4);
        break;
      case 'kill':
        T('noise', 1200, 0, 0.3, 0.5, 200);
        T('square', 300, 0, 0.18, 0.18, 60);
        break;
      case 'hurt':
        T('square', 400, 0, 0.25, 0.25, 80);
        T('sawtooth', 200, 0.02, 0.2, 0.12, 60);
        break;
      case 'rupee':
        T('square', 1318, 0, 0.06, 0.14);
        T('square', 1760, 0.06, 0.12, 0.14);
        break;
      case 'heart':
        [784, 988, 1175, 1568].forEach((f, i) => T('triangle', f, i * 0.05, 0.12, 0.3));
        break;
      case 'fanfare':
        [
          [523, 0],
          [659, 0.12],
          [784, 0.24],
          [1047, 0.36],
          [988, 0.6],
          [1047, 0.72],
        ].forEach(([f, d]) => {
          T('square', f, d, 0.2, 0.14);
          T('triangle', f / 2, d, 0.22, 0.3);
        });
        break;
      case 'fire':
        T('noise', 600, 0, 0.25, 0.5, 2400);
        T('sawtooth', 120, 0, 0.2, 0.1, 400);
        break;
      case 'burn':
        T('noise', 400, 0, 0.6, 0.6, 1500);
        break;
      case 'blip':
        T('square', 880, 0, 0.025, 0.06);
        break;
      case 'menu':
        T('square', 660, 0, 0.06, 0.14);
        T('square', 990, 0.05, 0.08, 0.14);
        break;
      case 'block':
        T('square', 1800, 0, 0.05, 0.14, 1200);
        T('triangle', 2400, 0, 0.1, 0.2);
        break;
      case 'bounce':
        T('square', 300, 0, 0.1, 0.18, 700);
        break;
      case 'save':
        [523, 659, 784, 1047, 1319].forEach((f, i) => T('triangle', f, i * 0.07, 0.25, 0.3));
        break;
      case 'land':
        T('noise', 300, 0, 0.05, 0.25);
        break;
      case 'bossHit':
        T('square', 120, 0, 0.18, 0.3, 50);
        T('noise', 700, 0, 0.12, 0.5);
        break;
      case 'bossRoar':
        T('sawtooth', 90, 0, 0.7, 0.25, 50);
        T('noise', 300, 0, 0.7, 0.4, 120);
        break;
    }
  }

  // ---------------------------------------------------------------- music

  playSong(id: string, song: Song | null): void {
    if (id === this.songId) return;
    this.songId = id;
    this.song = song;
    this.stopSequencer();
    if (song && this.ctx) this.startSequencer();
  }

  private startSequencer(): void {
    if (!this.ctx || !this.song) return;
    this.parsed = this.song.channels.map((c) => parseChannel(c.notes));
    const t0 = this.ctx.currentTime + 0.1;
    this.cursors = this.parsed.map(() => ({ i: 0, t: t0 }));
    const song = this.song;
    const tick = () => {
      if (!this.ctx || this.song !== song) return;
      const horizon = this.ctx.currentTime + 0.25;
      const beat = 60 / song.bpm;
      this.parsed.forEach((notes, ci) => {
        const cur = this.cursors[ci];
        const ch = song.channels[ci];
        while (cur.t < horizon && notes.length > 0) {
          if (cur.i >= notes.length) {
            if (!song.loop) return;
            cur.i = 0;
          }
          const n = notes[cur.i++];
          const dur = n.beats * beat;
          if (n.freq !== null && !this.muted) {
            const f = ch.wave === 'noise' ? n.freq * 4 : n.freq;
            this.tone(ch.wave, f, cur.t, dur * (ch.wave === 'noise' ? 0.3 : 0.9), ch.gain, this.musicBus);
          }
          cur.t += dur;
        }
      });
    };
    tick();
    this.timer = window.setInterval(tick, 50);
  }

  private stopSequencer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

export const audio = new Audio();
