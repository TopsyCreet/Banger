// ══════════════════════════════════════════════
//  BANGER — Note Manager
//  Spawns, updates, and manages 3D note objects
// ══════════════════════════════════════════════

import * as THREE from 'three';
import { LANES, HIT_ZONE_Z, SPAWN_Z, NOTE_SPEED, TIMING, NOTE_SHAPES } from './config.js';

const LOOK_AHEAD_SEC = Math.abs(SPAWN_Z - HIT_ZONE_Z) / NOTE_SPEED + 0.2;
const DESPAWN_PAST   = 0.3;  // seconds past hit zone before removal

// ── Per-lane geometry factories
function makeNoteGeometry(laneIdx) {
  switch (NOTE_SHAPES[laneIdx]) {
    case 'box':         return new THREE.BoxGeometry(0.8, 0.8, 0.8);
    case 'cylinder':    return new THREE.CylinderGeometry(0.45, 0.45, 0.9, 10);
    case 'octahedron':  return new THREE.OctahedronGeometry(0.55);
    case 'sphere':      return new THREE.SphereGeometry(0.45, 10, 8);
    case 'torus':       return new THREE.TorusGeometry(0.38, 0.15, 8, 20);
    default:            return new THREE.BoxGeometry(0.8, 0.8, 0.8);
  }
}

class NoteObject {
  constructor(scene, lane, beatTime) {
    this.lane     = lane;
    this.beatTime = beatTime;
    this.hit      = false;
    this.missed   = false;

    const color = LANES[lane].color;

    // Main body
    const geo = makeNoteGeometry(lane);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Glow halo (billboard quad)
    const haloGeo = new THREE.PlaneGeometry(1.8, 1.8);
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.halo = new THREE.Mesh(haloGeo, haloMat);
    scene.add(this.halo);

    this._scene = scene;
    this._mat   = mat;
    this._haloMat = haloMat;
    this._geo   = geo;
    this._haloGeo = haloGeo;
    this._rotSpeed = (Math.random() - 0.5) * 4;
  }

  update(currentTime, camera, dt) {
    const timeDiff = this.beatTime - currentTime;
    const z = HIT_ZONE_Z - timeDiff * NOTE_SPEED;
    const x = LANES[this.lane].x;

    this.mesh.position.set(x, 0.5, z);
    this.halo.position.set(x, 0.5, z);
    this.halo.lookAt(camera.position);

    // Spin
    this.mesh.rotation.x += this._rotSpeed * dt;
    this.mesh.rotation.y += this._rotSpeed * 0.7 * dt;

    // Scale pulse as note approaches hit zone (within last 0.5s)
    const approachFactor = Math.max(0, 1 - timeDiff / 0.5);
    const pulse = 1 + Math.sin(approachFactor * Math.PI) * 0.15;
    this.mesh.scale.setScalar(pulse);
    this.halo.scale.setScalar(pulse * 1.5);

    // Brighten emissive as it arrives
    this._mat.emissiveIntensity = 0.7 + approachFactor * 0.8;
    this._haloMat.opacity = 0.18 + approachFactor * 0.3;
  }

  /** Visual feedback on hit */
  onHit(quality) {
    this.hit = true;
    const scale = quality === 'perfect' ? 2.0 : quality === 'good' ? 1.5 : 1.2;
    this.mesh.scale.setScalar(scale);
    this._mat.emissiveIntensity = 3.0;
    this._mat.opacity = 0;
    this._haloMat.opacity = 0;
  }

  /** Visual feedback on miss */
  onMiss() {
    this.missed = true;
    this._mat.color.setHex(0x333333);
    this._mat.emissive.setHex(0x110000);
    this._mat.emissiveIntensity = 0.1;
    this._haloMat.opacity = 0;
  }

  remove() {
    this._scene.remove(this.mesh);
    this._scene.remove(this.halo);
    this._geo.dispose();
    this._mat.dispose();
    this._haloGeo.dispose();
    this._haloMat.dispose();
  }
}

export class NoteManager {
  constructor(scene) {
    this.scene    = scene;
    this.notes    = [];   // all NoteObjects currently in scene
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

  update(currentTime, camera, dt) {
    // ── Spawn upcoming notes
    while (
      this.spawnIdx < this.beatmap.length &&
      this.beatmap[this.spawnIdx].time <= currentTime + LOOK_AHEAD_SEC
    ) {
      const beat = this.beatmap[this.spawnIdx];
      if (beat.time >= currentTime - 0.1) {  // don't spawn already-past notes
        const note = new NoteObject(this.scene, beat.lane, beat.time);
        this.notes.push(note);
      }
      this.spawnIdx++;
    }

    // ── Update positions
    const toRemove = [];
    for (const note of this.notes) {
      if (!note.hit && !note.missed) {
        note.update(currentTime, camera, dt);

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
