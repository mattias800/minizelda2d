import { audio } from '../core/audio';
import { Input } from '../core/input';
import { VIEW_H, VIEW_W } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import { FONT_LINE_H, drawText, wrapText } from '../gfx/font';
import { Sprite } from '../gfx/sprite';
import { roundedPanel } from './bubble';

export interface DialogOptions {
  speaker?: string;
  portrait?: Sprite;
  /** Shows a Yes/No choice after the last page. */
  choice?: { yes: string; no: string; onChoose: (yes: boolean) => void };
  onDone?: () => void;
}

const BOX_W = VIEW_W - 24;
const TEXT_W = BOX_W - 16;
const LINES = 3;

/** Paged, typewriter-style text box. Owns input while open. */
export class Dialog {
  private pages: string[][] = [];
  private page = 0;
  private shown = 0;
  private t = 0;
  private choiceYes = true;
  private choosing = false;
  done = false;

  constructor(
    text: string | string[],
    private opts: DialogOptions = {},
  ) {
    const paras = Array.isArray(text) ? text : [text];
    for (const p of paras) {
      const lines = wrapText(p, TEXT_W - (opts.portrait ? 26 : 0));
      for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
    }
  }

  private get pageText(): string {
    return this.pages[this.page].join('\n');
  }

  update(input: Input): void {
    this.t++;
    const full = this.pageText.length;
    const advance = input.pressed('attack') || input.pressed('jump') || input.pressed('up');
    if (this.choosing) {
      if (input.pressed('left') || input.pressed('right') || input.pressed('down')) {
        this.choiceYes = !this.choiceYes;
        audio.sfx('blip');
      }
      if (input.pressed('attack') || input.pressed('jump')) {
        audio.sfx('menu');
        this.done = true;
        this.opts.choice!.onChoose(this.choiceYes);
        this.opts.onDone?.();
      }
      return;
    }
    if (this.shown < full) {
      this.shown = Math.min(full, this.shown + (advance ? full : 1));
      if (this.t % 3 === 0) audio.sfx('blip');
      return;
    }
    if (!advance) return;
    if (this.page < this.pages.length - 1) {
      this.page++;
      this.shown = 0;
      audio.sfx('menu');
    } else if (this.opts.choice) {
      this.choosing = true;
    } else {
      this.done = true;
      audio.sfx('menu');
      this.opts.onDone?.();
    }
  }

  draw(ctx: Ctx): void {
    const h = 12 + LINES * FONT_LINE_H + (this.opts.speaker ? 0 : 0);
    const x = 12;
    const y = VIEW_H - h - 8;
    roundedPanel(ctx, x, y, BOX_W, h, '#fff8e0', '#ecdcb8', '#8a5a44');
    let tx = x + 8;
    if (this.opts.portrait) {
      this.opts.portrait.draw(ctx, x + 14, y + h - 6);
      tx += 26;
    }
    if (this.opts.speaker) {
      const label = this.opts.speaker;
      roundedPanel(ctx, x + 6, y - 8, label.length * 5 + 10, 13, '#8a5a44', '#6e3f36', '#4a2a26');
      drawText(ctx, label, x + 11, y - 5, '#fff0c8');
    }
    let remaining = this.shown;
    this.pages[this.page].forEach((line, i) => {
      const part = line.slice(0, Math.max(0, remaining));
      remaining -= line.length + 1;
      drawText(ctx, part, tx, y + 7 + i * FONT_LINE_H, '#6b4a3e');
    });
    const full = this.shown >= this.pageText.length;
    if (this.choosing && this.opts.choice) {
      const cy = y + h - 12;
      const yes = this.opts.choice.yes;
      const no = this.opts.choice.no;
      const bx = x + BOX_W - 90;
      drawText(ctx, (this.choiceYes ? '> ' : '  ') + yes, bx, cy, this.choiceYes ? '#c0405e' : '#8a6a5a');
      drawText(ctx, (!this.choiceYes ? '> ' : '  ') + no, bx + 46, cy, !this.choiceYes ? '#c0405e' : '#8a6a5a');
    } else if (full && Math.floor(this.t / 16) % 2 === 0) {
      // blinking "more" arrow
      const ax = x + BOX_W - 12;
      const ay = y + h - 10;
      ctx.fillStyle = '#c0405e';
      ctx.fillRect(ax, ay, 5, 1);
      ctx.fillRect(ax + 1, ay + 1, 3, 1);
      ctx.fillRect(ax + 2, ay + 2, 1, 1);
    }
  }
}
