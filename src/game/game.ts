import { audio } from '../core/audio';
import { Input } from '../core/input';
import { VIEW_H, VIEW_W } from '../gfx/backgrounds';
import { Ctx } from '../gfx/canvas';
import { drawText } from '../gfx/font';
import { Sprite } from '../gfx/sprite';
import { featherIcon, fireIcon, heartContainer, triforce } from '../gfx/sprites/props';
import { squirrelFrames } from '../gfx/sprites/creatures';
import { Triforce } from '../entities/pickups';
import { Dialog, DialogOptions } from '../ui/dialog';
import { drawHud } from '../ui/hud';
import { drawMapScreen } from '../ui/mapScreen';
import { EndingScreen, GameOverScreen, TitleScreen } from '../ui/screens';
import { ItemId, roomById } from '../world/rooms';
import { MAX_MAGIC, Progress } from './progress';
import { Entry, GameHost, Scene } from './scene';
import { song } from './music';

type Mode = 'title' | 'play' | 'pause' | 'gameover' | 'ending';

const FADE_TICKS = 12;
const MAGIC_REGEN_TICKS = 50;
const SQUIRREL_PRICE = 30;

const ITEM_TEXT: Record<ItemId, { icon: () => Sprite; text: string[] }> = {
  feather: {
    icon: featherIcon,
    text: ["You found the Roc's Feather!", 'Press JUMP again while in mid-air to double jump. High ledges are within reach now.'],
  },
  fire: {
    icon: fireIcon,
    text: ['You learned the FIRE spell!', 'Press C to hurl a fireball. It uses magic, scorches foes, and burns away thorny brambles.'],
  },
};

/** The game shell: owns the current scene and every overlay/screen. */
export class Game implements GameHost {
  mode: Mode = 'title';
  progress = new Progress();
  scene: Scene | null = null;
  private dialog: Dialog | null = null;
  private t = 0;
  /** Fade: >0 fading out toward a room change, <0 fading in. */
  private fade = 0;
  private pendingEntry: { room: string; entry: Entry | null } | null = null;
  private itemGet: { t: number; then: () => void } | null = null;
  private bossAwake = false;
  private title = new TitleScreen();
  private gameOver: GameOverScreen | null = null;
  private ending: EndingScreen | null = null;

  constructor(private input: Input) {
    audio.playSong('title', song('title'));
  }

  // ------------------------------------------------------------ flow

  newGame(): void {
    this.progress = new Progress();
    this.enterRoom('clearing', null);
    this.mode = 'play';
    this.say(
      [
        'The Whispering Wood has fallen silent. A crowned Guardian has taken the Triforce into the Thorn Hollow, far to the west.',
        'Arrows move, Z jumps and X swings your sword. Hold Down while in the air to thrust downward.',
        'Press Up to talk or use things, and Enter to see your map.',
      ],
      { speaker: 'Hint' },
    );
  }

  /** Dev entry point: fresh game dropped into any room. */
  startAt(room: string, entry: Entry | null): void {
    this.progress = new Progress();
    this.enterRoom(room, entry);
    this.mode = 'play';
  }

  continueGame(): void {
    const p = Progress.load();
    if (!p) return this.newGame();
    this.progress = p;
    this.respawn();
    this.mode = 'play';
  }

  private respawn(): void {
    const d = this.progress.data;
    this.progress.hp = this.progress.maxHp;
    this.progress.magic = MAX_MAGIC;
    this.enterRoom(d.room, d.x >= 0 ? { x: d.x + 14, y: d.y } : null);
  }

  private enterRoom(id: string, entry: Entry | null): void {
    const def = roomById(id);
    this.scene = new Scene(def, this, this.input, this.progress, entry);
    this.progress.visit(def.id);
    this.bossAwake = false;
    if (def.id === 'lair' && !this.progress.flag('boss:guardian')) audio.playSong('silence', null);
    else audio.playSong(def.music, song(def.music));
  }

  say(text: string | string[], opts: DialogOptions = {}): void {
    this.dialog = new Dialog(text, opts);
  }

  // ------------------------------------------------------------ GameHost

  onPlayerDying(): void {
    audio.playSong('silence', null);
  }

  playerDied(): void {
    this.progress.data.deaths++;
    this.mode = 'gameover';
    this.gameOver = new GameOverScreen();
  }

  private startItemGet(icon: Sprite, text: string[], after?: () => void): void {
    const p = this.scene?.player;
    p?.beginItemGet(icon);
    audio.sfx('fanfare');
    this.itemGet = {
      t: 70,
      then: () => {
        this.say(text, {
          onDone: () => {
            p?.endItemGet();
            after?.();
          },
        });
      },
    };
  }

  getItem(item: ItemId): void {
    this.progress.give(item);
    if (item === 'fire') this.progress.magic = MAX_MAGIC;
    const info = ITEM_TEXT[item];
    this.startItemGet(info.icon(), info.text);
  }

  collectHeartContainer(): void {
    this.progress.data.maxHearts++;
    this.progress.hp = this.progress.maxHp;
    this.startItemGet(heartContainer(), ['You got a Heart Container!', 'Your life grew by one full heart.']);
  }

  saveAt(x: number, y: number): void {
    const d = this.progress.data;
    d.room = this.scene!.def.id;
    d.x = x;
    d.y = y;
    this.progress.hp = this.progress.maxHp;
    this.progress.magic = MAX_MAGIC;
    this.progress.save();
    audio.sfx('save');
    this.say('The stone hums warmly. Health and magic restored, and your journey has been saved.');
  }

  talkSquirrel(): void {
    const prog = this.progress;
    const portrait = squirrelFrames()[1];
    const opts: DialogOptions = { speaker: 'Squirrel', portrait };
    let hint: string;
    if (prog.flag('boss:guardian')) hint = 'Kwee-koo! Hear that? The whole wood is singing again. You did it!';
    else if (prog.has('fire'))
      hint = 'Kwee-koo! Fire! Those thorny brambles by the western cliff will burn right up. The Guardian waits in the hollow beyond. Rest at the stone before you go!';
    else if (prog.has('feather'))
      hint = 'Kwee! A feather! Now you can hop up onto the big earthen shelf and climb into the canopy. They say an old shrine hides up there.';
    else hint = 'Kwee-koo! Past the hill to the east there is a hole in the ground. Something shiny glimmers in the cavern below... but a big brute guards it.';

    if (prog.flag('squirrel:trade')) return this.say(hint, opts);
    const offer = `Psst... I found a Heart Container. I'll trade it for ${SQUIRREL_PRICE} shiny rupees!`;
    if (prog.data.rupees < SQUIRREL_PRICE)
      return this.say([hint, `${offer} You have ${prog.data.rupees}. Come back when your pouch is heavier.`], opts);
    this.say([hint, `${offer} Deal?`], {
      ...opts,
      choice: {
        yes: 'Yes',
        no: 'No',
        onChoose: (yes) => {
          if (!yes) return;
          prog.data.rupees -= SQUIRREL_PRICE;
          prog.setFlag('squirrel:trade');
          // the item fanfare starts once this dialog has closed
          this.collectHeartContainer();
        },
      },
    });
  }

  onBossAwake(): void {
    this.bossAwake = true;
    this.scene?.gate?.setClosed(true);
    audio.playSong('boss', song('boss'));
  }

  onBossDying(): void {
    audio.playSong('silence', null);
  }

  onBossDefeated(x: number): void {
    const s = this.scene!;
    this.bossAwake = false;
    s.gate?.setClosed(false);
    s.add(new Triforce(Math.max(60, Math.min(s.map.widthPx - 60, x)), 160));
    audio.playSong('shrine', song('shrine'));
  }

  collectTriforce(): void {
    this.progress.setFlag('triforce');
    this.startItemGet(triforce(), ['You recovered the Triforce!', 'Light returns to the Whispering Wood. Well done, hero.'], () => {
      this.progress.save();
      this.mode = 'ending';
      this.ending = new EndingScreen(this.progress);
      audio.playSong('ending', song('ending'));
    });
  }

  // ------------------------------------------------------------ loop

  update(): void {
    this.input.update();
    this.t++;
    if (this.input.pressed('mute')) audio.toggleMute();
    switch (this.mode) {
      case 'title': {
        const choice = this.title.update(this.input);
        if (choice === 'new') this.newGame();
        else if (choice === 'continue') this.continueGame();
        return;
      }
      case 'pause':
        if (this.input.pressed('pause')) {
          this.mode = 'play';
          audio.sfx('menu');
        }
        return;
      case 'gameover':
        if (this.gameOver!.update(this.input)) {
          this.respawn();
          this.mode = 'play';
        }
        return;
      case 'ending':
        if (this.ending!.update(this.input)) {
          this.mode = 'title';
          this.title = new TitleScreen();
          audio.playSong('title', song('title'));
        }
        return;
      case 'play':
        this.updatePlay();
    }
  }

  private updatePlay(): void {
    const s = this.scene!;
    if (this.fade > 0) {
      this.fade++;
      if (this.fade >= FADE_TICKS && this.pendingEntry) {
        this.enterRoom(this.pendingEntry.room, this.pendingEntry.entry);
        this.pendingEntry = null;
        this.fade = -FADE_TICKS;
      }
      return;
    }
    if (this.fade < 0) this.fade++;

    if (this.dialog) {
      this.dialog.update(this.input);
      if (this.dialog.done) this.dialog = null;
      s.atmosphere.update();
      return;
    }
    if (this.itemGet) {
      s.player?.update();
      if (--this.itemGet.t <= 0) {
        const then = this.itemGet.then;
        this.itemGet = null;
        then();
      }
      return;
    }
    if (this.input.pressed('pause') && s.player?.state !== 'dead') {
      this.mode = 'pause';
      audio.sfx('menu');
      return;
    }

    s.update();
    this.progress.data.playTicks++;
    if (this.t % MAGIC_REGEN_TICKS === 0 && this.progress.has('fire')) this.progress.magic = Math.min(MAX_MAGIC, this.progress.magic + 1);
    if (s.exit) {
      this.pendingEntry = { room: s.exit.room.id, entry: s.exit.entry };
      s.exit = null;
      this.fade = 1;
    }
  }

  draw(ctx: Ctx): void {
    ctx.fillStyle = '#10161d';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.mode === 'title') return this.title.draw(ctx);
    if (this.mode === 'ending') return this.ending!.draw(ctx);
    const s = this.scene;
    if (!s) return;
    s.draw(ctx);
    const boss = s.boss();
    drawHud(ctx, this.progress, this.t, boss && this.bossAwake ? boss.hpFraction : null);
    this.drawPrompt(ctx);
    if (this.dialog) this.dialog.draw(ctx);
    if (this.mode === 'pause') {
      const p = s.player!;
      drawMapScreen(ctx, this.progress, s.def.id, p.x, p.y, this.t);
    }
    if (this.mode === 'gameover') this.gameOver!.draw(ctx);
    const f = this.fade > 0 ? this.fade / FADE_TICKS : this.fade < 0 ? -this.fade / FADE_TICKS : 0;
    if (f > 0) {
      ctx.globalAlpha = Math.min(1, f);
      ctx.fillStyle = '#10161d';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  /** Little "^" hint above things you can use. */
  private drawPrompt(ctx: Ctx): void {
    const s = this.scene!;
    const p = s.player;
    if (!p || this.dialog || this.itemGet || p.state !== 'normal' || !p.body.onGround) return;
    const near = s.interactableNear(p);
    if (!near || !near.prompt) return;
    const x = Math.round(p.x - s.camX);
    const y = Math.round(p.body.top - s.camY) - 12 - (Math.floor(this.t / 20) % 2);
    drawText(ctx, `^ ${near.prompt}`, x, y, '#fff0c8', { outline: '#4a2a26', align: 'center' });
  }
}
