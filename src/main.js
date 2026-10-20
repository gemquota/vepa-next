import { textToSeed } from './core/seed.js';
import { SplitMix32 } from './core/prng.js';
import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from './sim/particle-layout.js';
import { RENDER_STRIDE, validateParticleExecutionConfig } from './sim/execution-adapter.js';
import { createWorkerExecutionAdapter } from './sim/worker-execution-adapter.js';
import { createWorldSession } from './state/world-session.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
 seed: document.querySelector('#seedInput'), count: document.querySelector('#count'), strength: document.querySelector('#strength'), speed: document.querySelector('#speed'),
 countOut: document.querySelector('#countOut'), strengthOut: document.querySelector('#strengthOut'), speedOut: document.querySelector('#speedOut'),
 state: document.querySelector('#stateBadge'), seedBadge: document.querySelector('#seedBadge'), tickBadge: document.querySelector('#tickBadge'),
 particleStat: document.querySelector('#particleStat'), tickStat: document.querySelector('#tickStat'), fpsStat: document.querySelector('#fpsStat'), hashStat: document.querySelector('#hashStat'),
 reset: document.querySelector('#resetBtn'), pause: document.querySelector('#pauseBtn'),
 gravityLaw: document.querySelector('#gravityLaw'), dragLaw: document.querySelector('#dragLaw'), collisionLaw: document.querySelector('#collisionLaw'),
};

const WORLD_SIZE = 2000;
let width = 1, height = 1, runtime = null, session = null, renderState = new Float32Array(0);
let running = true, busy = false, tick = 0, runtimeToken = 0;
let fpsStart = 0, frameCount = 0, lastStepAt = 0;
let settingsQueue = Promise.resolve();

function resize() {
 const rect = canvas.getBoundingClientRect();
 const dpr = Math.min(window.devicePixelRatio || 1, 2);
 width = Math.max(1, rect.width); height = Math.max(1, rect.height);
 canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
 ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeInitialState(count, seed) {
 const rng = new SplitMix32(seed);
 const state = new Float64Array(count * PARTICLE_STRIDE);
 for (let i = 0; i < count; i++) {
  const b = i * PARTICLE_STRIDE;
  state[b + S.POS_X] = rng.next() * WORLD_SIZE;
  state[b + S.POS_Y] = rng.next() * WORLD_SIZE;
  state[b + S.POS_Z] = rng.next() * WORLD_SIZE;
  const azimuth = rng.next() * Math.PI * 2;
  const z = rng.next() * 2 - 1;
  const planar = Math.sqrt(Math.max(0, 1 - z * z));
  const speed = 2 + rng.next() * 4;
  state[b + S.VEL_X] = Math.cos(azimuth) * planar * speed;
  state[b + S.VEL_Y] = Math.sin(azimuth) * planar * speed;
  state[b + S.VEL_Z] = z * speed;
  state[b + S.MASS] = 0.75 + rng.next() * 0.5;
  state[b + S.RADIUS] = 3 + rng.next() * 2;
  state[b + S.CHARGE] = rng.next() < 0.5 ? -1 : 1;
  state[b + S.ENERGY] = 0.25 + rng.next() * 0.75;
  state[b + S.DEAD] = 0;
 }
 return state;
}

function makeConfig() {
 return {
  worldSize: WORLD_SIZE,
  boundaryMode: 'toroidal',
  dt: Number(ui.speed.value) * 0.2,
  gravitationalConstant: Number(ui.strength.value) * 250,
  softening: 15,
  interactionRadius: WORLD_SIZE / 8,
  activeLawIds: [ui.gravityLaw.checked && 'law.gravity', ui.dragLaw.checked && 'law.drag', ui.collisionLaw.checked && 'law.collision'].filter(Boolean),
  resolveContacts: true,
  contactIterations: 1,
 };
}

function validateConfig(candidate) {
 try {
  const config = validateParticleExecutionConfig(candidate);
  const unsupported = config.activeLawIds.filter(id => !['law.gravity', 'law.drag', 'law.collision'].includes(id));
  if (unsupported.length) return { valid: false, reason: 'prototype-solver-unsupported-laws:' + unsupported.join(',') };
  return { valid: true, value: config };
 } catch (error) {
  return { valid: false, reason: error.message };
 }
}

async function init() {
 const token = ++runtimeToken;
 const previous = runtime;
 runtime = null; session = null; busy = false; tick = 0;
 if (previous) await previous.dispose().catch(() => {});
 const seed = textToSeed(ui.seed.value);
 const count = Number(ui.count.value);
 const config = makeConfig();
 const initialState = makeInitialState(count, seed);
 try {
  const nextRuntime = await createWorkerExecutionAdapter({ initialState, count, stride: PARTICLE_STRIDE, config });
  if (token !== runtimeToken) { await nextRuntime.dispose(); return; }
  runtime = nextRuntime;
  session = createWorldSession({
   worldId: 'vepa-' + seed.toString(16),
   initialConfig: config,
   validateConfig,
   applyConfig: async next => { await runtime.configure(next); },
   restoreConfig: async previousConfig => { await runtime.configure(previousConfig); },
  });
  renderState = await runtime.readRenderState();
  ui.state.textContent = runtime.mode === 'worker' ? 'WORKER' : 'IN-PROCESS';
  ui.seedBadge.textContent = 'SEED ' + seed;
  ui.hashStat.textContent = seed.toString(16).padStart(8, '0');
  ui.particleStat.textContent = String(count);
  ui.tickStat.textContent = '0'; ui.tickBadge.textContent = 'TICK 0';
 } catch (error) {
  if (token === runtimeToken) { ui.state.textContent = 'ERROR'; console.error(error); }
 }
}

function updateSettings() {
 settingsQueue = settingsQueue.catch(() => {}).then(async () => {
  if (!session) return;
  const current = session.getSnapshot().config;
  const result = await session.proposeConfig({
   ...current,
   dt: Number(ui.speed.value) * 0.2,
   gravitationalConstant: Number(ui.strength.value) * 250,
   activeLawIds: [ui.gravityLaw.checked && 'law.gravity', ui.dragLaw.checked && 'law.drag', ui.collisionLaw.checked && 'law.collision'].filter(Boolean),
  });
  if (result.status !== 'committed') ui.state.textContent = 'CONFIG ' + result.status.toUpperCase();
  else ui.state.textContent = running ? (runtime?.mode === 'worker' ? 'WORKER' : 'IN-PROCESS') : 'PAUSED';
 });
 return settingsQueue;
}

function render() {
 ctx.fillStyle = '#070c16'; ctx.fillRect(0, 0, width, height);
 ctx.globalCompositeOperation = 'lighter';
 for (let i = 0; i + RENDER_STRIDE <= renderState.length; i += RENDER_STRIDE) {
  if (renderState[i + 5] >= 0.5) continue;
  const x = renderState[i] / WORLD_SIZE * width;
  const y = renderState[i + 1] / WORLD_SIZE * height;
  const depth = renderState[i + 2] / WORLD_SIZE;
  const radius = Math.max(1, Math.min(4, 1.1 + renderState[i + 3] * 0.22 + depth * 0.7));
  const alpha = Math.max(0.25, Math.min(0.95, 0.45 + depth * 0.5));
  ctx.beginPath();
  ctx.fillStyle = renderState[i + 6] >= 0 ? 'rgba(86,231,239,' + alpha + ')' : 'rgba(174,143,255,' + alpha + ')';
  ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
 }
 ctx.globalCompositeOperation = 'source-over';
}

async function frame(now) {
 requestAnimationFrame(frame);
 if (!fpsStart) fpsStart = now;
 frameCount++;
 if (now - fpsStart >= 500) {
  ui.fpsStat.textContent = String(Math.round(frameCount * 1000 / (now - fpsStart)));
  frameCount = 0; fpsStart = now;
 }
 if (running && runtime && !busy && now - lastStepAt >= 16) {
  const token = runtimeToken;
  busy = true; lastStepAt = now;
  try {
   const result = await runtime.step();
   if (token === runtimeToken) {
    renderState = result.renderState;
    tick = result.metrics.tick;
    session?.advanceTick();
    ui.tickStat.textContent = String(tick); ui.tickBadge.textContent = 'TICK ' + tick;
   }
  } catch (error) {
   if (token === runtimeToken) { running = false; ui.state.textContent = 'ERROR'; console.error(error); }
  } finally { if (token === runtimeToken) busy = false; }
 }
 render();
}

ui.reset.addEventListener('click', () => { void init(); });
ui.pause.addEventListener('click', () => {
 running = !running; ui.pause.textContent = running ? 'Pause' : 'Resume';
 ui.state.textContent = running ? (runtime?.mode === 'worker' ? 'WORKER' : 'IN-PROCESS') : 'PAUSED';
});
for (const [input, output, format] of [[ui.count, ui.countOut, value => value], [ui.strength, ui.strengthOut, value => Number(value).toFixed(1)], [ui.speed, ui.speedOut, value => Number(value).toFixed(1) + '×']]) {
 input.addEventListener('input', () => { output.textContent = format(input.value); if (input !== ui.count) void updateSettings(); });
}
for (const toggle of [ui.gravityLaw, ui.dragLaw, ui.collisionLaw]) toggle.addEventListener('change', () => { void updateSettings(); });
ui.count.addEventListener('change', () => { void init(); });
ui.seed.addEventListener('keydown', event => { if (event.key === 'Enter') void init(); });
window.addEventListener('resize', resize);
resize();
ui.countOut.textContent = ui.count.value; ui.strengthOut.textContent = Number(ui.strength.value).toFixed(1); ui.speedOut.textContent = Number(ui.speed.value).toFixed(1) + '×';
void init();
requestAnimationFrame(frame);
