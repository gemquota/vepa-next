/**
 * VEPA4 — Ecosystem Analytics Engine (Set A.2 "Living World", RRP E·F·A trilogy)
 *
 * The single thin metrics-ring subscriber (substrate decision U5.4): it owns
 * the aggregate ecosystem state and feeds the ECO sub-tab. Nothing else
 * duplicates it. From the `sim:metrics` stream (every 30 ticks) it keeps:
 *
 *   - population curves: per-species population over the ring window,
 *   - biodiversity: Shannon index over the live species,
 *   - oscillation detection: variance of total population across the window,
 *   - niches: per-species centroid + population-weighted radius,
 *   - food-web: predation edges derived from size (avg mass) × spatial
 *     overlap between species — bigger predators overlapping smaller prey.
 *
 * It also subscribes to speciation events (A.1) for the split feed + EXTINCT
 * history. The ring is bounded; entries are compact plain objects.
 */
const RING_CAP = 40;
const FOODWEB_MASS_RATIO = 1.5;
const FOODWEB_OVERLAP = 1.6;

export function createEcoEngine(bus) {
  const engine = {
    ring: [],          // newest last: {tick, total, speciesAlive, shannon, species: {id: {pop, avgEnergy, avgMass, cx, cy, cz}}}
    foodWeb: new Map(), // 'prey->predator' → {prey, predator, strength} (strength 0-1)
    niches: new Map(),  // species → {cx, cy, cz, radius, pop}
    splits: [],         // {parent, child, isolation, tick} (A.1 burst feed)
    extinct: [],        // {species, tick}
    lastTotal: 0,
    ringCap: RING_CAP,
  };

  bus.on('sim:metrics', (m) => pushMetrics(engine, m));
  bus.on('speciation:split', (e) => {
    engine.splits.push(e);
    if (engine.splits.length > 8) engine.splits.shift();
  });
  bus.on('speciation:extinct', (e) => {
    engine.extinct.push(e);
    if (engine.extinct.length > 12) engine.extinct.shift();
  });

  return engine;
}

function pushMetrics(engine, m) {
  if (!m.speciesPop) return; // metrics without per-species detail are ignored
  const species = {};
  let shannon = 0;
  for (const [sp, pop] of Object.entries(m.speciesPop)) {
    const n = pop || 0;
    if (n <= 0) continue;
    const p = n / m.populationAlive;
    shannon -= p * Math.log(p);
    const e = m.speciesEnergy[sp] || 0;
    const mass = m.speciesMass[sp] || 0;
    const pos = m.speciesPos[sp] || [0, 0, 0];
    species[sp] = {
      pop: n,
      avgEnergy: e / n,
      avgMass: mass / n,
      cx: pos[0] / n,
      cy: pos[1] / n,
      cz: pos[2] / n,
    };
    engine.niches.set(Number(sp), {
      cx: pos[0] / n,
      cy: pos[1] / n,
      cz: pos[2] / n,
      radius: Math.max(60, Math.sqrt(n) * 30),
      pop: n,
    });
  }
  // Prune niches for extinct species.
  for (const sp of [...engine.niches.keys()]) {
    if (!m.speciesPop[sp] || m.speciesPop[sp] <= 0) engine.niches.delete(sp);
  }

  engine.ring.push({
    tick: m.frameDelta !== undefined ? m.frameDelta : engine.ring.length,
    total: m.populationAlive,
    speciesAlive: m.speciesAlive,
    shannon,
    species,
  });
  if (engine.ring.length > engine.ringCap) engine.ring.shift();

  updateFoodWeb(engine, species);
  engine.lastTotal = m.populationAlive;
}

/** Predation edges: species A → B when A is bigger and overlaps B's niche. */
function updateFoodWeb(engine, species) {
  const ids = Object.keys(species);
  const web = new Map();
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const a = species[ids[i]]; // potential predator
      const b = species[ids[j]]; // potential prey
      if (a.avgMass <= 0 || b.avgMass <= 0) continue;
      if (a.avgMass < b.avgMass * FOODWEB_MASS_RATIO) continue;
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz);
      const reach = (Math.sqrt(a.pop) + Math.sqrt(b.pop)) * 30 * FOODWEB_OVERLAP;
      if (d > reach) continue;
      const strength = Math.min(1, (a.avgMass / b.avgMass - FOODWEB_MASS_RATIO) / 4 + (1 - d / reach) * 0.5);
      web.set(`${ids[j]}->${ids[i]}`, { prey: Number(ids[j]), predator: Number(ids[i]), strength });
    }
  }
  engine.foodWeb = web;
}

/** Total-population variance across the ring — oscillation detection. */
export function oscillationScore(engine) {
  if (engine.ring.length < 4) return 0;
  const vals = engine.ring.map((r) => r.total);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return variance / Math.max(1, mean * mean);
}

export function biodiversity(engine) {
  const last = engine.ring[engine.ring.length - 1];
  return last ? last.shannon : 0;
}
