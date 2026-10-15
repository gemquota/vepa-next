import { textToSeed } from './core/seed.js';
import { SplitMix32 } from './core/prng.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
  seed: document.querySelector('#seedInput'), count: document.querySelector('#count'),
  strength: document.querySelector('#strength'), speed: document.querySelector('#speed'),
  countOut: document.querySelector('#countOut'), strengthOut: document.querySelector('#strengthOut'),
  speedOut: document.querySelector('#speedOut'), state: document.querySelector('#stateBadge'),
  seedBadge: document.querySelector('#seedBadge'), tickBadge: document.querySelector('#tickBadge'),
  particleStat: document.querySelector('#particleStat'), tickStat: document.querySelector('#tickStat'),
  fpsStat: document.querySelector('#fpsStat'), hashStat: document.querySelector('#hashStat'),
  reset: document.querySelector('#resetBtn'), pause: document.querySelector('#pauseBtn'),
};

let width = 0, height = 0, count = Number(ui.count.value), tick = 0, running = true;
let x, y, vx, vy, charge, rng, seed, lastFrame = 0, frameCount = 0, fpsStart = 0, fps = 0;
const pointer = { x: 0, y: 0, active: false };

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (x) for (let i = 0; i < count; i++) { x[i] = Math.min(x[i], width); y[i] = Math.min(y[i], height); }
}
function init() {
  seed = textToSeed(ui.seed.value);
  rng = new SplitMix32(seed);
  count = Number(ui.count.value);
  x = new Float32Array(count); y = new Float32Array(count);
  vx = new Float32Array(count); vy = new Float32Array(count);
  charge = new Int8Array(count);
  for (let i = 0; i < count; i++) {
    x[i] = rng.next() * width; y[i] = rng.next() * height;
    const angle = rng.next() * Math.PI * 2, speed = .25 + rng.next() * 1.1;
    vx[i] = Math.cos(angle) * speed; vy[i] = Math.sin(angle) * speed;
    charge[i] = rng.next() < .5 ? -1 : 1;
  }
  tick = 0;
  ui.seedBadge.textContent = 'SEED ' + seed;
  ui.hashStat.textContent = seed.toString(16).padStart(8, '0');
  ui.particleStat.textContent = String(count);
  ui.tickStat.textContent = '0';
  ui.tickBadge.textContent = 'TICK 0';
}
function step() {
  const strength = Number(ui.strength.value), speed = Number(ui.speed.value);
  // Compact O(n²) demonstration only. The production spatial solver will be migrated separately.
  for (let i = 0; i < count; i++) {
    let ax = 0, ay = 0;
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      let dx = x[j] - x[i], dy = y[j] - y[i];
      if (dx > width / 2) dx -= width; else if (dx < -width / 2) dx += width;
      if (dy > height / 2) dy -= height; else if (dy < -height / 2) dy += height;
      const d2 = dx * dx + dy * dy + 100;
      const force = (charge[i] === charge[j] ? -1 : 1) * strength / d2;
      ax += dx * force; ay += dy * force;
    }
    if (pointer.active) {
      let dx = pointer.x - x[i], dy = pointer.y - y[i];
      const d2 = dx * dx + dy * dy + 800;
      ax += dx * 12 / d2; ay += dy * 12 / d2;
    }
    vx[i] = Math.max(-3, Math.min(3, (vx[i] + ax * speed) * .999));
    vy[i] = Math.max(-3, Math.min(3, (vy[i] + ay * speed) * .999));
    x[i] += vx[i] * speed; y[i] += vy[i] * speed;
    if (x[i] < 0) x[i] += width; else if (x[i] >= width) x[i] -= width;
    if (y[i] < 0) y[i] += height; else if (y[i] >= height) y[i] -= height;
  }
  tick++;
}
function render() {
  ctx.fillStyle = '#070c16'; ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    ctx.beginPath(); ctx.fillStyle = charge[i] > 0 ? 'rgba(86,231,239,.82)' : 'rgba(174,143,255,.8)';
    ctx.arc(x[i], y[i], 1.3 + (Math.abs(vx[i]) + Math.abs(vy[i])) * .22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function frame(now) {
  if (!fpsStart) fpsStart = now;
  frameCount++;
  if (now - fpsStart >= 500) { fps = Math.round(frameCount * 1000 / (now - fpsStart)); frameCount = 0; fpsStart = now; ui.fpsStat.textContent = String(fps); }
  if (running && now - lastFrame >= 16) { step(); lastFrame = now; }
  render();
  ui.tickStat.textContent = String(tick); ui.tickBadge.textContent = 'TICK ' + tick;
  requestAnimationFrame(frame);
}
ui.reset.addEventListener('click', init);
ui.pause.addEventListener('click', () => { running = !running; ui.pause.textContent = running ? 'Pause' : 'Resume'; ui.state.textContent = running ? 'RUNNING' : 'PAUSED'; });
for (const [input, output, format] of [[ui.count, ui.countOut, v => v], [ui.strength, ui.strengthOut, v => Number(v).toFixed(1)], [ui.speed, ui.speedOut, v => Number(v).toFixed(1) + '×']]) {
  input.addEventListener('input', () => { output.textContent = format(input.value); if (input === ui.count) init(); });
}
ui.seed.addEventListener('keydown', e => { if (e.key === 'Enter') init(); });
canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true; });
canvas.addEventListener('pointerleave', () => { pointer.active = false; });
window.addEventListener('resize', resize);
resize(); init(); requestAnimationFrame(frame);
