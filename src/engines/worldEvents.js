/**
 * VEPA4 — World Events Engine (Set A.3 "Living World", RRP E·F·A trilogy)
 *
 * The dish narrates its own disasters. Events are METRICS-TRIGGERED and
 * PHYSICS-CONFIRMED: a metric threshold (population/energy ratios against a
 * rolling baseline) must persist across two consecutive checks before an
 * event fires — the confirm gate stops restore/multiplex false positives.
 *
 * Events: FAMINE (population and energy collapse), BLOOM (population surge),
 * and COLLAPSE (near-total extinction). Each fires at most once per COOLDOWN
 * window. main.js consumes 'worldEvent:triggered' and applies reversible
 * responses: an undo-ring checkpoint, world-param nudges, and E-field writes
 * (droughts / fertilization) — per design U3.5.
 */
const BASELINE_SAMPLES = 5;    // rolling baseline warm-up
const CONFIRM_CHECKS = 2;      // physics-confirm gate (persistence)
const COOLDOWN = 1500;         // ticks between events (design risk 5)
const FAMINE_POP = 0.4;        // population ratio threshold
const FAMINE_ENERGY = 0.3;     // avg-energy ratio threshold
const BLOOM_POP = 1.25;        // population surge threshold
const COLLAPSE_POP = 0.15;     // near-total extinction threshold

export function createWorldEventEngine(bus) {
  const engine = {
    bus,              // event sink (main.js applies the reversible response)
    baselineTotal: 0,
    baselineEnergy: 0,
    samples: 0,
    confirm: 0,       // consecutive threshold hits
    lastType: null,
    cooldownUntil: 0,
    tick: 0,
    events: [],       // recent triggered events (ring)
    eventCap: 8,
  };

  bus.on('sim:metrics', (m) => check(engine, m));
  return engine;
}

function check(engine, m) {
  engine.tick = m.frameDelta !== undefined ? m.frameDelta : engine.tick + 1;
  if (engine.cooldownUntil > engine.tick) return;

  // Rolling baseline from the first samples.
  if (engine.samples < BASELINE_SAMPLES) {
    engine.baselineTotal += m.populationAlive;
    engine.baselineEnergy += m.avgEnergy;
    engine.samples++;
    return;
  }
  const basePop = Math.max(1, engine.baselineTotal / BASELINE_SAMPLES);
  const baseEnergy = Math.max(1e-6, engine.baselineEnergy / BASELINE_SAMPLES);
  const popRatio = m.populationAlive / basePop;
  const energyRatio = m.avgEnergy / baseEnergy;

  let type = null;
  if (popRatio < COLLAPSE_POP) type = 'collapse';
  else if (popRatio < FAMINE_POP && energyRatio < FAMINE_ENERGY) type = 'famine';
  else if (popRatio > BLOOM_POP && m.populationAlive >= engine.lastTotal) type = 'bloom';

  if (type && type === engine.lastType) {
    engine.confirm++;
  } else {
    engine.confirm = type ? 1 : 0;
  }
  engine.lastType = type;

  // Physics-confirm gate: the same event must persist CONFIRM_CHECKS times.
  if (type && engine.confirm >= CONFIRM_CHECKS) {
    const ev = { type, tick: engine.tick, popRatio, energyRatio };
    engine.events.push(ev);
    if (engine.events.length > engine.eventCap) engine.events.shift();
    engine.cooldownUntil = engine.tick + COOLDOWN;
    engine.confirm = 0;
    // Emit on the bus so main.js can apply the reversible response.
    if (engine.bus && engine.bus.emit) engine.bus.emit('worldEvent:triggered', ev);
  }
}
