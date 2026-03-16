// ══════════════════════════════════════════════
//  BANGER — Game Configuration
// ══════════════════════════════════════════════

export const LANE_COUNT = 5;

export const LANES = [
  { key: 'KeyA',  label: 'A',   name: 'Drum',         color: 0xff3333, hexStr: '#ff3333', x: -4.4 },
  { key: 'KeyS',  label: 'S',   name: 'Bass',         color: 0x33ff88, hexStr: '#33ff88', x: -2.2 },
  { key: 'KeyD',  label: 'D',   name: 'Guitar',       color: 0x2979ff, hexStr: '#2979ff', x:  0.0 },
  { key: 'KeyF',  label: 'F',   name: 'Shaker',       color: 0xffcc00, hexStr: '#ffcc00', x:  2.2 },
  { key: 'Space', label: 'SPC', name: 'Talking Drum', color: 0xff44ff, hexStr: '#ff44ff', x:  4.4 },
];

// ── 3D Scene
export const CAMERA_POS   = { x: 0, y: 14, z: 12 };
export const CAMERA_LOOK  = { x: 0, y: 0, z: 0 };
export const HIT_ZONE_Z   = 0;    // where notes sit in depth
export const HIT_ZONE_Y   = 0;    // where notes should be hit (vertical)
export const SPAWN_Z      = 0;    // where notes appear (depth)
export const SPAWN_Y      = 14;   // where notes appear (vertical/top)
export const NOTE_SPEED   = 10;   // units/second (toward hit zone)
export const LOOK_AHEAD   = Math.abs(SPAWN_Y - HIT_ZONE_Y) / NOTE_SPEED + 0.05; // seconds

// ── Timing Windows (seconds)
export const TIMING = {
  perfect: 0.055,
  good:    0.110,
  ok:      0.175,
  miss:    0.230,
};

// ── Scoring
export const SCORE_VALUES = {
  perfect: 300,
  good:    150,
  ok:       50,
  miss:      0,
};

export const COMBO_THRESHOLDS = [
  { combo: 50, mult: 8 },
  { combo: 25, mult: 4 },
  { combo: 10, mult: 2 },
  { combo:  0, mult: 1 },
];

export const MISS_DAMAGE  = 12;
export const HIT_HEAL     = 3;
export const MAX_HEALTH   = 100;
export const DEATH_HEALTH = 0;

// ── Judge Display Colors
export const JUDGE_STYLES = {
  perfect: { text: '🔥 PERFECT!',  color: '#ffd600' },
  good:    { text: '✨ GOOD',       color: '#00e676' },
  ok:      { text: 'OK',            color: '#40c4ff' },
  miss:    { text: 'MISS',          color: '#ff1744' },
};

// ── Note shapes per lane (Three.js geometry types)
export const NOTE_SHAPES = ['box', 'cylinder', 'octahedron', 'sphere', 'torus'];

// ── Tutorial speeds
export const TUTORIAL_NOTE_SPEED = 4.5; // very slow demo notes
export const TUTORIAL_LANE_SPEED = 6;   // slightly faster for all-lanes practice

// ── Song BPM / data
export const SONG_BPM = 105;
export const SONG_DURATION = 120; // seconds
