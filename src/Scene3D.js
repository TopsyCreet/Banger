// ══════════════════════════════════════════════
//  BANGER — Three.js Scene
//  Lagos-themed 3D rhythm highway
// ══════════════════════════════════════════════

import * as THREE from 'three';
import { LANES, CAMERA_POS, CAMERA_LOOK, HIT_ZONE_Z, SPAWN_Z } from './config.js';

export class Scene3D {
  constructor(canvas) {
    this.canvas   = canvas;
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;

    this._hitRings     = [];
    this._laneLines    = [];
    this._stars        = null;
    this._buildings    = [];
    this._pulseTime    = 0;
    this._beatPulse    = 0;  // 0→1 beat flash strength

    this._clock = new THREE.Clock();
  }

  init() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    // ── Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // ── Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030509);
    this.scene.fog = new THREE.FogExp2(0x030509, 0.018);

    // ── Camera
    this.camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 200);
    this.camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
    this.camera.lookAt(CAMERA_LOOK.x, CAMERA_LOOK.y, CAMERA_LOOK.z);

    // ── Lighting
    this._buildLighting();

    // ── World
    this._buildHighway();
    this._buildHitZone();
    this._buildSkyline();
    this._buildStars();
    this._buildAtmosphere();

    // ── Resize
    window.addEventListener('resize', () => this._onResize());
  }

  // ─────────────────────────────────────────────
  //  LIGHTING
  // ─────────────────────────────────────────────

  _buildLighting() {
    // Ambient: very dim purple-blue night
    const ambient = new THREE.AmbientLight(0x1a0a2e, 0.8);
    this.scene.add(ambient);

    // Directional: moonlight
    const moon = new THREE.DirectionalLight(0x4466cc, 0.6);
    moon.position.set(5, 20, 5);
    this.scene.add(moon);

    // Lane colored point lights at hit zone
    LANES.forEach((lane, i) => {
      const light = new THREE.PointLight(lane.color, 0.8, 10);
      light.position.set(lane.x, 1.5, HIT_ZONE_Z);
      this.scene.add(light);
      lane._light = light;
    });
  }

  // ─────────────────────────────────────────────
  //  HIGHWAY
  // ─────────────────────────────────────────────

  _buildHighway() {
    const roadLen = 80;

    // Road surface
    const roadGeo = new THREE.PlaneGeometry(13, roadLen);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      roughness: 0.9,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.02, HIT_ZONE_Z - roadLen / 2 + 5);
    road.receiveShadow = true;
    this.scene.add(road);

    // Lane dividers (glowing lines)
    LANES.forEach((lane, i) => {
      const lineGeo = new THREE.PlaneGeometry(0.06, roadLen);
      const lineMat = new THREE.MeshBasicMaterial({
        color: lane.color,
        transparent: true,
        opacity: 0.25,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(lane.x, 0.01, HIT_ZONE_Z - roadLen / 2 + 5);
      this.scene.add(line);
      this._laneLines.push({ mesh: line, mat: lineMat, baseOpacity: 0.25 });
    });

    // Lane borders (outer edges)
    [-6, 6].forEach(x => {
      const edgeGeo = new THREE.PlaneGeometry(0.08, roadLen);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: 0x334466,
        transparent: true,
        opacity: 0.5,
      });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.01, HIT_ZONE_Z - roadLen / 2 + 5);
      this.scene.add(edge);
    });

    // Dashed center-line markers (road depth cues)
    for (let z = HIT_ZONE_Z - 2; z > SPAWN_Z; z -= 5) {
      const dashGeo = new THREE.PlaneGeometry(0.05, 1.5);
      const dashMat = new THREE.MeshBasicMaterial({
        color: 0x334466,
        transparent: true,
        opacity: 0.3,
      });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.015, z);
      this.scene.add(dash);
    }
  }

  // ─────────────────────────────────────────────
  //  HIT ZONE
  // ─────────────────────────────────────────────

  _buildHitZone() {
    LANES.forEach((lane, i) => {
      // Glowing platform pad
      const padGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.06, 16);
      const padMat = new THREE.MeshStandardMaterial({
        color: lane.color,
        emissive: lane.color,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.6,
        roughness: 0.3,
        metalness: 0.8,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(lane.x, 0, HIT_ZONE_Z);
      this.scene.add(pad);

      // Outer ring glow
      const ringGeo = new THREE.TorusGeometry(0.82, 0.05, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: lane.color,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(lane.x, 0.04, HIT_ZONE_Z);
      this.scene.add(ring);

      this._hitRings.push({ pad, padMat, ring, ringMat, lane: i, pulse: 0 });
    });

    // "PERFECT ZONE" line
    const lineGeo = new THREE.PlaneGeometry(14, 0.04);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
    });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, HIT_ZONE_Z);
    this.scene.add(line);
  }

  // ─────────────────────────────────────────────
  //  SKYLINE (Lagos silhouette)
  // ─────────────────────────────────────────────

  _buildSkyline() {
    const buildingProfiles = [
      { x: -18, h: 12, w: 2.5 }, { x: -14, h: 18, w: 3 }, { x: -10, h: 8,  w: 2 },
      { x: -6,  h: 22, w: 3.5 }, { x: -2,  h: 15, w: 2.5 }, { x:  2, h: 25, w: 4 },
      { x:  6,  h: 11, w: 2  }, { x:  10, h: 19, w: 3 },  { x:  14, h: 9,  w: 2 },
      { x:  18, h: 14, w: 2.5 },
    ];

    buildingProfiles.forEach(({ x, h, w }) => {
      const geo  = new THREE.BoxGeometry(w, h, w * 0.8);
      const mat  = new THREE.MeshStandardMaterial({
        color: 0x0d1a2e,
        emissive: 0x0a1020,
        roughness: 1,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, h / 2 - 0.5, -55);
      this.scene.add(mesh);
      this._buildings.push(mesh);

      // Random lit windows
      const winCount = Math.floor(Math.random() * 6 + 3);
      for (let w2 = 0; w2 < winCount; w2++) {
        const winGeo = new THREE.PlaneGeometry(0.3, 0.4);
        const winMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xffcc66 : 0x66ccff,
          transparent: true,
          opacity: Math.random() * 0.6 + 0.2,
        });
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(
          x + (Math.random() - 0.5) * (w - 0.5),
          Math.random() * (h - 2) - h / 2 + 1,
          -55 + w * 0.4 + 0.05
        );
        this.scene.add(win);
      }
    });
  }

  // ─────────────────────────────────────────────
  //  STARS
  // ─────────────────────────────────────────────

  _buildStars() {
    const count = 600;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = Math.random() * 60 + 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.2,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    this._stars = new THREE.Points(geo, mat);
    this.scene.add(this._stars);
  }

  // ─────────────────────────────────────────────
  //  ATMOSPHERE EFFECTS
  // ─────────────────────────────────────────────

  _buildAtmosphere() {
    // Neon ground glow planes per lane
    LANES.forEach(lane => {
      const glowGeo = new THREE.PlaneGeometry(1.8, 80);
      const glowMat = new THREE.MeshBasicMaterial({
        color: lane.color,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(lane.x, 0.03, HIT_ZONE_Z - 35);
      this.scene.add(glow);
    });
  }

  // ─────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────

  /** Call when player hits a note on a lane — flashes the hit ring */
  flashLane(laneIdx) {
    const ring = this._hitRings[laneIdx];
    if (ring) ring.pulse = 1.0;
  }

  /** Beat pulse — called by Game on strong beats */
  onBeat(strength = 1) {
    this._beatPulse = strength;
  }

  update(dt) {
    this._pulseTime += dt;

    // ── Animate hit rings
    this._hitRings.forEach(r => {
      if (r.pulse > 0) {
        r.pulse -= dt * 6;
        r.pulse = Math.max(0, r.pulse);
      }
      const glow = 0.4 + r.pulse * 1.6;
      r.padMat.emissiveIntensity = glow;
      r.ringMat.opacity = 0.5 + r.pulse * 0.5;
      // Scale ring on pulse
      const s = 1 + r.pulse * 0.3;
      r.ring.scale.setScalar(s);
    });

    // ── Beat pulse (camera shake + fog)
    if (this._beatPulse > 0) {
      this._beatPulse -= dt * 8;
      this._beatPulse = Math.max(0, this._beatPulse);
      const shake = this._beatPulse * 0.03;
      this.camera.position.x = CAMERA_POS.x + (Math.random() - 0.5) * shake;
      this.camera.position.y = CAMERA_POS.y + (Math.random() - 0.5) * shake * 0.5;
    } else {
      // Ease back
      this.camera.position.x += (CAMERA_POS.x - this.camera.position.x) * 0.1;
      this.camera.position.y += (CAMERA_POS.y - this.camera.position.y) * 0.1;
    }

    // ── Stars slow rotation
    if (this._stars) {
      this._stars.rotation.y = this._pulseTime * 0.005;
    }

    // ── Lane line breathe
    this._laneLines.forEach(ll => {
      ll.mat.opacity = ll.baseOpacity + Math.sin(this._pulseTime * 1.5) * 0.05;
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  dispose() {
    this.renderer.dispose();
  }
}
