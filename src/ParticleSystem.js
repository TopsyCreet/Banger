// ══════════════════════════════════════════════
//  BANGER — Particle System
//  Hit explosions, miss effects, combo trails
// ══════════════════════════════════════════════

import * as THREE from 'three';
import { LANES } from './config.js';

const POOL_SIZE = 300;

class Particle {
  constructor() {
    const geo = new THREE.SphereGeometry(0.06, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.active = false;
    this.life   = 0;
    this.maxLife = 0;
    this.vel    = new THREE.Vector3();
  }
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool  = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const p = new Particle();
      scene.add(p.mesh);
      this.pool.push(p);
    }
  }

  // ── Burst explosion on note hit
  burst(x, y, z, laneIdx, quality) {
    const color  = LANES[laneIdx].color;
    const count  = quality === 'perfect' ? 24 : quality === 'good' ? 14 : 8;
    const speed  = quality === 'perfect' ? 6  : quality === 'good' ? 4  : 2.5;
    const life   = quality === 'perfect' ? 0.7 : 0.45;

    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) continue;

      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      if (quality === 'perfect') {
        p.mesh.material.color.lerp(new THREE.Color(0xffffff), 0.5);
      }
      p.mesh.visible = true;
      p.active  = true;
      p.life    = life;
      p.maxLife = life;

      // Random spherical velocity
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      p.vel.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed * 0.6 + speed * 0.5,
        Math.cos(phi) * speed * 0.4,
      );
    }
  }

  // ── Ripple ring for miss
  ripple(x, y, z) {
    // Use a ring that expands — simulate with multiple particles
    for (let i = 0; i < 8; i++) {
      const p = this._getParticle();
      if (!p) continue;
      const angle = (i / 8) * Math.PI * 2;
      p.mesh.position.set(x + Math.cos(angle) * 0.3, y, z);
      p.mesh.material.color.setHex(0xff1744);
      p.mesh.visible = true;
      p.active  = true;
      p.life    = 0.35;
      p.maxLife = 0.35;
      p.vel.set(Math.cos(angle) * 3, 0.5, Math.sin(angle) * 1.5);
    }
  }

  // ── Combo trail sparkles (called when combo milestone hit)
  comboFlare(x, y, z, laneIdx) {
    const color = LANES[laneIdx].color;
    for (let i = 0; i < 12; i++) {
      const p = this._getParticle();
      if (!p) continue;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.visible = true;
      p.active  = true;
      p.life    = 1.0;
      p.maxLife = 1.0;
      const angle = (i / 12) * Math.PI * 2;
      p.vel.set(
        Math.cos(angle) * 5,
        Math.random() * 6 + 2,
        Math.sin(angle) * 2,
      );
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Move + gravity
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 12 * dt;  // gravity

      // Fade out
      const alpha = p.life / p.maxLife;
      p.mesh.scale.setScalar(alpha * 1.2 + 0.1);
    }
  }

  _getParticle() {
    return this.pool.find(p => !p.active) || null;
  }

  dispose() {
    this.pool.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
  }
}
