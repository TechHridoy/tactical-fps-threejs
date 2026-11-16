// Ember Yard — an original 40 x 30 m tactical map. Three lanes (West, Mid,
// East) run from the Ember spawn in the south to the Tide spawn in the north.
// Site A sits west, Site B east; standing in a site captures it. Cover is
// crates, pillars and low walls, so no lane is a single open sightline.
// Plain box geometry only, no models and no textures.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

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

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }
  const colliders = [];
  const shootables = [];
  const obstacles = []; // 2D footprints for minimap + bot steering
  function box(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
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

  // Ground + perimeter (40 x 30, walls 4.6 m).
  floorBox(40.4, 0.4, 30.4, 0, -0.2, 0, 'surface');
  box(0.4, 4.6, 30.4, -20.2, 2.3, 0, 'slate');
  box(0.4, 4.6, 30.4, 20.2, 2.3, 0, 'slate');
  box(40.4, 4.6, 0.4, 0, 2.3, -15.2, 'slate');
  box(40.4, 4.6, 0.4, 0, 2.3, 15.2, 'slate');

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

  // Site A (west, foundry): tall crates + a low platform.
  box(2.4, 2.2, 1.4, -17.5, 1.1, -9, 'brick');
  box(1.4, 1.1, 1.4, -13, 0.55, -11.5, 'sand');
  box(1.4, 1.1, 1.4, -13, 0.55, -6.5, 'sand');
  floorBox(5, 0.5, 5, -15, 0.25, -9, 'hairline');
  // Site B (east, garden): planters + crates.
  box(2.4, 2.2, 1.4, 17.5, 1.1, -9, 'leaf');
  box(1.4, 1.1, 1.4, 13, 0.55, -11.5, 'sand');
  box(1.4, 1.1, 1.4, 13, 0.55, -6.5, 'sand');
  floorBox(5, 0.5, 5, 15, 0.25, -9, 'hairline');

  // Spawn cover + scattered crates so spawns are not fishbowls.
  box(2.4, 1.0, 1.2, -4, 0.5, 9.5, 'hairline');
  box(2.4, 1.0, 1.2, 4, 0.5, 9.5, 'hairline');
  box(2.4, 1.0, 1.2, -4, 0.5, -9.5, 'hairline');
  box(2.4, 1.0, 1.2, 4, 0.5, -9.5, 'hairline');
  box(1.2, 1.6, 1.2, -11, 0.8, 8.5, 'sand');
  box(1.2, 1.6, 1.2, 11, 0.8, 8.5, 'sand');
  box(1.2, 1.6, 1.2, -11, 0.8, -4, 'sand');
  box(1.2, 1.6, 1.2, 11, 0.8, -4, 'sand');

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

  // Sky: warm dusk. One key light with shadows, one cool fill.
  scene.background = new THREE.Color(0x1a2028);
  scene.fog = new THREE.Fog(new THREE.Color(0x1a2028), 26, 62);
  const sky = new THREE.HemisphereLight(new THREE.Color(0x8a94a8), new THREE.Color(0x2a2118), 1.15);
  scene.add(sky);
  const key = new THREE.DirectionalLight(new THREE.Color(0xffd9a0), 2.2);
  key.position.set(12, 18, 10);
  key.target.position.set(0, 0, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -24; key.shadow.camera.right = 24;
  key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
  key.shadow.camera.far = 60; key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(0x7fb8c9), 0.5);
  fill.position.set(-10, 10, -12);
  scene.add(fill);

  // 2D blocked test for bots (x,z + radius, player-height band).
  function blockedAt(x, z, r) {
    for (const c of colliders) {
      if (c.max.y < 0.3) continue; // floor / low pads
      if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) return true;
    }
    return false;
  }

  return { colliders, shootables, group, obstacles, blockedAt };
}
