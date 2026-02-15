import { CANVAS_WIDTH, CANVAS_HEIGHT, TRACK_MUSIC } from "./config.js";
import {
  SNAKES,
  snakeHeadTextureKey,
  snakeSegmentTextureKey,
  snakeHeadTexturePath,
  snakeSegmentTexturePath,
} from "./catalog.js";

export function createSceneApi({ ui, state, updateRace, renderRace, renderIdle } = {}) {
  function initPhaser() {
    class RaceScene extends Phaser.Scene {
      constructor() {
        super("RaceScene");
        this.graphics = null;
        this.infoText = null;
        this.labelMap = new Map();
        this.spriteSupportMap = new Map();
        this.headSpriteMap = new Map();
        this.segmentSpriteMap = new Map();
        this.trackMusicMap = new Map();
      }

      preload() {
        for (const snake of SNAKES) {
          this.load.image(snakeHeadTextureKey(snake.id), snakeHeadTexturePath(snake.id));
          this.load.image(snakeSegmentTextureKey(snake.id), snakeSegmentTexturePath(snake.id));
        }
        for (const musicCfg of Object.values(TRACK_MUSIC)) {
          this.load.audio(musicCfg.key, musicCfg.path);
        }
      }

      create() {
        this.graphics = this.add.graphics();
        this.infoText = this.add
          .text(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT - 12, "", {
            fontFamily: "\"Exo 2\", sans-serif",
            fontSize: "12px",
            color: "#d8e7ff",
            align: "center",
            stroke: "#07111f",
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(30);

        for (const snake of SNAKES) {
          this.spriteSupportMap.set(snake.id, {
            head: this.textures.exists(snakeHeadTextureKey(snake.id)),
            segment: this.textures.exists(snakeSegmentTextureKey(snake.id)),
          });
        }

        for (const [trackId, musicCfg] of Object.entries(TRACK_MUSIC)) {
          if (!this.cache.audio.exists(musicCfg.key)) {
            continue;
          }
          const trackMusic = this.sound.add(musicCfg.key, { volume: musicCfg.volume });
          trackMusic.setLoop(true);
          this.trackMusicMap.set(trackId, trackMusic);
        }

        applyBackgroundRunPolicy(this.game);
        state.raceScene = this;
        syncRaceMusic();
      }

      update(time, delta) {
        const dt = Math.min(0.033, Math.max(0.001, delta / 1000));
        const raceBeforeUpdate = state.race;
        if (!raceBeforeUpdate) {
          renderIdle(this);
          return;
        }

        updateRace(raceBeforeUpdate, time, dt);

        const raceAfterUpdate = state.race;
        if (raceAfterUpdate) {
          renderRace(this, raceAfterUpdate, time);
        } else {
          renderIdle(this);
        }
      }
    }

    state.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ui.raceStage,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#081122",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      },
      fps: {
        forceSetTimeOut: true,
        target: 60,
        min: 5,
        panicMax: 120,
      },
      scene: [RaceScene],
    });
  }

  function applyBackgroundRunPolicy(game) {
    if (!game || state.visibilityPolicyApplied) {
      return;
    }

    const events = game.events;
    if (!events) {
      return;
    }

    // Disable Phaser auto-pause on hidden state and keep the loop alive.
    events.off(Phaser.Core.Events.HIDDEN, game.onHidden, game);
    events.off(Phaser.Core.Events.VISIBLE, game.onVisible, game);

    const onHiddenKeepAlive = () => {
      game.loop.blur();
    };
    const onVisibleKeepAlive = () => {
      game.loop.focus();
      events.emit(Phaser.Core.Events.RESUME, 0);
    };

    events.on(Phaser.Core.Events.HIDDEN, onHiddenKeepAlive);
    events.on(Phaser.Core.Events.VISIBLE, onVisibleKeepAlive);

    state.visibilityKeepAliveHandlers = { onHiddenKeepAlive, onVisibleKeepAlive };
    state.visibilityPolicyApplied = true;
  }

  function syncRaceMusic() {
    const scene = state.raceScene;
    if (!scene || !scene.trackMusicMap || !scene.trackMusicMap.size) {
      return;
    }
    const activeTrackId = state.currentScreen === "race" && state.race?.trackDef?.id ? state.race.trackDef.id : null;

    scene.trackMusicMap.forEach((music, trackId) => {
      if (!music) {
        return;
      }
      const shouldPlay = activeTrackId === trackId;
      if (shouldPlay) {
        if (!music.loop) {
          music.setLoop(true);
        }
        if (!music.isPlaying) {
          try {
            const cfg = TRACK_MUSIC[trackId];
            music.play({ loop: true, volume: cfg?.volume ?? music.volume ?? 1 });
          } catch (error) {
            console.warn("[audio] track music play failed:", error);
          }
        }
      } else if (music.isPlaying) {
        music.stop();
      }
    });
  }

  return {
    initPhaser,
    syncRaceMusic,
  };
}
