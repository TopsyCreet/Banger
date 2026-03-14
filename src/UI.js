// ══════════════════════════════════════════════
//  BANGER — UI Manager
//  Manages all DOM overlay updates
// ══════════════════════════════════════════════

import { JUDGE_STYLES, MAX_HEALTH } from './config.js';

export class UI {
  constructor() {
    this._judgeTimer = null;
    this._scoreEl    = document.getElementById('hud-score');
    this._comboEl    = document.getElementById('hud-combo');
    this._multEl     = document.getElementById('hud-multiplier');
    this._healthEl   = document.getElementById('hud-health-bar');
    this._progressEl = document.getElementById('hud-progress-bar');
    this._judgeEl    = document.getElementById('hud-judge');
    this._screens    = {};

    ['menu', 'hud', 'pause', 'results'].forEach(id => {
      this._screens[id] = document.getElementById(`screen-${id}`);
    });
  }

  showScreen(name) {
    Object.entries(this._screens).forEach(([id, el]) => {
      el.classList.toggle('active', id === name);
    });
  }

  // ── HUD updates
  updateScore(score) {
    this._scoreEl.textContent = score.toLocaleString();
  }

  updateCombo(combo, multiplier) {
    this._comboEl.textContent = combo;
    this._multEl.textContent  = `×${multiplier}`;

    // Color multiplier
    const colors = ['', '#ffffff', '#00e676', '#ffd600', '#ff44ff'];
    this._multEl.style.color = colors[multiplier] || '#ff44ff';

    // Combo shake at milestones
    if ([10, 25, 50, 100].includes(combo)) {
      this._comboEl.style.transform = 'scale(1.5)';
      setTimeout(() => { this._comboEl.style.transform = ''; }, 200);
    }
  }

  updateHealth(health) {
    const pct = Math.max(0, (health / MAX_HEALTH) * 100);
    this._healthEl.style.width = pct + '%';

    // Change color as health drops
    if (pct < 25) {
      this._healthEl.style.background = '#ff1744';
    } else if (pct < 60) {
      this._healthEl.style.background = 'linear-gradient(90deg, #ff1744, #ffd600)';
    } else {
      this._healthEl.style.background = 'linear-gradient(90deg, #ff1744, #ffd600, #00e676)';
    }
  }

  updateProgress(elapsed, total) {
    const pct = Math.min(100, (elapsed / total) * 100);
    this._progressEl.style.width = pct + '%';
  }

  showJudge(quality) {
    const style = JUDGE_STYLES[quality];
    if (!style) return;

    this._judgeEl.textContent  = style.text;
    this._judgeEl.style.color  = style.color;
    this._judgeEl.classList.remove('hidden');

    // Restart animation
    this._judgeEl.style.animation = 'none';
    void this._judgeEl.offsetWidth;  // reflow
    this._judgeEl.style.animation = '';

    if (this._judgeTimer) clearTimeout(this._judgeTimer);
    this._judgeTimer = setTimeout(() => {
      this._judgeEl.classList.add('hidden');
    }, 500);
  }

  // ── Results screen
  showResults({ score, maxCombo, counts, rank, message, songName }) {
    document.getElementById('res-score').textContent   = score.toLocaleString();
    document.getElementById('res-combo').textContent   = maxCombo;
    document.getElementById('res-perfect').textContent = counts.perfect;
    document.getElementById('res-good').textContent    = counts.good;
    document.getElementById('res-ok').textContent      = counts.ok;
    document.getElementById('res-miss').textContent    = counts.miss;

    const rankEl = document.getElementById('results-rank');
    rankEl.textContent = rank;

    const rankColors = {
      S: 'linear-gradient(135deg, #ffd600, #ff8800)',
      A: 'linear-gradient(135deg, #00e676, #00bcd4)',
      B: 'linear-gradient(135deg, #2979ff, #9c27b0)',
      C: 'linear-gradient(135deg, #78909c, #546e7a)',
      D: 'linear-gradient(135deg, #ff1744, #d50000)',
    };
    rankEl.style.background = rankColors[rank] || rankColors.C;
    rankEl.style['-webkit-background-clip'] = 'text';
    rankEl.style['-webkit-text-fill-color'] = 'transparent';
    rankEl.style['background-clip'] = 'text';

    const titleEl = document.getElementById('results-title');
    const titles  = { S: '🔥 BANGER!!', A: '🎵 FIRE TUNE!', B: '👍 NOT BAD', C: '😅 CLOSE', D: '💔 ROUGH' };
    titleEl.textContent = titles[rank] || 'DONE';

    document.getElementById('results-song').textContent   = songName || '';
    document.getElementById('results-message').textContent = message || '';
  }

  // ── Screen flash (on combo milestone)
  flashScreen(color = '#ffd600') {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      background: ${color};
      opacity: 0.18;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 350);
    });
  }

  // ── Screen shake (on miss)
  shakeScreen() {
    document.body.style.transform = 'translateX(4px)';
    setTimeout(() => { document.body.style.transform = 'translateX(-4px)'; }, 50);
    setTimeout(() => { document.body.style.transform = ''; }, 100);
  }
}
