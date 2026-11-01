/**
 * VEPA v3 — HUD Overlay
 * Real-time stats display: FPS, particle count, tick telemetry.
 */
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../constants.js';

let fpsDisplay = 0;
let frameCount = 0;
let lastFpsTime = 0;
let rafId = null;
let physicsTickCount = 0;
let lastPhysicsTime = 0;
let ticksPerSecond = 0;

// Tick triple formatter: TICK n | x.x TPS | xx FPS
// Grouped tick digits keep large counters readable at a glance.
const fmtTickTriple = (t, tps, fps) =>
  `TICK ${(t < 0 ? 0 : t).toLocaleString('en-US')} │ ${tps.toFixed(1)} TPS │ ${Math.round(fps)} FPS`;

const el = {
  particles: null,
  tick: null,
};

function readEl() {
  el.particles = document.getElementById('hud-particles');
  el.tick = document.getElementById('hud-tick');
  // Color-coded accents (population blue, tick dim)
  if (el.particles) el.particles.classList.add('hud-particles');
  if (el.tick) el.tick.classList.add('hud-tick');
}

function tick(now) {
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    fpsDisplay = frameCount;
    frameCount = 0;
    lastFpsTime = now;
    if (el.tick) el.tick.textContent = fmtTickTriple(lastTickShown, ticksPerSecond, fpsDisplay);
  }
  rafId = requestAnimationFrame(tick);
}

/**
 * Compute alive particle count from the buffer.
 */
function countAlive(buffer, count) {
  if (!buffer) return 0;
  let alive = 0;
  for (let i = 0; i < count; i++) {
    if (buffer[i * PARTICLE_STRIDE + STRIDE_INDEXES.DEAD] < 0.5) {
      alive++;
    }
  }
  return alive;
}

/**
 * Create the HUD overlay. Subscribes to events and starts the FPS counter.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 */
export function createHUD(bus) {
  readEl();
  lastFpsTime = performance.now();
  rafId = requestAnimationFrame(tick);

  let currentTick = 0;
  let lastParticles = -1;
  let lastTickShown = -1;

  // Throttle DOM writes: particle text only changes when the value changes.
  // Tick telemetry is compact and refreshed once per second.
  const updateStats = (particleCount, _speciesCount, t) => {
    if (particleCount !== undefined && particleCount !== lastParticles && el.particles) {
      lastParticles = particleCount;
      el.particles.textContent = `${particleCount} particles`;
    }
    if (t !== undefined && el.tick) {
      const now = performance.now();
      physicsTickCount++;
      if (!lastPhysicsTime) lastPhysicsTime = now;
      const elapsed = now - lastPhysicsTime;
      if (elapsed >= 1000) {
        ticksPerSecond = physicsTickCount * 1000 / elapsed;
        physicsTickCount = 0;
        lastPhysicsTime = now;
      }
      lastTickShown = t;
      el.tick.textContent = fmtTickTriple(t, ticksPerSecond, fpsDisplay);
    }
  };

  bus.on('physics:tick', ({ tick: t, particleCount, speciesCount }) => {
    currentTick = t;
    updateStats(particleCount, speciesCount, t);
  });

  // Also listen for direct stat updates
  bus.on('stats:update', ({ particleCount, speciesCount, tick: t }) => {
    updateStats(particleCount, speciesCount, t);
  });
}
