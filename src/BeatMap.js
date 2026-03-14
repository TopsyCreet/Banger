// ══════════════════════════════════════════════
//  BANGER — Beat Map Generator
//  Generates procedural Afrobeats note patterns
// ══════════════════════════════════════════════

import { SONG_BPM, SONG_DURATION } from './config.js';

/**
 * A note event: { time (seconds), lane (0-4) }
 */

const SIXTEENTH = 60 / (SONG_BPM * 4);   // duration of 1 sixteenth note
const BAR       = SIXTEENTH * 16;         // 1 bar duration

// ── Base 2-bar patterns (indices 0-31, each = 1 sixteenth note)
// Lane 0: Drum / Kick
// Lane 1: Bass
// Lane 2: Guitar
// Lane 3: Shaker
// Lane 4: Talking Drum

const PATTERNS = {
  easy: {
    0: [0, 8, 16, 24],                                  // Kick: straight 4/4
    1: [4, 12, 20, 28],                                 // Bass: off-beats
    2: [2, 10, 18, 26],                                 // Guitar: off-8ths
    3: [0, 4, 8, 12, 16, 20, 24, 28],                   // Shaker: every beat
    4: [3, 11, 19, 27],                                 // Talking drum: syncopated
  },
  normal: {
    0: [0, 5, 8, 13, 16, 21, 24, 29],                   // Kick: Afrobeats pattern
    1: [4, 6, 12, 14, 20, 22, 28, 30],                  // Bass: rapid off-beats
    2: [2, 7, 10, 15, 18, 23, 26, 31],                  // Guitar: varied
    3: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], // Shaker: 8ths
    4: [3, 7, 9, 13, 17, 21, 25, 29],                   // Talking drum: syncopated
  },
  hard: {
    0: [0, 3, 5, 8, 11, 13, 16, 19, 21, 24, 27, 29],
    1: [1, 4, 6, 9, 12, 14, 17, 20, 22, 25, 28, 30],
    2: [2, 5, 7, 10, 13, 15, 18, 21, 23, 26, 29, 31],
    3: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    4: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31],
  },
};

// Variation: drop a few notes from base pattern, or add extra fill notes
const FILLS = {
  // Extra notes added at key musical moments (bar 8, 16 etc.)
  drumFill:  [0, 2, 4, 6, 8, 10, 12, 14],  // 8th-note drum fill
  brassBuild: [1, 5, 9, 13],
};

/**
 * Generate full beat map for a song
 * @param {string} difficulty  'easy' | 'normal' | 'hard'
 * @returns {Array<{time: number, lane: number}>} sorted by time
 */
export function generateBeatMap(difficulty = 'normal') {
  const pattern = PATTERNS[difficulty] || PATTERNS.normal;
  const patternBars = 2;  // our pattern is 2 bars long
  const patternDuration = BAR * patternBars;
  const notes = [];

  const totalBars = Math.floor(SONG_DURATION / BAR);

  // Leave 3 seconds of intro silence
  const introOffset = 3.0;

  for (let bar = 0; bar < totalBars; bar++) {
    const barTime = introOffset + bar * BAR;
    const patternPos = bar % patternBars;  // 0 or 1
    const noteOffset = patternPos * 16;    // which 16 of the 32 we're in

    // Determine if this bar gets a fill (every 8th bar, last bar of phrase)
    const isFillBar = (bar % 8 === 7);

    for (let lane = 0; lane < 5; lane++) {
      // Skip some lanes in easy intros (gradual introduction)
      if (difficulty === 'easy' && bar < 4 && lane > 2) continue;
      if (difficulty === 'normal' && bar < 2 && lane === 4) continue;

      // Drum fill override
      if (isFillBar && lane === 0) {
        for (const idx of FILLS.drumFill) {
          if (idx < 16) {
            notes.push({ time: barTime + idx * SIXTEENTH, lane });
          }
        }
        continue;
      }

      // Normal pattern
      for (const idx of pattern[lane]) {
        const localIdx = idx - noteOffset;
        if (localIdx >= 0 && localIdx < 16) {
          const time = barTime + localIdx * SIXTEENTH;
          // Tiny humanization (±3ms) to feel natural
          const humanize = (Math.random() - 0.5) * 0.006;
          notes.push({ time: time + humanize, lane });
        }
      }
    }
  }

  // Sort by time
  notes.sort((a, b) => a.time - b.time);
  return notes;
}

/**
 * Get scheduled audio beat times for the AudioEngine
 * (just the kick/bass pattern, separate from gameplay notes)
 */
export function generateAudioSchedule(difficulty = 'normal') {
  return generateBeatMap(difficulty);
}
