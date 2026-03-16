// ══════════════════════════════════════════════
//  BANGER — Interactive Tutorial
//  Teaches each lane one at a time, step by step
// ══════════════════════════════════════════════

import { LANES, HIT_ZONE_Z, TIMING, TUTORIAL_NOTE_SPEED, TUTORIAL_LANE_SPEED } from './config.js';

// ── Lightweight note for tutorial (managed manually, not via NoteManager)
import * as THREE from 'three';

const LANE_MESSAGES = [
  { emoji: '🥁', instrument: 'DRUM',         desc: 'The heartbeat of the song.',   shape: 'cube'    },
  { emoji: '🎸', instrument: 'BASS',         desc: 'The deep rumble underneath.',  shape: 'cylinder'},
  { emoji: '🎵', instrument: 'GUITAR',       desc: 'The melody that hooks you.',   shape: 'diamond' },
  { emoji: '🪇', instrument: 'SHAKER',       desc: 'The groove that keeps time.',  shape: 'ball'    },
  { emoji: '🥁', instrument: 'TALKING DRUM', desc: 'The voice of Lagos.',          shape: 'ring'    },
];

const HITS_NEEDED   = 2;      // hits per lane to advance
const HINT_DELAY    = 8000;   // ms before hint appears
const AUTO_ADVANCE  = 30000;  // ms before auto-advancing if stuck

// Generate spaced notes for a single lane at a custom speed
function makeTutorialNotes(laneIdx, speed) {
  const travelTime = (HIT_ZONE_Z - (-42)) / speed;
  // Notes arrive at hit zone at these song times
  const hitTimes = [travelTime + 1, travelTime + 4, travelTime + 7, travelTime + 10];
  return hitTimes.map(t => ({ time: t, lane: laneIdx }));
}

function makePracticeNotes(speed) {
  // Simpler beat pattern for practice — all 5 lanes, gentle pacing
  const travelTime = (HIT_ZONE_Z - (-42)) / speed;
  const notes = [];
  const base  = travelTime + 1;
  const step  = 0.55; // 8th notes at ~109 BPM

  const pattern = [
    // bar 1
    [0, 0], [2, 1], [4, 2], [6, 3], [8, 4],
    [10, 0], [12, 1], [14, 2], [16, 3],
    // bar 2
    [18, 0], [20, 4], [22, 1], [24, 2], [26, 0],
    [28, 3], [30, 4], [32, 0], [34, 1], [36, 2],
  ];

  pattern.forEach(([beat, lane]) => {
    notes.push({ time: base + beat * step, lane });
  });

  return notes.sort((a, b) => a.time - b.time);
}

// ══════════════════════════════════════════════════════════
export class Tutorial {
  /**
   * @param {object} opts
   * opts.scene3d, opts.noteManager, opts.audio,
   * opts.scoring, opts.input, opts.ui, opts.onComplete
   */
  constructor(opts) {
    this._scene3d      = opts.scene3d;
    this._noteManager  = opts.noteManager;
    this._audio        = opts.audio;
    this._scoring      = opts.scoring;
    this._input        = opts.input;
    this._ui           = opts.ui;
    this._onComplete   = opts.onComplete;

    this._phase        = -1;   // -1 = not started
    this._hits         = 0;
    this._hintTimer    = null;
    this._advTimer     = null;
    this._countdownTimer = null;
    this._currentSpeed = TUTORIAL_NOTE_SPEED;
    this._songTime     = 0;
    this._active       = false;

    // DOM refs
    this._panels = {
      welcome:  document.getElementById('tut-welcome'),
      lane:     document.getElementById('tut-lane'),
      practice: document.getElementById('tut-practice'),
      complete: document.getElementById('tut-complete'),
    };
    this._dots = document.querySelectorAll('.tut-dot');

    // Wire buttons
    document.getElementById('btn-tut-skip').addEventListener('click', () => this._finish());
    document.getElementById('btn-tut-done').addEventListener('click', () => this._goPhase(7));
    document.getElementById('btn-tut-play').addEventListener('click', () => this._finish());
    document.getElementById('btn-tut-replay').addEventListener('click', () => this.start());
  }

  // ──────────────────────────────────────────────
  //  PUBLIC
  // ──────────────────────────────────────────────

  start() {
    this._active = true;
    this._songTime = 0;
    this._noteManager.reset();
    this._input.offAll();
    this._ui.showScreen('tutorial');
    this._goPhase(0);
  }

  /** Called from Game._loop() when in TUTORIAL state */
  update(dt) {
    if (!this._active) return;
    this._songTime += dt;
    this._noteManager.update(this._songTime, this._scene3d.camera, dt);
  }

  // ──────────────────────────────────────────────
  //  PHASE MACHINE
  // ──────────────────────────────────────────────

  _goPhase(phase) {
    this._clearTimers();
    this._hideAllPanels();
    this._phase = phase;
    this._updateDots(phase <= 5 ? phase : phase - 1);

    if (phase === 0)     this._phaseWelcome();
    else if (phase <= 5) this._phaseLane(phase - 1);   // lanes 0–4
    else if (phase === 6) this._phasePractice();
    else                  this._phaseComplete();
  }

  // Phase 0 ── Welcome
  _phaseWelcome() {
    this._showPanel('welcome');
    this._updateDots(0);
    let count = 3;
    const el  = document.getElementById('tut-countdown');
    el.textContent = count;

    this._countdownTimer = setInterval(() => {
      count--;
      el.textContent = count;
      if (count <= 0) {
        clearInterval(this._countdownTimer);
        this._goPhase(1);
      }
    }, 1000);
  }

  // Phase 1–5 ── Individual lane lesson
  _phaseLane(laneIdx) {
    const lane   = LANES[laneIdx];
    const meta   = LANE_MESSAGES[laneIdx];
    this._hits   = 0;
    this._currentSpeed = TUTORIAL_NOTE_SPEED;

    // Reset song clock for this phase
    this._songTime = 0;

    // Load notes for just this lane
    const notes = makeTutorialNotes(laneIdx, this._currentSpeed);
    this._noteManager.reset();
    this._noteManager.loadBeatmap(notes);

    // Override miss callback — no damage in tutorial
    this._noteManager.onMiss = () => {};

    // Show panel
    this._showPanel('lane');
    document.getElementById('tut-badge').textContent = `${meta.emoji} ${meta.instrument}`;
    document.getElementById('tut-badge').style.background = lane.hexStr;
    document.getElementById('tut-lane-name').textContent = meta.desc;
    document.getElementById('tut-key-display').textContent = lane.label;
    document.getElementById('tut-key-display').style.borderColor = lane.hexStr;
    document.getElementById('tut-key-display').style.boxShadow = `0 0 20px ${lane.hexStr}55`;

    const instruction = window.innerWidth < 600
      ? `Tap the <strong style="color:${lane.hexStr}">${meta.instrument}</strong> button when the shape hits the glow ring!`
      : `Press <strong style="color:${lane.hexStr}">${lane.label}</strong> when the shape reaches the glow ring!`;
    document.getElementById('tut-lane-instruction').innerHTML = instruction;

    this._updateHitCounter(0);
    document.getElementById('tut-hint').classList.add('hidden');

    // Highlight the correct mobile button
    this._clearLaneBtns();
    const btn = document.querySelector(`.mobile-btn[data-lane="${laneIdx}"]`);
    if (btn) btn.classList.add('tut-active');

    // Flash the hit zone for this lane
    const flashInterval = setInterval(() => {
      if (this._phase !== laneIdx + 1) { clearInterval(flashInterval); return; }
      this._scene3d.flashLane(laneIdx);
    }, 900);

    // Register lane input
    this._input.offAll();
    this._input.onLanePress(laneIdx, () => this._onTutorialHit(laneIdx));

    // Hint timer — show hint if player doesn't hit in time
    this._hintTimer = setTimeout(() => {
      if (this._phase === laneIdx + 1) {
        document.getElementById('tut-hint').classList.remove('hidden');
      }
    }, HINT_DELAY);

    // Auto-advance safety net
    this._advTimer = setTimeout(() => {
      if (this._phase === laneIdx + 1) {
        this._hits = HITS_NEEDED; // force advance
        this._goPhase(laneIdx + 2);
      }
    }, AUTO_ADVANCE);
  }

  // Phase 6 ── All lanes practice
  _phasePractice() {
    this._showPanel('practice');
    this._currentSpeed = TUTORIAL_LANE_SPEED;
    this._songTime = 0;

    const notes = makePracticeNotes(this._currentSpeed);
    this._noteManager.reset();
    this._noteManager.loadBeatmap(notes);
    this._noteManager.onMiss = () => {};  // still no damage

    this._clearLaneBtns();

    // All lanes active
    this._input.offAll();
    for (let i = 0; i < LANES.length; i++) {
      this._input.onLanePress(i, lane => this._onPracticeHit(lane));
    }

    // Auto-complete practice after all notes pass
    const maxTime = notes[notes.length - 1].time + 3;
    this._advTimer = setTimeout(() => {
      if (this._phase === 6) this._goPhase(7);
    }, maxTime * 1000);
  }

  // Phase 7 ── Complete
  _phaseComplete() {
    this._showPanel('complete');
    this._clearLaneBtns();
    this._noteManager.reset();
    this._input.offAll();
    this._active = false;
    this._updateDots(6);
    localStorage.setItem('banger_tutorial_done', '1');
  }

  // ──────────────────────────────────────────────
  //  HIT HANDLING
  // ──────────────────────────────────────────────

  _onTutorialHit(laneIdx) {
    const result = this._noteManager.tryHit(laneIdx, this._songTime);

    if (!result) {
      // Empty press — small visual feedback
      this._scene3d.flashLane(laneIdx);
      return;
    }

    const diff  = Math.abs(result.timeDiff);
    const judge = diff <= TIMING.ok ? (diff <= TIMING.good ? (diff <= TIMING.perfect ? 'perfect' : 'good') : 'ok') : null;

    if (!judge) return;

    result.note.onHit(judge);
    this._scene3d.flashLane(laneIdx);
    this._audio.playHitFeedback(laneIdx, judge === 'perfect' ? 'perfect' : 'good');

    this._hits++;
    this._updateHitCounter(this._hits);

    if (this._hits >= HITS_NEEDED) {
      // Small delay so player sees the counter hit 2/2
      setTimeout(() => {
        if (this._phase === laneIdx + 1) {
          // Celebration before next phase
          this._audio.playCrowdCheer();
          this._ui.flashScreen(LANES[laneIdx].hexStr);
          setTimeout(() => this._goPhase(laneIdx + 2), 600);
        }
      }, 400);
    }
  }

  _onPracticeHit(laneIdx) {
    const result = this._noteManager.tryHit(laneIdx, this._songTime);
    if (!result) { this._scene3d.flashLane(laneIdx); return; }
    const diff = Math.abs(result.timeDiff);
    if (diff > TIMING.ok) return;
    result.note.onHit(diff <= TIMING.perfect ? 'perfect' : 'good');
    this._scene3d.flashLane(laneIdx);
    this._audio.playHitFeedback(laneIdx, 'good');
  }

  // ──────────────────────────────────────────────
  //  FINISH
  // ──────────────────────────────────────────────

  _finish() {
    this._clearTimers();
    this._clearLaneBtns();
    this._noteManager.reset();
    this._input.offAll();
    this._active = false;
    localStorage.setItem('banger_tutorial_done', '1');
    this._onComplete();
  }

  // ──────────────────────────────────────────────
  //  DOM HELPERS
  // ──────────────────────────────────────────────

  _showPanel(name) {
    Object.entries(this._panels).forEach(([k, el]) => {
      el.classList.toggle('hidden', k !== name);
    });
  }

  _hideAllPanels() {
    Object.values(this._panels).forEach(el => el.classList.add('hidden'));
  }

  _updateHitCounter(n) {
    const el = document.getElementById('tut-hits-done');
    el.textContent = n;
    // Bump animation
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }

  _updateDots(activeStep) {
    this._dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeStep);
      dot.classList.toggle('done', i < activeStep);
    });
  }

  _clearLaneBtns() {
    document.querySelectorAll('.mobile-btn').forEach(b => b.classList.remove('tut-active'));
  }

  _clearTimers() {
    if (this._hintTimer)     clearTimeout(this._hintTimer);
    if (this._advTimer)      clearTimeout(this._advTimer);
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._hintTimer = this._advTimer = this._countdownTimer = null;
  }
}
