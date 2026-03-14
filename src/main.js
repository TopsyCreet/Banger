// ══════════════════════════════════════════════
//  BANGER — Entry Point
// ══════════════════════════════════════════════

import { Game } from './Game.js';

const canvas = document.getElementById('game-canvas');
const game   = new Game(canvas);

game.init().catch(err => {
  console.error('BANGER failed to initialize:', err);
  document.body.innerHTML = `
    <div style="color:white;padding:2rem;font-family:sans-serif;text-align:center">
      <h1>Failed to start BANGER</h1>
      <p>${err.message}</p>
      <p>Make sure you're running this via <code>npm run dev</code></p>
    </div>
  `;
});
