// Gunfire effects — tracers and hit sparks. Both are pooled so firing
// never allocates in a hot loop: a tracer is a stretched additive box
// that fades in ~70 ms, a spark burst is a small Points cloud that pops
// and falls for ~0.35 s. No textures are fetched; sparks use a soft
// canvas glow sprite made at load.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

const TRACER_POOL = 24;
const SPARK_POOL = 8;
const SPARKS_PER_BURST = 14;

export function createEffects(scene) {
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), tracerMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let tracerNext = 0;

  const sparkTex = glowTexture('rgba(255,220,150,1)', 'rgba(255,160,60,0)');
  const sparks = [];
  for (let i = 0; i < SPARK_POOL; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS_PER_BURST * 3), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, map: sparkTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc860,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);
    sparks.push({ points, life: 0, vel: new Float32Array(SPARKS_PER_BURST * 3) });
  }
  let sparkNext = 0;
  const up = new THREE.Vector3(0, 1, 0);

  function spawnTracer(from, to) {
    const slot = tracers[tracerNext];
    tracerNext = (tracerNext + 1) % TRACER_POOL;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.5) return;
    slot.mesh.position.copy(from).addScaledVector(dir, 0.5);
    slot.mesh.lookAt(to);
    slot.mesh.scale.set(1, 1, len);
    slot.mesh.material.opacity = 0.85;
    slot.mesh.visible = true;
    slot.life = 0.07;
  }

  function spawnSparks(at, normal = up) {
    const slot = sparks[sparkNext];
    sparkNext = (sparkNext + 1) % SPARK_POOL;
    const pos = slot.points.geometry.attributes.position.array;
    const n = normal.clone().normalize();
    for (let i = 0; i < SPARKS_PER_BURST; i += 1) {
      pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
      // Fan out around the surface normal with a random cone.
      const rx = (Math.random() - 0.5) * 2;
      const ry = Math.random() * 1.2;
      const rz = (Math.random() - 0.5) * 2;
      const v = new THREE.Vector3(rx, ry, rz).addScaledVector(n, 1.6);
      slot.vel[i * 3] = v.x * 2.2;
      slot.vel[i * 3 + 1] = v.y * 2.2;
      slot.vel[i * 3 + 2] = v.z * 2.2;
    }
    slot.points.geometry.attributes.position.needsUpdate = true;
    slot.points.material.opacity = 1;
    slot.points.visible = true;
    slot.life = 0.35;
  }

  function update(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const pos = s.points.geometry.attributes.position.array;
      for (let i = 0; i < SPARKS_PER_BURST; i += 1) {
        s.vel[i * 3 + 1] -= 9 * dt;
        pos[i * 3] += s.vel[i * 3] * dt;
        pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
      }
      s.points.geometry.attributes.position.needsUpdate = true;
      s.points.material.opacity = Math.max(0, s.life / 0.35);
      if (s.life <= 0) s.points.visible = false;
    }
  }

  return { spawnTracer, spawnSparks, update };
}
