// Emberline — 5v5 round-based tactical FPS on Ember Yard.
// Boot + fixed 60 Hz simulation feeding a render at the display rate.
// ?shot=start|play|end with &seed=N sets up a deterministic frame for a
// capture, renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES, EMBER_SPAWN } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';

const FIXED_STEP = 1 / 60;
const WIN_ROUNDS = 5;
const MAX_ROUNDS = 9;
const ROUND_TIME = 100;
const BUY_TIME = 15;
const ROUND_END_TIME = 4;
const CAPTURE_TIME = 4;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Filmic tone mapping: the dusk sun and amber glare roll off instead of
// clipping, and the shadows keep their depth.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 26, 62);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const bots = createBots(scene, world);
const weapon = createWeapon(camera);
const hud = createHud();
const audio = createAudio();
const effects = createEffects(scene);
const player = createPlayer(world.colliders);
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const losRay = new THREE.Raycaster();
const direction = new THREE.Vector3();
const body = player.state;

const game = {
  phase: 'buy', phaseT: BUY_TIME, round: 1,
  ember: 0, tide: 0, money: 800,
  health: 100, alive: true, kills: 0, deaths: 0,
  capture: { site: null, team: null, progress: 0 },
  buyOpen: false, captureTickAt: 0, owned: 'sparrow',
};
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let prevFiring = false;
let matchOver = false;
let shake = 0; // camera shake from firing, decays fast
const BASE_FOV = 74;
const ADS_FOV = 55;

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  // Shake is a small random offset on top of the player's aim, never a
  // change to the aim itself — it settles back to zero on its own.
  const sh = shake * 0.02;
  camera.rotation.set(
    body.pitch + (Math.random() - 0.5) * sh,
    body.yaw + (Math.random() - 0.5) * sh,
    0, 'YXZ');
}
function syncHud() {
  hud.setHealth(game.health);
  hud.setMoney(game.money);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def().name);
  hud.setTimer(game.phase === 'buy' || game.phase === 'live' ? game.phaseT : 0);
  hud.setScore(game.ember, game.tide, game.round,
    game.phase === 'buy' ? 'BUY' : game.phase === 'live' ? 'LIVE' : game.phase === 'roundEnd' ? 'ROUND OVER' : 'MATCH OVER');
}
function startRound() {
  game.phase = 'buy'; game.phaseT = BUY_TIME;
  game.health = 100; game.alive = true;
  game.capture = { site: null, team: null, progress: 0 };
  bots.reset();
  body.position.set(EMBER_SPAWN[4][0], 0, EMBER_SPAWN[4][1]);
  body.velocity.set(0, 0, 0);
  body.yaw = 0; body.pitch = 0;
  weapon.equip(game.owned); // keep the weapon bought in an earlier round
  syncCamera(); syncHud();
  hud.showBuy(true, game.money, weapon.state.id);
  game.buyOpen = true;
  hud.banner(`Round ${game.round}`, 'Buy phase — B to close, Deploy to start', 2200);
}
function startMatch() {
  game.ember = 0; game.tide = 0; game.round = 1; game.money = 800;
  game.kills = 0; game.deaths = 0; matchOver = false;
  startRound();
}
function deploy() {
  if (game.phase !== 'buy' || matchOver) return;
  game.phase = 'live'; game.phaseT = ROUND_TIME;
  game.buyOpen = false;
  hud.showBuy(false, game.money, weapon.state.id);
  audio.roundStart();
  hud.banner(`Round ${game.round} — go!`, 'Eliminate Tide or capture Site A / B', 1800);
  if (!shot) input.requestLock();
  syncHud();
}
function endRound(winner, reason) {
  if (game.phase !== 'live') return;
  game.phase = 'roundEnd'; game.phaseT = ROUND_END_TIME;
  game[winner] += 1;
  if (winner === 'ember') { game.money += 1000; audio.roundWin(); }
  else { game.money += 700; audio.roundLose(); }
  const title = winner === 'ember' ? 'Ember takes the round' : 'Tide takes the round';
  hud.banner(title, reason, 3200);
  hud.killfeed(`${title} — ${reason}`);
  syncHud();
}
function endMatch() {
  matchOver = true;
  game.phase = 'matchEnd';
  const emberWon = game.ember > game.tide;
  hud.showOverlay('end', `${emberWon ? 'Ember wins the match' : 'Tide wins the match'} — ${game.ember}–${game.tide}. You had ${game.kills} eliminations and ${game.deaths} deaths.`);
  if (document.pointerLockElement) document.exitPointerLock();
}
function hasLOS(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  if (dist < 0.01) return true;
  dir.normalize();
  losRay.set(from, dir);
  losRay.far = dist;
  const hit = losRay.intersectObjects(world.shootables, false)[0];
  return !hit || hit.distance > dist - 0.6;
}
function damagePlayer(amount, attacker) {
  if (!game.alive || game.phase !== 'live') return;
  game.health -= amount;
  hud.damageFlash();
  audio.hurt();
  if (game.health <= 0) {
    game.health = 0; game.alive = false; game.deaths += 1;
    hud.killfeed(`${attacker} (Tide) eliminated you`);
    hud.banner('You are down', 'Your team fights on', 2200);
  }
  syncHud();
}
function damageBot(bot, amount, attacker, part) {
  // The hit is stamped with where the shot came from, so the bot reacts.
  const from = attacker === 'You' ? body.position : (bots.bots.find((b) => b.name === attacker) || {}).pos || body.position;
  const killed = bots.damage(bot, amount, from);
  if (killed) {
    hud.killfeed(`${attacker} eliminated ${bot.name} (Tide)${part === 'head' ? ' — headshot' : ''}`);
    if (attacker === 'You') { game.money += 300; game.kills += 1; }
  }
  return killed;
}
function tryBuy(id) {
  const w = WEAPONS[id];
  if (!w) return;
  if (game.phase !== 'buy') { audio.deny(); return; }
  if (weapon.state.id === id) { audio.buy(); return; }
  if (game.money < w.price) { audio.deny(); hud.killfeed(`Not enough money for ${w.name} ($${w.price})`); return; }
  game.money -= w.price;
  game.owned = id;
  weapon.equip(id);
  audio.buy();
  hud.showBuy(true, game.money, id);
  syncHud();
}
function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}
function shoot(spread) {
  if (!weapon.takeRound()) { audio.deny(); return false; }
  audio.shot(weapon.state.id);
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(world.shootables.concat(bots.hitMeshes), false)[0];
  // Muzzle in world space, so the tracer starts at the gun, not the eye.
  const muzzle = camera.localToWorld(new THREE.Vector3(0.24, -0.18, -0.95));
  const end = hit ? hit.point : camera.position.clone().addScaledVector(direction, 60);
  effects.spawnTracer(muzzle, end);
  if (hit) {
    // Sparks where the round lands — on a bot or on the map.
    const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    effects.spawnSparks(hit.point, normal);
  }
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const part = hit.object.userData.part || 'torso';
    const dmg = Math.round(weapon.def().damage * (part === 'head' ? weapon.def().headMul : 1));
    const killed = damageBot(bot, dmg, 'You', part);
    hud.hitMarker(killed, shot ? 4000 : 90);
    if (killed) audio.kill(); else audio.hit();
  }
  weapon.pullTrigger();
  player.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  // Firing kicks the camera: a sharp shake that decays within a frame or two.
  shake = Math.min(0.6, shake + (weapon.state.id === 'horizon' ? 0.5 : 0.22));
  syncHud();
  return true;
}
function checkCapture(dt) {
  let best = null;
  for (const site of Object.values(SITES)) {
    let emberIn = 0; let tideIn = 0;
    if (game.alive && Math.hypot(body.position.x - site.x, body.position.z - site.z) < site.r) emberIn += 1;
    for (const b of bots.bots) {
      if (!b.alive) continue;
      if (Math.hypot(b.pos.x - site.x, b.pos.z - site.z) < site.r) {
        if (b.team === 'ember') emberIn += 1; else tideIn += 1;
      }
    }
    if (emberIn > 0 && tideIn === 0) best = { site, team: 'ember' };
    else if (tideIn > 0 && emberIn === 0) best = { site, team: 'tide' };
  }
  if (best) {
    if (game.capture.team !== best.team || game.capture.site !== best.site) game.capture = { site: best.site, team: best.team, progress: 0 };
    game.capture.progress += dt / CAPTURE_TIME;
    if (elapsed > game.captureTickAt) { audio.captureTick(); game.captureTickAt = elapsed + 0.5; }
    hud.capture(game.capture.progress, best.site.name);
    if (game.capture.progress >= 1) {
      hud.capture(0, '');
      endRound(best.team, `${best.team === 'ember' ? 'Ember' : 'Tide'} captured ${best.site.name}`);
    }
  } else {
    game.capture.progress = Math.max(0, game.capture.progress - dt / 2);
    hud.capture(game.capture.progress, game.capture.site ? game.capture.site.name : '');
    if (game.capture.progress === 0) game.capture = { site: null, team: null, progress: 0 };
  }
}
function step(dt) {
  elapsed += dt;
  if (game.phase === 'buy') {
    game.phaseT -= dt;
    player.step(dt, input.state.keys);
    weapon.step(dt, player.groundSpeed());
    if (game.phaseT <= 0) deploy();
  } else if (game.phase === 'live') {
    game.phaseT -= dt;
    if (game.alive) player.step(dt, input.state.keys);
    weapon.step(dt, player.groundSpeed());
    bots.step({
      dt, time: elapsed, camera,
      player: { pos: body.position, alive: game.alive, health: game.health },
      hasLOS,
      damageBot: (bot, amount, attacker, part) => {
        const killed = damageBot(bot, amount, attacker, part);
        if (killed) hud.killfeed(`${attacker} eliminated ${bot.name} (${bot.team === 'tide' ? 'Tide' : 'Ember'})`);
        return killed;
      },
      damagePlayer,
      onBotShot: (bot) => {
        audio.enemyShot();
        // A faint tracer from the firing bot toward what it shot at.
        const from = new THREE.Vector3(bot.pos.x, 1.3, bot.pos.z);
        from.x -= Math.sin(bot.yaw) * 0.3;
        from.z -= Math.cos(bot.yaw) * 0.3;
        const target = bot.target ? bot.target.pos : body.position;
        const to = new THREE.Vector3(target.x, 1.3, target.z);
        effects.spawnTracer(from, to);
      },
      aliveOf: (team) => bots.aliveCount(team),
    });
    checkCapture(dt);
    const emberAlive = bots.aliveCount('ember') + (game.alive ? 1 : 0);
    const tideAlive = bots.aliveCount('tide');
    if (tideAlive === 0) endRound('ember', 'Tide eliminated');
    else if (emberAlive === 0) endRound('tide', 'Ember eliminated');
    else if (game.phaseT <= 0) {
      if (emberAlive !== tideAlive) endRound(emberAlive > tideAlive ? 'ember' : 'tide', `Time — ${emberAlive} vs ${tideAlive} alive`);
      else {
        const emberHp = bots.bots.filter((b) => b.team === 'ember' && b.alive).reduce((s, b) => s + b.health, 0) + (game.alive ? game.health : 0);
        const tideHp = bots.bots.filter((b) => b.team === 'tide' && b.alive).reduce((s, b) => s + b.health, 0);
        endRound(emberHp >= tideHp ? 'ember' : 'tide', 'Time — decided on remaining health');
      }
    }
  } else if (game.phase === 'roundEnd') {
    game.phaseT -= dt;
    weapon.step(dt, player.groundSpeed());
    if (game.phaseT <= 0) {
      if (game.ember >= WIN_ROUNDS || game.tide >= WIN_ROUNDS || game.round >= MAX_ROUNDS) endMatch();
      else { game.round += 1; startRound(); }
    }
  }
  syncHud();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (game.alive && game.phase !== 'matchEnd') player.look(look.x, look.y);
    // Aim down sights: right mouse centres the weapon, tightens spread
    // and zooms the field of view in. It only applies while alive and live.
    const aiming = input.state.aiming && game.alive && game.phase === 'live';
    weapon.setAiming(aiming);
    const targetFov = aiming ? ADS_FOV : BASE_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
      camera.updateProjectionMatrix();
    }
    const firing = input.state.firing && game.phase === 'live' && game.alive && input.state.locked;
    const freshPress = firing && !prevFiring;
    prevFiring = input.state.firing;
    const aimSpread = aiming ? 0.45 : 1;
    if (firing && weapon.ready() && (weapon.def().auto || freshPress)) shoot(shot ? 0 : weapon.spread(player.groundSpeed()) * aimSpread);
    if (input.state.keys.has('KeyR') && weapon.reload()) audio.reload();
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) { step(FIXED_STEP); accumulator -= FIXED_STEP; steps += 1; }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    // Camera shake from firing decays in a few frames.
    shake *= Math.exp(-dt * 9);
    // Crosshair opens with movement and firing, closes while aiming.
    const spreadPx = 4 + weapon.spread(player.groundSpeed()) * aimSpread * 500 + (firing ? 3 : 0);
    hud.setCrosshair(spreadPx, aiming);
    effects.update(dt);
    world.update(dt, elapsed);
    syncCamera();
    hud.drawMinimap(world, body.position, bots.bots, SITES);
  }
  renderer.render(scene, camera);
}
function settle(steps) { for (let i = 0; i < steps; i += 1) step(FIXED_STEP); }

hud.onPlay(() => {
  audio.unlock();
  if (shot) return;
  if (matchOver) { startMatch(); hud.hideOverlay(); hud.showBuy(true, game.money, weapon.state.id); game.buyOpen = true; return; }
  if (game.phase === 'buy') { hud.hideOverlay(); hud.showBuy(true, game.money, weapon.state.id); game.buyOpen = true; return; }
  started = true;
  hud.hideOverlay();
  input.requestLock();
});
hud.onBuy((id) => tryBuy(id));
hud.onDeploy(() => deploy());
window.addEventListener('keydown', (event) => {
  if (game.phase !== 'buy') return;
  const map = { Digit1: 'sparrow', Digit2: 'wasp', Digit3: 'longbow', Digit4: 'horizon' };
  if (map[event.code]) tryBuy(map[event.code]);
  if (event.code === 'KeyB') {
    game.buyOpen = !game.buyOpen;
    hud.showBuy(game.buyOpen, game.money, weapon.state.id);
  }
});
function onLockChange(locked) {
  if (shot) return;
  if (locked) { started = true; hud.hideOverlay(); }
  else if (!matchOver && game.phase === 'live' && game.alive) hud.showOverlay('paused');
}
function runShot(name) {
  hud.hideOverlay();
  hud.showBuy(false, game.money, weapon.state.id);
  body.pitch = 0; body.yaw = 0;
  if (name === 'start') {
    startMatch();
    body.position.set(0.6, 0, 11.5);
    settle(10);
    aimAt(new THREE.Vector3(0, 1.5, -6));
    hud.showOverlay('start');
  } else if (name === 'play') {
    startMatch();
    game.phase = 'live'; game.phaseT = 75;
    game.money = 2200;
    weapon.equip('longbow');
    body.position.set(0, 0, 8);
    bots.bots[4].pos.set(-4, 0, 0);
    bots.bots[5].pos.set(4, 0, -2);
    bots.bots[0].pos.set(-2, 0, 6);
    settle(12);
    aimAt(new THREE.Vector3(bots.bots[4].pos.x, 1.3, bots.bots[4].pos.z));
    shoot(0);
    settle(6);
    aimAt(new THREE.Vector3(bots.bots[5].pos.x, 1.3, bots.bots[5].pos.z));
    syncHud();
  } else { // end
    startMatch();
    game.ember = 5; game.tide = 3; game.round = 8;
    game.phase = 'matchEnd'; matchOver = true;
    body.position.set(0, 0, 10);
    settle(10);
    aimAt(new THREE.Vector3(0, 1.5, -6));
    hud.banner('Ember wins the match', 'Ember Yard — 5–3', 4000);
    hud.showOverlay('end', 'Ember wins the match — 5–3. You had 7 eliminations and 2 deaths.');
    syncHud();
  }
  hud.showBuy(false, game.money, weapon.state.id);
  const bannerEl = document.getElementById('banner');
  if (name === 'start' && bannerEl) bannerEl.hidden = true;
  syncHud();
  paintTwiceThenReady();
}
function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) { window.__shotReady = true; frozen = true; }
  }
  requestAnimationFrame(paint);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startMatch();
syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
