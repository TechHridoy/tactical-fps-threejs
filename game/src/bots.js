// Bots — 4 Ember teammates and 5 Tide enemies. Each bot has a body mesh
// (torso/head/gun, team-coloured), health, a weapon, and a simple brain:
// walk to its objective, stop and shoot when it sees an enemy, strafe while
// firing, fall back when hurt, and regroup at its site when it has none.
// No pathfinding library: waypoint steering + a sidestep when a wall blocks.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { EMBER_SPAWN, TIDE_SPAWN, SITES, WAYPOINTS } from './world.js';

const EMBER_NAMES = ['Ash', 'Bramble', 'Cinder', 'Flint'];
const TIDE_NAMES = ['Riptide', 'Kelpie', 'Marlin', 'Undine', 'Coral'];

function makeBody(team) {
  const colour = team === 'ember' ? PALETTE.ember : PALETTE.tide;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.6, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xc9a37e), roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.78, 0.32), bodyMat);
  torso.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skinMat);
  head.position.y = 1.56;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), darkMat);
  helmet.position.y = 1.58;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), darkMat);
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), darkMat);
  gun.position.set(0.28, 1.08, -0.25);
  group.add(torso, head, helmet, legL, legR, gun);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  // Floating health bar (two thin planes, billboarded in step()).
  const bar = new THREE.Group();
  bar.position.y = 1.92;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.09), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour), depthWrite: false }));
  fg.position.z = 0.001;
  bar.add(bg, fg);
  group.add(bar);
  torso.userData.part = 'torso';
  head.userData.part = 'head';
  return { group, torso, head, bar, fg };
}

export function createBots(scene, world) {
  const bots = [];
  const hitMeshes = [];
  function addBot(team, name, spawn, weaponId) {
    const body = makeBody(team);
    body.group.position.set(spawn[0], 0, spawn[1]);
    scene.add(body.group);
    const bot = {
      team, name, weapon: WEAPONS[weaponId],
      pos: body.group.position, yaw: team === 'ember' ? Math.PI : 0,
      health: 100, alive: true, fall: 0,
      group: body.group, torso: body.torso, head: body.head, bar: body.bar, barFg: body.fg,
      speed: 3.1 + Math.random() * 0.7,
      site: Math.random() < 0.5 ? SITES.A : SITES.B,
      waypoint: null, strafeDir: 1, strafeAt: 0,
      shootAt: 0, burstLeft: 0, burstAt: 0, thinkAt: 0, target: null,
      home: new THREE.Vector3(spawn[0], 0, spawn[1]),
    };
    body.torso.userData.bot = bot;
    body.head.userData.bot = bot;
    hitMeshes.push(body.torso, body.head);
    bots.push(bot);
    return bot;
  }
  EMBER_NAMES.forEach((n, i) => addBot('ember', n, EMBER_SPAWN[i], WEAPON_ORDER[1 + (i % 3)]));
  TIDE_NAMES.forEach((n, i) => addBot('tide', n, TIDE_SPAWN[i], i === 0 ? 'horizon' : WEAPON_ORDER[1 + (i % 3)]));

  function reset() {
    for (const bot of bots) {
      const spawn = bot.team === 'ember' ? EMBER_SPAWN[bots.filter((b) => b.team === 'ember').indexOf(bot)] : TIDE_SPAWN[bots.filter((b) => b.team === 'tide').indexOf(bot)];
      bot.pos.set(spawn[0], 0, spawn[1]);
      bot.health = 100; bot.alive = true; bot.fall = 0;
      bot.group.rotation.set(0, bot.team === 'ember' ? Math.PI : 0, 0);
      bot.group.visible = true;
      bot.yaw = bot.team === 'ember' ? Math.PI : 0;
      bot.site = Math.random() < 0.5 ? SITES.A : SITES.B;
      bot.waypoint = null; bot.target = null; bot.shootAt = 0; bot.burstLeft = 0;
      bot.barFg.scale.x = 1;
      bot.barFg.position.x = 0;
    }
  }

  function nearestWaypoint(from, to) {
    let best = null; let bestD = Infinity;
    for (const w of WAYPOINTS) {
      const d = (w[0] - to.x) ** 2 + (w[1] - to.z) ** 2 + (w[0] - from.x) ** 2 * 0.1 + (w[1] - from.z) ** 2 * 0.1;
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }

  // ctx: { dt, time, camera, player:{pos,alive,health}, hasLOS(from,to),
  //        damageBot(bot,amount,attackerName,part), damagePlayer(amount,attackerName),
  //        onBotShot(bot), aliveOf(team) }
  function step(ctx) {
    for (const bot of bots) {
      if (!bot.alive) {
        bot.fall = Math.min(1, bot.fall + ctx.dt / 0.4);
        bot.group.rotation.x = -bot.fall * 1.45;
        continue;
      }
      bot.group.rotation.x = 0;
      // --- pick a target: nearest living enemy with line of sight, <= 30 m
      bot.thinkAt -= ctx.dt;
      if (bot.thinkAt <= 0) {
        bot.thinkAt = 0.25;
        bot.target = null;
        const foes = [];
        if (ctx.player.alive && bot.team === 'tide') foes.push({ kind: 'player', pos: ctx.player.pos, dist: bot.pos.distanceTo(ctx.player.pos) });
        for (const other of bots) {
          if (other.team === bot.team || !other.alive) continue;
          foes.push({ kind: 'bot', bot: other, pos: other.pos, dist: bot.pos.distanceTo(other.pos) });
        }
        foes.sort((a, b) => a.dist - b.dist);
        for (const foe of foes) {
          if (foe.dist > 30) break;
          const from = new THREE.Vector3(bot.pos.x, 1.5, bot.pos.z);
          const to = new THREE.Vector3(foe.pos.x, 1.3, foe.pos.z);
          if (ctx.hasLOS(from, to)) {
            // Reaction delay: a bot that just spotted someone does not
            // fire instantly — that is what keeps rounds from ending in seconds.
            // Compare by identity, not by the fresh foe object built each tick.
            const key = foe.kind === 'player' ? 'player' : `bot:${foe.bot.name}`;
            if (bot.targetKey !== key) { bot.aimAt = ctx.time + 0.45; bot.targetKey = key; }
            bot.target = foe;
            break;
          }
        }
      }
      // --- combat
      if (bot.target) {
        const t = bot.target.pos;
        const dx = t.x - bot.pos.x; const dz = t.z - bot.pos.z;
        bot.yaw = Math.atan2(dx, dz);
        // Strafe sideways, flip direction every ~1.2 s.
        if (ctx.time > bot.strafeAt) { bot.strafeDir *= -1; bot.strafeAt = ctx.time + 0.9 + Math.random() * 0.8; }
        const sx = Math.cos(bot.yaw) * bot.strafeDir; const sz = -Math.sin(bot.yaw) * bot.strafeDir;
        const nx = bot.pos.x + sx * bot.speed * 0.45 * ctx.dt;
        const nz = bot.pos.z + sz * bot.speed * 0.45 * ctx.dt;
        if (!world.blockedAt(nx, nz, 0.4)) { bot.pos.x = nx; bot.pos.z = nz; }
        // Fire in short bursts, only after the reaction delay.
        if (ctx.time >= bot.shootAt && ctx.time >= (bot.aimAt || 0)) {
          bot.burstLeft = bot.weapon.id === 'horizon' ? 1 : 2 + Math.floor(Math.random() * 2);
          bot.shootAt = ctx.time + (bot.weapon.id === 'horizon' ? 2.0 : 1.1) + Math.random() * 0.9;
          bot.burstAt = ctx.time;
        }
        if (bot.burstLeft > 0 && ctx.time >= bot.burstAt && ctx.time >= (bot.aimAt || 0)) {
          bot.burstLeft -= 1;
          bot.burstAt = ctx.time + bot.weapon.fireGap * 2.2;
          ctx.onBotShot(bot);
          const dist = bot.pos.distanceTo(t);
          const p = Math.max(0.05, Math.min(0.32, 0.36 - dist * 0.009 - (bot.weapon.id === 'horizon' ? -0.06 : 0)));
          if (Math.random() < p) {
            const head = Math.random() < 0.12;
            const dmg = Math.round(bot.weapon.damage * (head ? bot.weapon.headMul : 1) * (dist > 20 ? 0.8 : 1));
            if (bot.target.kind === 'player') ctx.damagePlayer(dmg, bot.name);
            else ctx.damageBot(bot.target.bot, dmg, bot.name, head ? 'head' : 'torso');
          }
        }
      } else {
        // --- move to objective: Ember attacks a site, Tide holds one / patrols Mid
        const goal = bot.team === 'ember'
          ? { x: bot.site.x + (Math.random() < 0.3 ? 2 : 0), z: bot.site.z }
          : (bot.health < 45 ? { x: bot.site.x, z: bot.site.z } : { x: (bot.site.x + 0) / 2, z: -4 });
        if (!bot.waypoint || Math.hypot(bot.waypoint[0] - bot.pos.x, bot.waypoint[1] - bot.pos.z) < 1.2) {
          bot.waypoint = nearestWaypoint(bot.pos, goal);
          // If already close to the goal, walk straight at it.
          if (Math.hypot(goal.x - bot.pos.x, goal.z - bot.pos.z) < 4) bot.waypoint = [goal.x, goal.z];
        }
        const wx = bot.waypoint[0] - bot.pos.x; const wz = bot.waypoint[1] - bot.pos.z;
        const len = Math.hypot(wx, wz) || 1;
        const stepLen = bot.speed * ctx.dt;
        let nx = bot.pos.x + (wx / len) * stepLen;
        let nz = bot.pos.z + (wz / len) * stepLen;
        if (world.blockedAt(nx, nz, 0.4)) {
          // Sidestep: try 45° left, then 45° right.
          const a = Math.atan2(wz, wx);
          let moved = false;
          for (const off of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
            const tx = bot.pos.x + Math.cos(a + off) * stepLen;
            const tz = bot.pos.z + Math.sin(a + off) * stepLen;
            if (!world.blockedAt(tx, tz, 0.4)) { nx = tx; nz = tz; moved = true; break; }
          }
          if (!moved) bot.waypoint = null;
        }
        bot.pos.x = Math.max(-19.4, Math.min(19.4, nx));
        bot.pos.z = Math.max(-14.4, Math.min(14.4, nz));
        bot.yaw = Math.atan2(wx, wz);
        // Separation from other bots.
        for (const other of bots) {
          if (other === bot || !other.alive) continue;
          const ddx = bot.pos.x - other.pos.x; const ddz = bot.pos.z - other.pos.z;
          const d = Math.hypot(ddx, ddz);
          if (d > 0.01 && d < 0.9) { bot.pos.x += (ddx / d) * 0.5 * ctx.dt; bot.pos.z += (ddz / d) * 0.5 * ctx.dt; }
        }
      }
      bot.group.position.set(bot.pos.x, 0, bot.pos.z);
      bot.group.rotation.y = bot.yaw;
      // Health bar faces the camera, shrinks with health.
      bot.bar.quaternion.copy(ctx.camera.quaternion);
      const frac = Math.max(0, bot.health / 100);
      bot.barFg.scale.x = frac;
      bot.barFg.position.x = -0.34 * (1 - frac);
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health > 0) return false;
    bot.health = 0; bot.alive = false; bot.fall = 0;
    return true;
  }

  return {
    bots, hitMeshes, reset, step, damage,
    aliveCount(team) { return bots.filter((b) => b.team === team && b.alive).length; },
  };
}
