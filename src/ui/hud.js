/**
 * VEPA v3 — HUD Overlay
 * Real-time stats display: FPS, particle count, tick telemetry.
 */

let fpsDisplay = 0;
let frameCount = 0;
let lastFpsTime = 0;
let rafId = null;
let lastTickRateTime = null;
let lastTickRate = -1;
let ticksPerSecond = 0;
let lastTickShown = -1; // module scope: also read by the rAF loop below
let lastSpeciesShown = 0;
let lastParticlesShown = -1;

// Keep total progress, tick cadence, and render rate visible together.
export const formatTickStats = (tick, fps, tps = 0) =>
  `${(tick < 0 ? 0 : tick).toLocaleString('en-US')}\n${Number(tps || 0).toFixed(1)} TPS · ${Number(fps || 0).toFixed(1)} FPS`;

const el = {
  particles: null,
  species: null,
  tick: null,
};

function readEl() {
  el.particles = document.getElementById('hud-particles');
  el.species = document.getElementById('hud-species');
  el.tick = document.getElementById('hud-tick');
  if (el.particles) {
    el.particles.classList.add('hud-particles');
    el.particles.dataset.count = '—';
    el.particles.setAttribute('aria-label', 'Particle population loading');
  }
  if (el.species) el.species.textContent = 'SPECIES —';
  if (el.tick) el.tick.classList.add('hud-tick');
}

function tick(now) {
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    fpsDisplay = frameCount;
    frameCount = 0;
    lastFpsTime = now;
    if (el.tick) {
      el.tick.textContent = formatTickStats(lastTickShown, fpsDisplay, ticksPerSecond);
      el.tick.setAttribute('aria-label', `Tick ${Math.max(0, lastTickShown)}, ${ticksPerSecond.toFixed(1)} ticks per second, ${Number(fpsDisplay).toFixed(1)} frames per second`);
    }
  }
  rafId = requestAnimationFrame(tick);
}

/**
 * Create the HUD overlay. Subscribes to events and starts the FPS counter.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 */
export function createHUD(bus) {
  readEl();
  if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
  frameCount = 0;
  fpsDisplay = 0;
  lastFpsTime = performance.now();
  lastTickRateTime = null;
  lastTickRate = -1;
  ticksPerSecond = 0;
  lastTickShown = -1;
  lastSpeciesShown = 0;
  lastParticlesShown = -1;
  rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(tick) : null;

  // Keep labels visible and update their values only when the underlying stat changes.
  const updateStats = (particleCount, speciesCount, t) => {
    if (particleCount !== undefined && particleCount !== lastParticlesShown && el.particles) {
      lastParticlesShown = particleCount;
      const hue = (particleCount * 11) % 360;
      const intensity = Math.min(1, Math.max(0.25, particleCount / 2500));
      const formatted = Number(particleCount).toLocaleString('en-US');
      el.particles.style.setProperty('--population-h', String(hue));
      el.particles.style.setProperty('--population-intensity', intensity.toFixed(2));
      el.particles.dataset.count = formatted;
      el.particles.setAttribute('aria-label', `${formatted} particles alive`);
    }
    if (speciesCount !== undefined && speciesCount !== lastSpeciesShown && el.species) {
      lastSpeciesShown = speciesCount;
      el.species.textContent = `SPECIES ${Number(speciesCount).toLocaleString('en-US')}`;
      el.species.setAttribute('aria-label', `${Number(speciesCount).toLocaleString('en-US')} species`);
    }
    if (t !== undefined && el.tick) {
      const now = performance.now();
      if (lastTickRateTime === null) {
        lastTickRate = t;
        lastTickRateTime = now;
      }
      const elapsed = now - lastTickRateTime;
      if (elapsed >= 1000) {
        ticksPerSecond = Math.max(0, t - lastTickRate) * 1000 / elapsed;
        lastTickRate = t;
        lastTickRateTime = now;
      }
      lastTickShown = t;
      el.tick.textContent = formatTickStats(lastTickShown, fpsDisplay, ticksPerSecond);
      el.tick.setAttribute('aria-label', `Tick ${lastTickShown}, ${ticksPerSecond.toFixed(1)} ticks per second, ${Number(fpsDisplay).toFixed(1)} frames per second`);
    }
  };

  bus.on('physics:tick', ({ tick: t, particleCount, speciesCount }) => {
    updateStats(particleCount, speciesCount, t);
  });

  // Also listen for direct stat updates
  bus.on('stats:update', ({ particles, particleCount, species, speciesCount, tick: t }) => {
    updateStats(particleCount ?? particles, speciesCount ?? species, t);
  });
}
