// ══════════════════════════════════════════════
//  BANGER — Scoring System
// ══════════════════════════════════════════════

import {
  TIMING, SCORE_VALUES, COMBO_THRESHOLDS,
  MISS_DAMAGE, HIT_HEAL, MAX_HEALTH
} from './config.js';

export class Scoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.score      = 0;
    this.combo      = 0;
    this.maxCombo   = 0;
    this.multiplier = 1;
    this.health     = MAX_HEALTH;
    this.counts     = { perfect: 0, good: 0, ok: 0, miss: 0 };
  }

  /** Evaluate timing diff (seconds). Returns judge string or null if no note. */
  judge(timeDiff) {
    const d = Math.abs(timeDiff);
    if (d <= TIMING.perfect) return 'perfect';
    if (d <= TIMING.good)    return 'good';
    if (d <= TIMING.ok)      return 'ok';
    return null;  // too far off — not a hit
  }

  /** Register a hit with a judge result */
  registerHit(judge) {
    const pts = SCORE_VALUES[judge] || 0;

    if (judge !== 'miss') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.multiplier = this._getMultiplier();
      this.score += pts * this.multiplier;
      this.health = Math.min(MAX_HEALTH, this.health + HIT_HEAL);
    }

    this.counts[judge]++;
    return { pts: pts * this.multiplier, multiplier: this.multiplier };
  }

  /** Register a missed note (player didn't hit in time) */
  registerMiss() {
    this.combo = 0;
    this.multiplier = 1;
    this.health = Math.max(0, this.health - MISS_DAMAGE);
    this.counts.miss++;
    return { pts: 0, multiplier: 1 };
  }

  get isDead() {
    return this.health <= 0;
  }

  /** Calculate final rank */
  getRank() {
    const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
    if (total === 0) return 'C';
    const pct = (this.counts.perfect + this.counts.good) / total;
    const missRate = this.counts.miss / total;

    if (pct >= 0.95 && missRate < 0.02) return 'S';
    if (pct >= 0.85 && missRate < 0.08) return 'A';
    if (pct >= 0.70 && missRate < 0.15) return 'B';
    if (pct >= 0.55)                    return 'C';
    return 'D';
  }

  getResultMessage(rank) {
    const msgs = {
      S: "Omo! You are a certified banger machine! 🔥🔥🔥",
      A: "Lagos is proud of you. This beat slaps!",
      B: "Not bad for a bedroom producer. Keep grinding.",
      C: "Your mama is still asking when you'll get a real job... 😅",
      D: "The crowd has entered the building. And left. Immediately.",
    };
    return msgs[rank] || "Keep going.";
  }

  _getMultiplier() {
    for (const t of COMBO_THRESHOLDS) {
      if (this.combo >= t.combo) return t.mult;
    }
    return 1;
  }
}
