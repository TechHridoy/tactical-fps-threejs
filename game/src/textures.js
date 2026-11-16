// Procedural textures for Ember Yard — every surface is painted on a
// canvas at load time, so the game ships no external image assets and
// nothing is fetched over the network. One seeded generator per texture
// keeps the look stable between runs.
import * as THREE from 'three';

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(ctx, size, rand, n, colours, aMin, aMax, rMin, rMax) {
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = colours[Math.floor(rand() * colours.length)];
    ctx.globalAlpha = aMin + rand() * (aMax - aMin);
    const r = rMin + rand() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function crack(ctx, size, rand, x, y, length, angle) {
  ctx.strokeStyle = 'rgba(12,12,14,0.55)';
  ctx.lineWidth = 1 + rand() * 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let px = x; let py = y; let a = angle;
  const steps = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < steps; i += 1) {
    a += (rand() - 0.5) * 1.1;
    px += Math.cos(a) * (length / steps);
    py += Math.sin(a) * (length / steps);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Cracked, stained concrete for the ground: slab seams, grime patches,
// hairline cracks and pale wear where boots cross the lanes.
export function concreteTexture(seed = 7) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rand = mulberry32(seed);
  ctx.fillStyle = '#23272d';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 2600, ['#2b3038', '#1c1f24', '#33383f', '#3d4148'], 0.12, 0.4, 0.6, 2.6);
  // Slab seams every quarter.
  ctx.strokeStyle = 'rgba(10,10,12,0.6)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath(); ctx.moveTo((size / 4) * i, 0); ctx.lineTo((size / 4) * i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (size / 4) * i); ctx.lineTo(size, (size / 4) * i); ctx.stroke();
  }
  // Grime: dark blotches that pool near the seams.
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * size; const y = rand() * size; const r = 18 + rand() * 55;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(8,8,10,0.35)');
    g.addColorStop(1, 'rgba(8,8,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Pale wear along the main lane.
  ctx.fillStyle = 'rgba(200,190,170,0.06)';
  ctx.fillRect(size * 0.42, 0, size * 0.16, size);
  for (let i = 0; i < 9; i += 1) crack(ctx, size, rand, rand() * size, rand() * size, 40 + rand() * 90, rand() * Math.PI * 2);
  return toTexture(c, 6, 4);
}

// Brushed metal with rust streaks and scuffs, for walls and pillars.
export function metalTexture(seed = 21, base = '#39424d') {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rand = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Vertical brush lines.
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, 0, 1, size);
  }
  speckle(ctx, size, rand, 500, ['#4a5563', '#2c333c', '#525d6b'], 0.1, 0.3, 0.5, 1.8);
  // Rust weeping down from the top edge.
  for (let i = 0; i < 14; i += 1) {
    const x = rand() * size;
    const len = 20 + rand() * 90;
    const g = ctx.createLinearGradient(x, 0, x, len);
    g.addColorStop(0, 'rgba(122,74,58,0.5)');
    g.addColorStop(1, 'rgba(122,74,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rand() * 5, len);
  }
  // Rivets along the edges.
  ctx.fillStyle = 'rgba(220,225,230,0.35)';
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath(); ctx.arc(8 + i * 34, 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8 + i * 34, size - 10, 3, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c, 2, 1);
}

// Wooden crate: horizontal planks, grain, knots and a stencilled edge.
export function woodTexture(seed = 42, base = '#7a5c38') {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rand = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const plankH = size / 4;
  for (let p = 0; p < 4; p += 1) {
    const y0 = p * plankH;
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`;
    ctx.fillRect(0, y0, size, plankH);
    // Grain lines inside the plank.
    for (let i = 0; i < 9; i += 1) {
      ctx.strokeStyle = `rgba(40,24,10,${0.15 + rand() * 0.25})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gy = y0 + 4 + rand() * (plankH - 8);
      ctx.moveTo(0, gy);
      for (let x = 0; x <= size; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.05 + rand() * 4) * 2.5);
      ctx.stroke();
    }
    // Knot.
    if (rand() < 0.7) {
      const kx = 20 + rand() * (size - 40); const ky = y0 + plankH / 2;
      ctx.strokeStyle = 'rgba(40,24,10,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(kx, ky, 7, 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(kx, ky, 3, 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // Plank seam.
    ctx.strokeStyle = 'rgba(15,10,5,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(size, y0); ctx.stroke();
  }
  // Corner frame, like a nailed crate edge.
  ctx.strokeStyle = 'rgba(30,18,8,0.55)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  return toTexture(c, 1, 1);
}

// Painted barrel metal: horizontal bands and dents.
export function barrelTexture(seed = 99, base = '#5a3a2a') {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rand = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 700, ['#6b4632', '#4a2f22', '#7a5240'], 0.15, 0.4, 0.5, 2.2);
  for (const y of [size * 0.25, size * 0.72]) {
    ctx.fillStyle = 'rgba(15,10,8,0.65)';
    ctx.fillRect(0, y, size, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, y + 7, size, 2);
  }
  for (let i = 0; i < 6; i += 1) crack(ctx, size, rand, rand() * size, rand() * size, 18 + rand() * 30, rand() * Math.PI);
  return toTexture(c, 2, 1);
}

// A decal drawn on its own transparent canvas: hazard chevrons, a site
// letter, or a floor arrow. Returns a texture ready for a plane mesh.
export function decalTexture(kind, text = '') {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  if (kind === 'hazard') {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.clip();
    for (let i = -4; i < 10; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#f0a830' : '#14161a';
      ctx.save();
      ctx.translate(i * 48, 0);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(0, -40, 24, 340);
      ctx.restore();
    }
    ctx.restore();
  } else if (kind === 'letter') {
    ctx.fillStyle = 'rgba(240,168,48,0.9)';
    ctx.font = 'bold 190px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 8);
    ctx.strokeStyle = 'rgba(20,22,26,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, 118, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'arrow') {
    ctx.fillStyle = 'rgba(233,230,223,0.55)';
    ctx.beginPath();
    ctx.moveTo(size / 2, 20);
    ctx.lineTo(size * 0.82, 150);
    ctx.lineTo(size * 0.62, 150);
    ctx.lineTo(size * 0.62, 236);
    ctx.lineTo(size * 0.38, 236);
    ctx.lineTo(size * 0.38, 150);
    ctx.lineTo(size * 0.18, 150);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Soft radial glow for the sun glare sprite and muzzle flash cards.
export function glowTexture(inner = 'rgba(255,214,140,1)', outer = 'rgba(255,160,60,0)') {
  const size = 128;
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,190,100,0.55)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
