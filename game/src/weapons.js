// Emberline armoury — four original weapons. Accuracy counts more than
// speed: moving widens spread, standing still tightens it, and the sniper
// punishes a miss with a long cycle time. Prices are the buy-menu economy.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  sparrow: {
    id: 'sparrow', name: 'P-9 Sparrow', kind: 'Pistol', price: 0,
    damage: 26, headMul: 3.2, mag: 12, reserve: 48, fireGap: 0.16,
    reloadTime: 1.3, spreadStill: 0.003, spreadMove: 0.02, auto: false, range: 60,
  },
  wasp: {
    id: 'wasp', name: 'K-7 Wasp', kind: 'SMG', price: 900,
    damage: 19, headMul: 2.8, mag: 28, reserve: 84, fireGap: 0.085,
    reloadTime: 1.7, spreadStill: 0.006, spreadMove: 0.03, auto: true, range: 55,
  },
  longbow: {
    id: 'longbow', name: 'AR-77 Longbow', kind: 'Rifle', price: 2200,
    damage: 34, headMul: 3.0, mag: 30, reserve: 90, fireGap: 0.105,
    reloadTime: 1.9, spreadStill: 0.0022, spreadMove: 0.028, auto: true, range: 80,
  },
  horizon: {
    id: 'horizon', name: 'L-88 Horizon', kind: 'Sniper', price: 3200,
    damage: 88, headMul: 1.9, mag: 5, reserve: 15, fireGap: 1.15,
    reloadTime: 2.6, spreadStill: 0.0006, spreadMove: 0.05, auto: false, range: 90,
  },
};
export const WEAPON_ORDER = ['sparrow', 'wasp', 'longbow', 'horizon'];

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.2 });

  const model = new THREE.Group();
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  let def = WEAPONS.longbow;
  const state = { mag: def.mag, reserve: def.reserve, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, id: def.id };
  let aiming = false;
  let aimBlend = 0;
  let walkCycle = 0;
  // Hip and aim-down-sights viewmodel anchors; ADS centres the weapon and
  // pulls it closer so the sight line sits on the crosshair.
  const HIP_POS = { x: 0.24, y: -0.2, z: -0.42 };
  const ADS_POS = { x: 0, y: -0.135, z: -0.3 };

  function rebuildModel() {
    while (model.children.length) model.remove(model.children[0]);
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      model.add(m);
      return m;
    };
    if (def.id === 'sparrow') {
      add(new THREE.BoxGeometry(0.07, 0.09, 0.26), bodyMat, 0, 0, -0.1);
      add(new THREE.BoxGeometry(0.06, 0.12, 0.08), grip, 0, -0.08, 0.06);
    } else if (def.id === 'wasp') {
      add(new THREE.BoxGeometry(0.08, 0.09, 0.34), bodyMat, 0, 0, -0.08);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.3), grip, 0, 0.02, -0.3);
      add(new THREE.BoxGeometry(0.06, 0.14, 0.07), grip, 0, -0.09, 0.05);
      add(new THREE.BoxGeometry(0.03, 0.03, 0.12), accentMat, 0, 0.05, -0.2);
    } else if (def.id === 'horizon') {
      add(new THREE.BoxGeometry(0.08, 0.1, 0.5), bodyMat, 0, 0, -0.12);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), grip, 0, 0.04, -0.42).rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.06, 0.06, 0.16), accentMat, 0, 0.06, -0.05);
      add(new THREE.BoxGeometry(0.07, 0.09, 0.2), grip, 0, -0.02, 0.28);
    } else {
      add(new THREE.BoxGeometry(0.09, 0.1, 0.42), bodyMat, 0, 0, 0);
      add(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip, 0, 0.025, -0.38);
      add(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip, 0, -0.02, 0.3);
      add(new THREE.BoxGeometry(0.03, 0.04, 0.14), accentMat, 0, 0.055, -0.12);
    }
  }
  rebuildModel();

  function step(dt, speed = 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    // ADS blend: snappy in, a touch slower out.
    aimBlend += ((aiming ? 1 : 0) - aimBlend) * Math.min(1, dt * (aiming ? 14 : 9));
    // Walk sway: the viewmodel bobs and sways with the player's stride.
    walkCycle += dt * (2 + speed * 1.7);
    const sway = Math.min(1, speed / 5.2) * (1 - aimBlend * 0.85);
    const bobY = Math.sin(walkCycle * 2) * 0.008 * sway;
    const bobX = Math.cos(walkCycle) * 0.006 * sway;
    model.position.x = HIP_POS.x + (ADS_POS.x - HIP_POS.x) * aimBlend + bobX;
    model.position.y = HIP_POS.y + (ADS_POS.y - HIP_POS.y) * aimBlend + bobY;
    model.position.z = HIP_POS.z + (ADS_POS.z - HIP_POS.z) * aimBlend + state.kick;
    model.rotation.x = state.kick * 2.2;
    model.rotation.z = bobX * 0.9;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def.reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = def.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    state, def: () => def,
    step,
    setAiming(v) { aiming = !!v; },
    isAiming() { return aimBlend > 0.5; },
    aimBlend() { return aimBlend; },
    ready() { return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    pullTrigger() { state.cooldown = def.fireGap; state.flash = 0.06; state.kick = def.id === 'horizon' ? 0.12 : 0.055; },
    takeRound() { if (state.mag <= 0) return false; state.mag -= 1; return true; },
    reload() {
      if (state.reloadLeft > 0 || state.mag === def.mag || state.reserve === 0) return false;
      state.reloadLeft = def.reloadTime; return true;
    },
    spread(speed) { return def.spreadStill + Math.min(1, speed / 5.2) * def.spreadMove; },
    refill() { state.mag = def.mag; state.reserve = def.reserve; state.cooldown = 0; state.reloadLeft = 0; state.flash = 0; state.kick = 0; },
    equip(id, keepAmmo = false) {
      if (!WEAPONS[id]) return false;
      def = WEAPONS[id];
      state.id = id;
      if (!keepAmmo) { state.mag = def.mag; state.reserve = def.reserve; }
      state.cooldown = 0; state.reloadLeft = 0;
      rebuildModel();
      return true;
    },
  };
}
