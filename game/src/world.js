// Ember Yard — an original 40 x 30 m tactical map. Three lanes (West, Mid,
// East) run from the Ember spawn in the south to the Tide spawn in the north.
// Site A sits west, Site B east; standing in a site captures it. Cover is
// crates, pillars and low walls, so no lane is a single open sightline.
// Surfaces are canvas-painted procedural textures (see textures.js): cracked
// concrete, brushed rust-streaked metal, planked wood and barrel steel.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { concreteTexture, metalTexture, woodTexture, barrelTexture, decalTexture, glowTexture } from './textures.js';

export const MAP = { w: 40, d: 30, halfW: 20, halfD: 15 };
export const EMBER_SPAWN = [
  [-6, 12.5], [-2, 13], [2, 13], [6, 12.5], [0, 11],
];
export const TIDE_SPAWN = [
  [-6, -12.5], [-2, -13], [2, -13], [6, -12.5], [0, -11],
];
export const SITES = {
  A: { name: 'Site A — Foundry', x: -15, z: -9, r: 3.2 },
  B: { name: 'Site B — Garden', x: 15, z: -9, r: 3.2 },
};
// Waypoints bots walk between (x, z). A loose graph across lanes and sites.
export const WAYPOINTS = [
  [-16, 12], [-8, 12], [0, 12], [8, 12], [16, 12],
  [-16, 6], [-8, 6], [0, 6], [8, 6], [16, 6],
  [-16, 0], [-8, 0], [0, 0], [8, 0], [16, 0],
  [-16, -6], [-8, -6], [0, -6], [8, -6], [16, -6],
  [-15, -9], [15, -9], [-8, -11], [8, -11], [0, -12],
  [-16, -12], [16, -12], [0, 9], [-4, -3], [4, -3],
];

const SUN_DIR = new THREE.Vector3(0.45, 0.62, 0.38).normalize();

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials: every flat colour from the old map is replaced by a
  // painted texture. Roughness stays high on concrete/wood, low on metal.
  const materials = {
    surface: new THREE.MeshStandardMaterial({ map: concreteTexture(7), roughness: 0.96, metalness: 0.02 }),
    slate: new THREE.MeshStandardMaterial({ map: metalTexture(21, '#39424d'), roughness: 0.62, metalness: 0.45 }),
    brick: new THREE.MeshStandardMaterial({ map: metalTexture(33, '#6b4034'), roughness: 0.7, metalness: 0.25 }),
    sand: new THREE.MeshStandardMaterial({ map: concreteTexture(11), roughness: 0.95, metalness: 0.02 }),
    hairline: new THREE.MeshStandardMaterial({ map: metalTexture(55, '#272d35'), roughness: 0.55, metalness: 0.5 }),
    leaf: new THREE.MeshStandardMaterial({ map: metalTexture(77, '#42563f'), roughness: 0.8, metalness: 0.1 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture(42), roughness: 0.88, metalness: 0.02 }),
    woodDark: new THREE.MeshStandardMaterial({ map: woodTexture(64, '#5d4527'), roughness: 0.9, metalness: 0.02 }),
    barrel: new THREE.MeshStandardMaterial({ map: barrelTexture(99), roughness: 0.55, metalness: 0.55 }),
    accent: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.15 }),
    ink: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6, metalness: 0.1 }),
  };

  const colliders = [];
  const shootables = [];
  const obstacles = []; // 2D footprints for minimap + bot steering
  function box(w, h, d, x, y, z, material, rotY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    obstacles.push({ x: x - w / 2, z: z - d / 2, w, d });
    return mesh;
  }
  function floorBox(w, h, d, x, y, z, material) {
    // Walkable / decorative, not a wall collider for bots' 2D test.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    shootables.push(mesh);
    return mesh;
  }
  function trimBox(w, h, d, x, y, z, material) {
    // Decorative edge trim only: no collider, no minimap footprint.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function barrel(x, z) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.15, 18), materials.barrel);
    mesh.position.set(x, 0.575, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    obstacles.push({ x: x - 0.55, z: z - 0.55, w: 1.1, d: 1.1 });
    return mesh;
  }
  function decal(kind, text, w, x, y, z, rotY = 0) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w),
      new THREE.MeshBasicMaterial({ map: decalTexture(kind, text), transparent: true, opacity: 0.85, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Ground + perimeter (40 x 30, walls 4.6 m).
  floorBox(40.4, 0.4, 30.4, 0, -0.2, 0, 'surface');
  box(0.4, 4.6, 30.4, -20.2, 2.3, 0, 'slate');
  box(0.4, 4.6, 30.4, 20.2, 2.3, 0, 'slate');
  box(40.4, 4.6, 0.4, 0, 2.3, -15.2, 'slate');
  box(40.4, 4.6, 0.4, 0, 2.3, 15.2, 'slate');
  // Amber edge trim along the top of the perimeter walls.
  trimBox(0.5, 0.14, 30.4, -20.2, 4.66, 0, 'accent');
  trimBox(0.5, 0.14, 30.4, 20.2, 4.66, 0, 'accent');
  trimBox(40.4, 0.14, 0.5, 0, 4.66, -15.2, 'accent');
  trimBox(40.4, 0.14, 0.5, 0, 4.66, 15.2, 'accent');

  // Mid divider walls with gaps — three lanes, not one open field.
  box(0.6, 3.4, 9, -7, 1.7, 2, 'brick');
  box(0.6, 3.4, 9, 7, 1.7, 2, 'brick');
  box(0.6, 3.4, 8, -7, 1.7, -8, 'brick');
  box(0.6, 3.4, 8, 7, 1.7, -8, 'brick');

  // Central pillar + low cover in Mid.
  box(2.2, 3.6, 2.2, 0, 1.8, 0, 'sand');
  box(3.2, 1.1, 1.2, -3.4, 0.55, 3.2, 'hairline');
  box(3.2, 1.1, 1.2, 3.4, 0.55, -3.2, 'hairline');
  box(1.6, 0.9, 1.6, -11, 0.45, 0, 'sand');
  box(1.6, 0.9, 1.6, 11, 0.45, 0, 'sand');

  // Site A (west, foundry): tall crates + a low platform, barrels stacked in.
  box(2.4, 2.2, 1.4, -17.5, 1.1, -9, 'wood');
  box(1.8, 1.8, 1.2, -17.2, 3.1, -9, 'woodDark', 0.12);
  box(1.4, 1.1, 1.4, -13, 0.55, -11.5, 'wood');
  box(1.4, 1.1, 1.4, -13, 0.55, -6.5, 'wood');
  barrel(-16.2, -6.2);
  barrel(-13.8, -12.4);
  floorBox(5, 0.5, 5, -15, 0.25, -9, 'hairline');
  // Site B (east, garden): planters + crates.
  box(2.4, 2.2, 1.4, 17.5, 1.1, -9, 'wood');
  box(1.8, 1.8, 1.2, 17.2, 3.1, -9, 'woodDark', -0.1);
  box(1.4, 1.1, 1.4, 13, 0.55, -11.5, 'wood');
  box(1.4, 1.1, 1.4, 13, 0.55, -6.5, 'wood');
  barrel(16.2, -6.2);
  barrel(13.8, -12.4);
  floorBox(5, 0.5, 5, 15, 0.25, -9, 'hairline');

  // Spawn cover + scattered crates so spawns are not fishbowls.
  // Sizes vary now: a tall pair, a low pair and two mid crates per half.
  box(2.4, 1.0, 1.2, -4, 0.5, 9.5, 'hairline');
  box(2.4, 1.0, 1.2, 4, 0.5, 9.5, 'hairline');
  box(2.4, 1.0, 1.2, -4, 0.5, -9.5, 'hairline');
  box(2.4, 1.0, 1.2, 4, 0.5, -9.5, 'hairline');
  box(1.2, 1.6, 1.2, -11, 0.8, 8.5, 'wood');
  box(1.2, 1.6, 1.2, 11, 0.8, 8.5, 'wood');
  box(1.2, 1.6, 1.2, -11, 0.8, -4, 'wood');
  box(1.2, 1.6, 1.2, 11, 0.8, -4, 'wood');
  box(0.9, 2.4, 0.9, -14.5, 1.2, 3.5, 'woodDark', 0.2);
  box(0.9, 2.4, 0.9, 14.5, 1.2, 3.5, 'woodDark', -0.18);
  box(1.9, 0.7, 1.1, -1.5, 0.35, -6.5, 'wood', 0.08);
  box(1.9, 0.7, 1.1, 1.5, 0.35, 6.5, 'wood', -0.06);
  barrel(-8.5, 10.8);
  barrel(8.5, -10.8);

  // Floor decals: site letters, hazard chevrons at the site mouths, and
  // lane arrows pointing up-map toward the Tide side.
  decal('letter', 'A', 2.4, -15, 0.52, -9);
  decal('letter', 'B', 2.4, 15, 0.52, -9);
  decal('hazard', '', 3.4, -11.5, 0.03, -5.2);
  decal('hazard', '', 3.4, 11.5, 0.03, -5.2);
  decal('arrow', '', 1.8, -7, 0.03, 6, Math.PI);
  decal('arrow', '', 1.8, 7, 0.03, 6, Math.PI);
  decal('arrow', '', 1.8, 0, 0.03, -12, Math.PI);

  // Site marker rings (flat, glowing) — visible objective, no collider.
  for (const site of Object.values(SITES)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.r - 0.35, site.r, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.06, site.z);
    group.add(ring);
  }

  // --- sky: a gradient dome (dusk amber at the horizon, deep blue above)
  // with a warm glow around the sun, plus a soft sun-glare sprite.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x1c2b45) },
      mid: { value: new THREE.Color(0xa8703f) },
      low: { value: new THREE.Color(0x2a2118) },
      sunDir: { value: SUN_DIR },
      sunCol: { value: new THREE.Color(0xffc070) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      uniform vec3 sunDir; uniform vec3 sunCol;
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.75, h))
                            : mix(low, mid, smoothstep(-0.08, 0.12, h));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 18.0);
        float halo = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 3.0);
        col += sunCol * (sun * 0.9 + halo * 0.22);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 24, 16), skyMat);
  scene.add(sky);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glare.position.copy(SUN_DIR).multiplyScalar(95);
  glare.scale.set(34, 34, 1);
  scene.add(glare);

  // Lighting: warm directional sun with real 2048 shadows, hemisphere +
  // cool fill, and a long dusk fog so the far wall melts into the sky.
  scene.background = new THREE.Color(0x1a2028);
  scene.fog = new THREE.Fog(new THREE.Color(0x2a2118), 26, 78);
  const hemi = new THREE.HemisphereLight(new THREE.Color(0x8a94a8), new THREE.Color(0x2a2118), 1.45);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(new THREE.Color(0xffd9a0), 2.7);
  key.position.copy(SUN_DIR).multiplyScalar(26);
  key.target.position.set(0, 0, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -24; key.shadow.camera.right = 24;
  key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
  key.shadow.camera.far = 70; key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(0x7fb8c9), 0.5);
  fill.position.set(-10, 10, -12);
  scene.add(fill);
  // Warm bounce light from the foundry side so Site A reads hot.
  const bounce = new THREE.PointLight(new THREE.Color(0xff9a40), 12, 18, 1.6);
  bounce.position.set(-15, 2.5, -9);
  scene.add(bounce);

  // --- dust motes drifting in the light, so the air has depth.
  const DUST_N = 260;
  const dustPos = new Float32Array(DUST_N * 3);
  const dustPhase = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i += 1) {
    dustPos[i * 3] = (Math.random() - 0.5) * 38;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 5.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    dustPhase[i] = Math.random() * Math.PI * 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.05, color: 0xffd9a0, transparent: true, opacity: 0.32,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  function update(dt, time) {
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST_N; i += 1) {
      pos[i * 3 + 1] -= dt * 0.12;
      pos[i * 3] += Math.sin(time * 0.4 + dustPhase[i]) * dt * 0.08;
      if (pos[i * 3 + 1] < 0.2) pos[i * 3 + 1] = 5.8;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  // 2D blocked test for bots (x,z + radius, player-height band).
  function blockedAt(x, z, r) {
    for (const c of colliders) {
      if (c.max.y < 0.3) continue; // floor / low pads
      if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) return true;
    }
    return false;
  }

  return { colliders, shootables, group, obstacles, blockedAt, update };
}
