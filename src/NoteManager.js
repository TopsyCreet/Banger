// ══════════════════════════════════════════════
//  BANGER — Note Manager (Piano Tiles mode)
//  Spawns, updates, and manages 2D tile elements for piano-tiles gameplay
// ══════════════════════════════════════════════

import { LANES, HIT_ZONE_Y, SPAWN_Y, NOTE_SPEED, TIMING } from './config.js';

const LOOK_AHEAD_SEC = Math.abs(SPAWN_Y - HIT_ZONE_Y) / NOTE_SPEED + 0.2;
const DESPAWN_PAST   = 0.3;  // seconds past hit zone before removal

class NoteObject {
  constructor(lane, beatTime) {
    this.lane     = lane;
    this.beatTime = beatTime;
    this.hit      = false;
    this.missed   = false;

    this.el = document.createElement('div');
    this.el.className = 'piano-tile';
    this.el.dataset.lane = lane;
    this.el.textContent = LANES[lane].label;
    this.el.style.borderColor = LANES[lane].hexStr;
    this.el.style.background = `${LANES[lane].hexStr}22`;

    const laneEl = document.querySelector(`.piano-lane[data-lane="${lane}"]`);
    if (laneEl) laneEl.appendChild(this.el);
  }

  update(currentTime) {
    const timeDiff = this.beatTime - currentTime;
    const progress = 1 - timeDiff / LOOK_AHEAD_SEC;
    const clamped = Math.min(1, Math.max(0, progress));

    // Move from above view (-20%) down to hit line (approx 80%)
    const yPct = clamped * 100 - 20;
    this.el.style.top = `${yPct}%`;

    // Stretch tile based on speed to produce a "fast sliding" look
    const stretch = 1 + Math.max(0, (1 - clamped) * 0.75);
    this.el.style.transform = `scaleY(${stretch})`;

    // Fade in as it appears
    this.el.style.opacity = `${Math.min(1, clamped * 1.2)}`;
  }

  /** Visual feedback on hit */
  onHit(quality) {
    this.hit = true;
    this.el.classList.add('hit');
    this.el.style.opacity = '0';
  }

  /** Visual feedback on miss */
  onMiss() {
    this.missed = true;
    this.el.classList.add('miss');
    this.el.style.opacity = '0';
  }

  remove() {
    this.el.remove();
  }
}

export class NoteManager {
  constructor() {
    this.notes    = [];   // all NoteObjects currently active
    this.beatmap  = [];   // full sorted list of { time, lane }
    this.spawnIdx = 0;    // next index in beatmap to spawn

    this.onMiss   = null;  // callback(lane, beatTime)
  }

  loadBeatmap(beatmap) {
    this.beatmap  = beatmap;
    this.spawnIdx = 0;
  }

  reset() {
    // Remove all existing notes
    this.notes.forEach(n => n.remove());
    this.notes    = [];
    this.spawnIdx = 0;
  }

  update(currentTime) {
    // ── Spawn upcoming notes
    while (
      this.spawnIdx < this.beatmap.length &&
      this.beatmap[this.spawnIdx].time <= currentTime + LOOK_AHEAD_SEC
    ) {
      const beat = this.beatmap[this.spawnIdx];
      if (beat.time >= currentTime - 0.1) {  // don't spawn already-past notes
        const note = new NoteObject(beat.lane, beat.time);
        this.notes.push(note);
      }
      this.spawnIdx++;
    }

    // ── Update positions
    const toRemove = [];
    for (const note of this.notes) {
      if (!note.hit && !note.missed) {
        note.update(currentTime);

        // Auto-miss: note passed hit zone beyond tolerance (fire once)
        if (currentTime - note.beatTime > TIMING.miss) {
          note.onMiss();
          if (this.onMiss) this.onMiss(note.lane, note.beatTime);
          // note.missed = true is set in onMiss, so this won't repeat
        }
      }

      // Remove notes that are completely past
      if (note.hit || note.missed) {
        if (currentTime - note.beatTime > DESPAWN_PAST) {
          note.remove();
          toRemove.push(note);
        }
      }
    }

    // Cleanup
    if (toRemove.length) {
      this.notes = this.notes.filter(n => !toRemove.includes(n));
    }
  }

  /**
   * Try to hit the nearest unhit note in a given lane.
   * Returns { note, timeDiff } or null.
   */
  tryHit(lane, currentTime) {
    let best = null;
    let bestDiff = Infinity;

    for (const note of this.notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const diff = Math.abs(currentTime - note.beatTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = note;
      }
    }

    if (!best) return null;

    // Raw signed diff (negative = early, positive = late)
    const signedDiff = currentTime - best.beatTime;
    return { note: best, timeDiff: signedDiff };
  }

  /** How many notes remain unplayed */
  get remaining() {
    return this.beatmap.length - this.spawnIdx + this.notes.filter(n => !n.hit && !n.missed).length;
  }
}
