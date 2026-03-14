// ══════════════════════════════════════════════
//  BANGER — Input Handler
//  Keyboard (ASDF+Space) + Touch lane buttons
// ══════════════════════════════════════════════

import { LANES } from './config.js';

export class InputHandler {
  constructor() {
    this.callbacks = {};  // lane -> [callback]
    this._pressedKeys = new Set();
    this._onKey  = this._onKey.bind(this);
    this._onTouch = this._onTouch.bind(this);
  }

  init() {
    window.addEventListener('keydown', this._onKey);

    // Mobile lane buttons
    document.querySelectorAll('.mobile-btn').forEach(btn => {
      btn.addEventListener('touchstart', this._onTouch, { passive: true });
      btn.addEventListener('mousedown',  this._onTouch);
    });
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    document.querySelectorAll('.mobile-btn').forEach(btn => {
      btn.removeEventListener('touchstart', this._onTouch);
      btn.removeEventListener('mousedown',  this._onTouch);
    });
  }

  onLanePress(lane, cb) {
    if (!this.callbacks[lane]) this.callbacks[lane] = [];
    this.callbacks[lane].push(cb);
  }

  offAll() {
    this.callbacks = {};
  }

  _fire(lane) {
    const cbs = this.callbacks[lane];
    if (cbs) cbs.forEach(cb => cb(lane));
  }

  _onKey(e) {
    if (this._pressedKeys.has(e.code)) return; // ignore key repeat
    this._pressedKeys.add(e.code);
    window.addEventListener('keyup', () => {
      this._pressedKeys.delete(e.code);
    }, { once: true });

    const idx = LANES.findIndex(l => l.key === e.code);
    if (idx !== -1) {
      e.preventDefault();
      this._fire(idx);
      this._flashMobileBtn(idx);
    }
  }

  _onTouch(e) {
    const btn  = e.currentTarget;
    const lane = parseInt(btn.dataset.lane, 10);
    if (!isNaN(lane)) {
      this._fire(lane);
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
    }
  }

  _flashMobileBtn(lane) {
    const btn = document.querySelector(`.mobile-btn[data-lane="${lane}"]`);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
    }
  }
}
