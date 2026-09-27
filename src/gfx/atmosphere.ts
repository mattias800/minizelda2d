import { Rng } from '../core/math';
import { Theme } from '../world/rooms';
import { VIEW_H, VIEW_W } from './backgrounds';
import { Ctx, PixelBuf, packColor } from './canvas';

/**
 * Screen-space mood: god rays through the canopy, floating dust, fireflies,
 * falling leaves. Purely visual.
 */

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  color: string;
  size: number;
}

interface AtmosphereConfig {
  rays: number;
  rayColor: string;
  rayAlpha: number;
  motes: number;
  moteColors: string[];
  moteDrift: [number, number];
  leaves?: boolean;
  glow?: boolean;
}

const CONFIGS: Record<Theme, AtmosphereConfig> = {
  forest: { rays: 3, rayColor: '#f4f8d8', rayAlpha: 0.7, motes: 26, moteColors: ['#ffffff', '#fff4c8'], moteDrift: [0.08, -0.05] },
  canopy: { rays: 2, rayColor: '#ffffff', rayAlpha: 0.3, motes: 14, moteColors: ['#ffffff'], moteDrift: [0.15, 0.05], leaves: true },
  cave: { rays: 0, rayColor: '#b8f0e8', rayAlpha: 0.12, motes: 20, moteColors: ['#62d6d0', '#8ce8d8'], moteDrift: [0.03, -0.12], glow: true },
  shrine: { rays: 3, rayColor: '#fff8e0', rayAlpha: 0.22, motes: 20, moteColors: ['#fff4c8', '#ffffff'], moteDrift: [0.04, 0.03] },
  hollow: { rays: 0, rayColor: '#000000', rayAlpha: 0, motes: 18, moteColors: ['#d8f06a', '#b8e050'], moteDrift: [0.1, -0.06], glow: true },
};

function buildRay(len: number, width: number, slant: number, color: string): HTMLCanvasElement {
  const w = Math.ceil(width + len * slant + 2);
  const b = new PixelBuf(w, len);
  for (let y = 0; y < len; y++) {
    const x0 = y * slant;
    const fadeIn = Math.min(1, y / 20);
    const fadeOut = Math.min(1, (len - y) / (len * 0.6));
    const a = fadeIn * fadeOut;
    for (let x = 0; x < width; x++) {
      // two nested bands with dithered soft edges
      const edge = Math.min(x, width - 1 - x);
      const band = edge < 2 ? 0.45 : edge < 5 ? 0.75 : 1;
      // smooth translucency in a few flat steps, brighter core
      const alpha = Math.round(a * band * 4) / 4;
      if (alpha > 0) b.set(Math.round(x0 + x), y, packColor(color, Math.round(alpha * 255)));
    }
  }
  return b.toCanvas();
}

export class Atmosphere {
  private cfg: AtmosphereConfig;
  private motes: Mote[] = [];
  private rays: { img: HTMLCanvasElement; x: number; y: number; phase: number }[] = [];
  private t = 0;

  constructor(
    theme: Theme,
    private roomW: number,
    seed = 1,
  ) {
    this.cfg = CONFIGS[theme];
    const rng = new Rng(seed * 31 + 7);
    const span = Math.max(VIEW_W, roomW * 0.6);
    for (let i = 0; i < this.cfg.rays; i++) {
      const len = rng.int(110, 140);
      const width = rng.int(16, 28);
      this.rays.push({
        img: buildRay(len, width, 0.42, this.cfg.rayColor),
        x: (i + 0.3 + rng.next() * 0.4) * (span / this.cfg.rays),
        y: rng.int(8, 26),
        phase: rng.range(0, Math.PI * 2),
      });
    }
    for (let i = 0; i < this.cfg.motes; i++) {
      this.motes.push({
        x: rng.range(0, VIEW_W),
        y: rng.range(20, VIEW_H - 20),
        vx: this.cfg.moteDrift[0] * rng.range(0.5, 1.5),
        vy: this.cfg.moteDrift[1] * rng.range(0.5, 1.5),
        phase: rng.range(0, 100),
        color: rng.pick(this.cfg.moteColors),
        size: this.cfg.leaves && i % 2 ? 2 : 1,
      });
    }
  }

  update(): void {
    this.t++;
    for (const m of this.motes) {
      m.x += m.vx + Math.sin((this.t + m.phase * 10) / 70) * 0.08;
      m.y += m.vy + Math.cos((this.t + m.phase * 7) / 90) * 0.06;
      if (this.cfg.leaves) {
        m.y += 0.25;
        m.x += Math.sin((this.t + m.phase * 13) / 30) * 0.3;
      }
      if (m.x < -4) m.x += VIEW_W + 8;
      if (m.x > VIEW_W + 4) m.x -= VIEW_W + 8;
      if (m.y < 10) m.y += VIEW_H - 20;
      if (m.y > VIEW_H - 4) m.y -= VIEW_H - 14;
    }
  }

  /** Light rays: drawn over the world, under the HUD. */
  drawRays(ctx: Ctx, camX: number): void {
    if (!this.rays.length) return;
    const prev = ctx.globalAlpha;
    for (const r of this.rays) {
      const pulse = 0.75 + Math.sin(this.t / 90 + r.phase) * 0.25;
      ctx.globalAlpha = this.cfg.rayAlpha * pulse;
      const x = Math.round(r.x - camX * 0.55);
      const w = r.img.width;
      const span = Math.max(VIEW_W + w, this.roomW * 0.55 + w);
      const wrapped = ((x % span) + span) % span - w;
      ctx.drawImage(r.img, wrapped, r.y);
    }
    ctx.globalAlpha = prev;
  }

  drawMotes(ctx: Ctx, camX: number): void {
    for (const m of this.motes) {
      const tw = Math.sin((this.t + m.phase * 20) / (this.cfg.glow ? 18 : 30));
      if (tw < -0.3) continue;
      const x = Math.round((((m.x - camX * 0.3) % VIEW_W) + VIEW_W) % VIEW_W);
      const y = Math.round(m.y);
      if (this.cfg.glow && tw > 0.6) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = m.color;
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = this.cfg.leaves && m.size === 2 ? (m.phase > 50 ? '#5cbf70' : '#86dd8e') : m.color;
      ctx.fillRect(x, y, m.size, m.size === 2 ? 1 : 1);
      if (m.size === 2) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
}
