// Synthesised sounds — WebAudio only, no audio files, no network.
// Created lazily on the first user gesture (browsers block audio before it).
export function createAudio() {
  let ctx = null;
  let master = null;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function noiseBurst(dur, freq, gainVal) {
    if (!ensure()) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gainVal;
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start();
  }
  function tone(freq, dur, type, gainVal, slideTo) {
    if (!ensure()) return;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    unlock() { ensure(); },
    shot(kind) {
      if (kind === 'horizon') { noiseBurst(0.22, 900, 0.9); tone(90, 0.18, 'sine', 0.5, 40); }
      else if (kind === 'wasp') noiseBurst(0.08, 2400, 0.45);
      else noiseBurst(0.11, 1800, 0.6);
    },
    enemyShot() { noiseBurst(0.09, 1200, 0.22); },
    hit() { tone(1200, 0.05, 'square', 0.18); },
    kill() { tone(880, 0.09, 'square', 0.22); tone(1320, 0.12, 'square', 0.18); },
    hurt() { tone(160, 0.15, 'sawtooth', 0.3, 90); },
    reload() { tone(500, 0.06, 'square', 0.15); setTimeout(() => tone(700, 0.06, 'square', 0.15), 180); },
    buy() { tone(660, 0.07, 'sine', 0.25); setTimeout(() => tone(990, 0.09, 'sine', 0.25), 80); },
    deny() { tone(180, 0.12, 'square', 0.2); },
    roundStart() { tone(440, 0.12, 'sine', 0.25); setTimeout(() => tone(660, 0.16, 'sine', 0.25), 130); },
    roundWin() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.25), i * 120)); },
    roundLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.22), i * 130)); },
    captureTick() { tone(980, 0.05, 'sine', 0.16); },
    plant() { tone(1200, 0.3, 'sine', 0.2, 600); },
  };
}
