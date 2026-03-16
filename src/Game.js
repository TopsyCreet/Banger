// ══════════════════════════════════════════════
//  BANGER — Main Game Controller
//  State machine: menu → playing → pause → results
// ══════════════════════════════════════════════

import * as THREE from 'three';
import { Scene3D }        from './Scene3D.js';
import { NoteManager }    from './NoteManager.js';
import { AudioEngine }    from './AudioEngine.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Scoring }        from './Scoring.js';
import { InputHandler }   from './InputHandler.js';
import { UI }             from './UI.js';
import { Tutorial }       from './Tutorial.js';
import { generateBeatMap } from './BeatMap.js';
import { LANES, SONG_DURATION, TIMING } from './config.js';

const STATES = {
  MENU:     'menu',
  TUTORIAL: 'tutorial',
  PLAYING:  'playing',
  PAUSED:   'paused',
  RESULTS:  'results',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state  = STATES.MENU;

    this.scene3d    = new Scene3D(canvas);
    this.audio      = new AudioEngine();
    this.input      = new InputHandler();
    this.scoring    = new Scoring();
    this.ui         = new UI();

    this.noteManager  = null;
    this.particles    = null;
    this._tutorial    = null;

    this._raf         = null;
    this._clock       = new THREE.Clock(false);
    this._songName    = 'Lagos Nights';
    this._lastBeatFlash = 0;
    this._comboMilestones = new Set();
  }

  async init() {
    // 3D Scene
    this.scene3d.init();
    this.noteManager = new NoteManager(this.scene3d.scene);
    this.particles   = new ParticleSystem(this.scene3d.scene);

    // Note miss callback
    this.noteManager.onMiss = (lane, beatTime) => {
      this._handleMiss(lane);
    };

    // Audio
    await this.audio.init();

    // Input
    this.input.init();

    // Tutorial (created after all sub-systems exist)
    this._tutorial = new Tutorial({
      scene3d:     this.scene3d,
      noteManager: this.noteManager,
      audio:       this.audio,
      scoring:     this.scoring,
      input:       this.input,
      ui:          this.ui,
      onComplete:  () => this.startGame(),
    });

    // UI
    this.ui.showScreen('menu');

    // Menu buttons
    document.getElementById('btn-play').addEventListener('click', () => this._startOrTutorial());
    document.getElementById('btn-tutorial').addEventListener('click', () => this.startTutorial());
    document.getElementById('btn-pause').addEventListener('click', () => this.pause());
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-quit').addEventListener('click', () => this.quitToMenu());
    document.getElementById('btn-retry').addEventListener('click', () => this.startGame());
    document.getElementById('btn-menu').addEventListener('click', () => this.quitToMenu());

    // Keyboard pause
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (this.state === STATES.PLAYING) this.pause();
        else if (this.state === STATES.PAUSED) this.resume();
      }
    });

    // Start render loop
    this._loop();
  }

  // ─────────────────────────────────────────────
  //  GAME FLOW
  // ─────────────────────────────────────────────

  /** First-time players go to tutorial; returning players go straight to game */
  _startOrTutorial() {
    if (localStorage.getItem('banger_tutorial_done')) {
      this.startGame();
    } else {
      this.startTutorial();
    }
  }

  startTutorial() {
    this.state = STATES.TUTORIAL;
    this._clock.start();
    this._tutorial.start();
  }

  startGame() {
    this.state = STATES.PLAYING;

    // Reset systems
    this.scoring.reset();
    this.noteManager.reset();
    this._comboMilestones.clear();

    // Generate beat map
    const beatmap = generateBeatMap('normal');
    this.noteManager.loadBeatmap(beatmap);
    this.audio.setNotes(beatmap);

    // Register lane inputs
    this.input.offAll();
    for (let i = 0; i < LANES.length; i++) {
      this.input.onLanePress(i, lane => this._handleLanePress(lane));
    }

    // Start audio & clock
    this.audio.start();
    this._clock.start();

    // UI
    this.ui.showScreen('hud');
    this.ui.updateScore(0);
    this.ui.updateCombo(0, 1);
    this.ui.updateHealth(100);
    this.ui.updateProgress(0, SONG_DURATION);
  }

  pause() {
    if (this.state !== STATES.PLAYING) return;
    this.state = STATES.PAUSED;
    this.audio.stop();
    this._clock.stop();
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.state = STATES.PLAYING;
    // Re-start audio from current position (simplified: restart scheduling)
    this.audio.ctx.resume();
    this._clock.start();
    this.ui.showScreen('hud');
  }

  quitToMenu() {
    this.state = STATES.MENU;
    this.audio.stop();
    this._clock.stop();
    this.noteManager.reset();
    this.input.offAll();
    this.ui.showScreen('menu');
  }

  _endGame() {
    this.state = STATES.RESULTS;
    this.audio.stop();
    this._clock.stop();
    this.input.offAll();

    const rank    = this.scoring.getRank();
    const message = this.scoring.getResultMessage(rank);

    this.ui.showResults({
      score:    this.scoring.score,
      maxCombo: this.scoring.maxCombo,
      counts:   this.scoring.counts,
      rank,
      message,
      songName: this._songName,
    });
    this.ui.showScreen('results');
  }

  // ─────────────────────────────────────────────
  //  INPUT HANDLING
  // ─────────────────────────────────────────────

  _handleLanePress(lane) {
    if (this.state !== STATES.PLAYING) return;

    const currentTime = this.audio.currentTime;
    const result = this.noteManager.tryHit(lane, currentTime);

    if (!result) {
      // No note nearby — empty press, slight penalty
      this.scene3d.flashLane(lane);
      return;
    }

    const { note, timeDiff } = result;
    const judge = this.scoring.judge(timeDiff);

    if (!judge) {
      // Too far off
      this.scene3d.flashLane(lane);
      return;
    }

    // Register hit
    const { pts, multiplier } = this.scoring.registerHit(judge);
    note.onHit(judge);

    // Visual effects
    this.scene3d.flashLane(lane);
    this.particles.burst(
      LANES[lane].x, 0.5, note.mesh.position.z, lane, judge
    );

    // Audio feedback
    this.audio.playHitFeedback(lane, judge);

    // UI
    this.ui.showJudge(judge);
    this.ui.updateScore(this.scoring.score);
    this.ui.updateCombo(this.scoring.combo, multiplier);
    this.ui.updateHealth(this.scoring.health);

    // Combo milestones
    const milestone = [10, 25, 50, 100, 200].find(
      m => this.scoring.combo >= m && !this._comboMilestones.has(m)
    );
    if (milestone) {
      this._comboMilestones.add(milestone);
      this.particles.comboFlare(LANES[lane].x, 0.5, note.mesh.position.z, lane);
      this.ui.flashScreen(LANES[lane].hexStr);
      this.audio.playCrowdCheer();
    }

    // Judge flash
    if (judge === 'miss') {
      this.ui.shakeScreen();
    }
  }

  _handleMiss(lane) {
    if (this.state !== STATES.PLAYING) return;

    this.scoring.registerMiss();
    this.audio.playMissFeedback();
    this.ui.showJudge('miss');
    this.ui.updateCombo(this.scoring.combo, 1);
    this.ui.updateHealth(this.scoring.health);
    this.ui.shakeScreen();

    // Ripple effect at hit zone
    this.particles.ripple(LANES[lane].x, 0.5, 6);

    // Check death
    if (this.scoring.isDead) {
      setTimeout(() => this._endGame(), 800);
    }
  }

  // ─────────────────────────────────────────────
  //  MAIN LOOP
  // ─────────────────────────────────────────────

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());

    const dt = Math.min(this._clock.getDelta(), 0.05);

    if (this.state === STATES.TUTORIAL) {
      // Tutorial drives its own song clock and note manager
      this._tutorial.update(dt);
      this.particles.update(dt);
    }

    if (this.state === STATES.PLAYING) {
      const currentTime = this.audio.currentTime;

      // Update notes
      this.noteManager.update(currentTime, this.scene3d.camera, dt);

      // Update particles
      this.particles.update(dt);

      // Beat flash on strong beats (kick = lane 0 notes)
      const beatNote = this.noteManager.beatmap.find(
        n => n.lane === 0 && Math.abs(n.time - currentTime) < 0.04
      );
      if (beatNote && currentTime - this._lastBeatFlash > 0.3) {
        this.scene3d.onBeat(0.6);
        this._lastBeatFlash = currentTime;
      }

      // Progress bar
      this.ui.updateProgress(currentTime, SONG_DURATION);

      // Check song end
      if (currentTime >= SONG_DURATION) {
        this._endGame();
      }
    }

    // Always update scene
    this.scene3d.update(dt);
    this.scene3d.render();
  }
}
