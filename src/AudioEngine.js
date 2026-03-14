// ══════════════════════════════════════════════
//  BANGER — Audio Engine
//  Procedural Afrobeats synthesizer using Web Audio API
// ══════════════════════════════════════════════

const SCHEDULE_AHEAD = 0.15;  // seconds to schedule ahead
const INTERVAL       = 0.08;  // scheduler tick interval

export class AudioEngine {
  constructor() {
    this.ctx          = null;
    this.masterGain   = null;
    this.startTime    = 0;
    this.isPlaying    = false;
    this._timerID     = null;
    this._beatQueue   = [];   // { time, lane } beats to schedule
    this._scheduled   = new Set(); // set of beat.time strings already scheduled
    this.notes        = [];   // full note list from BeatMap
    this.noteIdx      = 0;    // index into notes for scheduling
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    // Reverb for atmosphere
    this.reverb = await this._createReverb();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.25;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  async _createReverb() {
    const convolver = this.ctx.createConvolver();
    const rate = this.ctx.sampleRate;
    const length = rate * 1.5;
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    convolver.buffer = buffer;
    return convolver;
  }

  /** Called with the full sorted note list before starting */
  setNotes(notes) {
    this.notes   = notes;
    this.noteIdx = 0;
  }

  start() {
    if (!this.ctx) return;
    this.ctx.resume();
    this.startTime = this.ctx.currentTime;
    this.isPlaying = true;
    this.noteIdx   = 0;
    this._tick();
  }

  stop() {
    this.isPlaying = false;
    if (this._timerID) clearTimeout(this._timerID);
  }

  /** Elapsed song time in seconds */
  get currentTime() {
    if (!this.ctx) return 0;
    return this.ctx.currentTime - this.startTime;
  }

  /** AudioContext absolute time for a given song-relative time */
  absTime(songTime) {
    return this.startTime + songTime;
  }

  // ── Scheduler tick
  _tick() {
    if (!this.isPlaying) return;
    const scheduleUntil = this.ctx.currentTime + SCHEDULE_AHEAD;

    while (
      this.noteIdx < this.notes.length &&
      this.absTime(this.notes[this.noteIdx].time) <= scheduleUntil
    ) {
      const note = this.notes[this.noteIdx];
      const at   = this.absTime(note.time);
      this._playInstrument(note.lane, at);
      this.noteIdx++;
    }

    this._timerID = setTimeout(() => this._tick(), INTERVAL * 1000);
  }

  // ── Route each lane to its synth voice
  _playInstrument(lane, at) {
    switch (lane) {
      case 0: this.playKick(at);        break;
      case 1: this.playBass(at);        break;
      case 2: this.playGuitar(at);      break;
      case 3: this.playShaker(at);      break;
      case 4: this.playTalkingDrum(at); break;
    }
  }

  // ─────────────────────────────────────────────
  //  SYNTH VOICES
  // ─────────────────────────────────────────────

  /** Kick Drum: sine + noise transient */
  playKick(at = 0) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.connect(this.masterGain);

    // Pitched sine (the "body")
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, at);
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.08);
    osc.start(at);
    osc.stop(at + 0.25);

    gain.gain.setValueAtTime(1.2, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
    osc.connect(gain);

    // Noise click (transient attack)
    const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const data = clickBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.5, at);
    clickGain.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    const clickHP = ctx.createBiquadFilter();
    clickHP.type = 'highpass';
    clickHP.frequency.value = 1000;
    click.connect(clickHP);
    clickHP.connect(clickGain);
    clickGain.connect(this.masterGain);
    click.start(at);
  }

  /** Bass: a plucky sub-bass sine */
  playBass(at = 0) {
    const ctx = this.ctx;
    const notes = [55, 58, 55, 58, 55, 62, 65]; // rotating bass notes (Hz-ish)
    const freq = notes[Math.floor(Math.random() * notes.length)];

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 2, at);  // start octave up for attack
    osc.frequency.exponentialRampToValueAtTime(freq, at + 0.03);
    osc.start(at);
    osc.stop(at + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
  }

  /** Guitar: sawtooth + band-pass filter */
  playGuitar(at = 0) {
    const ctx = this.ctx;
    const guitarNotes = [196, 220, 246, 261, 293, 329, 349];
    const freq = guitarNotes[Math.floor(Math.random() * guitarNotes.length)];

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.start(at);
    osc.stop(at + 0.18);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 2;
    bp.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);

    // Slight reverb send for guitar
    const rvGain = ctx.createGain();
    rvGain.gain.value = 0.2;
    bp.connect(rvGain);
    rvGain.connect(this.reverb);
  }

  /** Shaker: filtered noise burst */
  playShaker(at = 0) {
    const ctx = this.ctx;
    const bufLen = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);
    src.start(at);
  }

  /** Talking Drum: pitch-bending sine */
  playTalkingDrum(at = 0) {
    const ctx = this.ctx;
    const startFreq = 300 + Math.random() * 200;
    const endFreq   = startFreq * (Math.random() > 0.5 ? 0.5 : 1.8);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, at);
    osc.frequency.exponentialRampToValueAtTime(endFreq, at + 0.2);
    osc.start(at);
    osc.stop(at + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.22);

    // Slight distortion for warmth
    const wave = ctx.createWaveShaper();
    wave.curve = this._makeDistortionCurve(15);
    osc.connect(wave);
    wave.connect(gain);
    gain.connect(this.masterGain);

    // Reverb
    const rvGain = ctx.createGain();
    rvGain.gain.value = 0.3;
    gain.connect(rvGain);
    rvGain.connect(this.reverb);
  }

  _makeDistortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // ─────────────────────────────────────────────
  //  FEEDBACK SOUNDS (called on player input)
  // ─────────────────────────────────────────────

  playHitFeedback(lane, quality) {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;

    // Perfect: bright sparkle
    if (quality === 'perfect') {
      const freq = [880, 1100, 1320, 1760, 2200][lane];
      const osc  = this.ctx.createOscillator();
      osc.type   = 'sine';
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, at + 0.08);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.3, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(at); osc.stop(at + 0.08);
    }
    // Good: softer confirm
    else if (quality === 'good') {
      const freq = [660, 880, 990, 1320, 1760][lane];
      const osc  = this.ctx.createOscillator();
      osc.type   = 'triangle';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(at); osc.stop(at + 0.06);
    }
    // OK: muted
    else if (quality === 'ok') {
      const osc = this.ctx.createOscillator();
      osc.type  = 'square';
      osc.frequency.value = 300;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(at); osc.stop(at + 0.04);
    }
  }

  playMissFeedback() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    const bufLen = Math.floor(this.ctx.sampleRate * 0.06);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
    src.connect(lp); lp.connect(g); g.connect(this.masterGain);
    src.start(at);
  }

  playCrowdCheer() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    // Layered noise bands for crowd sound
    for (let i = 0; i < 3; i++) {
      const bufLen = Math.floor(this.ctx.sampleRate * 0.8);
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) data[j] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800 + i * 400;
      bp.Q.value = 0.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.15, at + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.8);
      src.connect(bp); bp.connect(g); g.connect(this.masterGain);
      src.start(at + i * 0.05);
    }
  }
}
