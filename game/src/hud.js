// Emberline DOM HUD. It never touches the simulation; main.js pushes
// numbers in and reads the play / buy callbacks out.
import { WEAPONS, WEAPON_ORDER } from './weapons.js';

const COPY = {
  start: { title: 'EMBERLINE', copy: 'Ember Yard — 5v5 tactical FPS. Eliminate Tide, or capture Site A or Site B. Buy between rounds. Click to play.', action: 'Click to play' },
  paused: { title: 'EMBERLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  end: { title: 'Match over', copy: '', action: 'Play again' },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), title = $('overlay-title'), copy = $('overlay-copy'), play = $('play');
  const ammoMag = $('ammo-mag'), ammoReserve = $('ammo-reserve'), weaponName = $('weapon-name');
  const healthFill = $('health-fill'), healthNum = $('health-num'), moneyVal = $('money-val');
  const timerVal = $('timer-val'), roundVal = $('round-val'), emberScore = $('score-ember'), tideScore = $('score-tide');
  const hitmarker = $('hitmarker'), killfeed = $('killfeed'), banner = $('banner'), bannerTitle = $('banner-title'), bannerSub = $('banner-sub');
  const buyMenu = $('buy-menu'), buyGrid = $('buy-grid'), damage = $('damage');
  const captureWrap = $('capture'), captureFill = $('capture-fill'), captureLabel = $('capture-label');
  const minimap = $('minimap');
  const crosshair = $('crosshair');
  const crossArms = crosshair ? crosshair.querySelectorAll('i') : [];
  let hitTimer = 0, bannerTimer = 0, damageTimer = 0;
  let last = {};

  function setText(el, key, value) {
    if (!el || last[key] === value) return;
    last[key] = value; el.textContent = value;
  }

  // Build buy-menu cards once.
  if (buyGrid) {
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'buy-card'; card.dataset.weapon = id;
      card.innerHTML = `<b>${w.name}</b><span>${w.kind} · ${w.damage} dmg · ${w.mag} rnd</span><em>$${w.price}</em>`;
      card.addEventListener('click', () => buyHandler && buyHandler(id));
      buyGrid.appendChild(card);
    }
  }
  let buyHandler = null;

  return {
    // Crosshair spread: the four arms open up with movement and firing, and
    // close down to a tight dot while aiming. gap is in px from centre.
    setCrosshair(gap, aiming = false) {
      if (!crosshair || crossArms.length < 4) return;
      const g = Math.max(2, Math.min(18, gap));
      crossArms[0].style.top = `${11 - g - 7}px`;
      crossArms[1].style.top = `${11 + g}px`;
      crossArms[2].style.left = `${11 - g - 7}px`;
      crossArms[3].style.left = `${11 + g}px`;
      crosshair.style.opacity = aiming ? '0.4' : '0.85';
    },
    setHealth(hp) {
      setText(healthNum, 'hp', String(Math.max(0, Math.round(hp))));
      if (healthFill) healthFill.style.width = `${Math.max(0, hp)}%`;
      if (healthFill) healthFill.style.background = hp > 50 ? '#7dd87d' : hp > 25 ? '#f0a830' : '#e5484d';
    },
    setMoney(m) { setText(moneyVal, 'money', `$${m}`); },
    setAmmo(mag, reserve, name) {
      setText(ammoMag, 'mag', String(mag));
      setText(ammoReserve, 'res', `/ ${reserve}`);
      if (name) setText(weaponName, 'wname', name);
      const ammo = $('ammo');
      if (ammo) ammo.classList.toggle('empty', mag === 0);
    },
    setTimer(sec) {
      const s = Math.max(0, Math.ceil(sec));
      setText(timerVal, 'timer', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    },
    setScore(ember, tide, round, phase) {
      setText(emberScore, 'es', String(ember));
      setText(tideScore, 'ts', String(tide));
      setText(roundVal, 'round', `Round ${round}${phase ? ` · ${phase}` : ''}`);
    },
    hitMarker(killed, holdMs = 90) {
      if (!hitmarker) return;
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.3)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { hitmarker.classList.remove('on'); hitmarker.style.transform = ''; }, holdMs);
    },
    damageFlash() {
      if (!damage) return;
      damage.classList.add('on');
      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => damage.classList.remove('on'), 220);
    },
    killfeed(text) {
      if (!killfeed) return;
      const line = document.createElement('div');
      line.textContent = text;
      killfeed.prepend(line);
      while (killfeed.children.length > 5) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    banner(text, sub = '', ms = 2600) {
      if (!banner) return;
      bannerTitle.textContent = text; bannerSub.textContent = sub;
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { banner.hidden = true; }, ms);
    },
    showBuy(open, money, ownedId) {
      if (!buyMenu) return;
      buyMenu.hidden = !open;
      if (open) {
        for (const card of buyGrid.children) {
          const w = WEAPONS[card.dataset.weapon];
          card.classList.toggle('owned', card.dataset.weapon === ownedId);
          card.classList.toggle('cant', money < w.price && card.dataset.weapon !== ownedId);
        }
      }
    },
    capture(frac, siteName) {
      if (!captureWrap) return;
      captureWrap.hidden = frac <= 0;
      if (frac > 0) {
        captureFill.style.width = `${Math.round(frac * 100)}%`;
        captureLabel.textContent = `Capturing ${siteName}…`;
      }
    },
    drawMinimap(world, playerPos, bots, sites) {
      if (!minimap) return;
      const ctx = minimap.getContext('2d');
      if (!ctx) return;
      const W = minimap.width, H = minimap.height;
      const sx = (x) => ((x + 20) / 40) * W;
      const sz = (z) => ((z + 15) / 30) * H;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(20,22,26,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3a4550';
      for (const o of world.obstacles) ctx.fillRect(sx(o.x), sz(o.z), Math.max(1, (o.w / 40) * W), Math.max(1, (o.d / 30) * H));
      for (const s of Object.values(sites)) {
        ctx.strokeStyle = '#f0a830'; ctx.beginPath(); ctx.arc(sx(s.x), sz(s.z), 5, 0, Math.PI * 2); ctx.stroke();
      }
      const dot = (x, z, colour, r) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(sx(x), sz(z), r, 0, Math.PI * 2); ctx.fill(); };
      for (const b of bots) if (b.alive) dot(b.pos.x, b.pos.z, b.team === 'ember' ? '#f0a830' : '#2ec4b6', 3);
      if (playerPos) dot(playerPos.x, playerPos.z, '#ffffff', 4);
    },
    showOverlay(mode, scoreText = '') {
      const text = COPY[mode];
      if (!overlay) return;
      title.textContent = text.title;
      copy.textContent = mode === 'end' ? scoreText : text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { if (overlay) overlay.hidden = true; },
    onPlay(handler) { if (play) play.addEventListener('click', handler); },
    onBuy(handler) { buyHandler = handler; },
    onDeploy(handler) { const d = $('deploy'); if (d) d.addEventListener('click', handler); },
  };
}
