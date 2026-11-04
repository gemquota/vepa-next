/**
 * VEPA v3 — Lineage Tracker
 * Records the evolutionary genealogy of particles: births, deaths,
 * parent-child links, and per-species lineage statistics.
 *
 * Emits: lineage:branch { parentId, childId, species, generation }
 *        lineage:death  { particleId, cause, age }
 */

const DEFAULTS = {
  maxEvents: 5000,       // max lineage events retained in memory
};

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a lineage tracker instance.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {object} [config]
 * @returns {object} Engine handle.
 */
export function createLineageTracker(bus, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const engine = {
    bus,
    cfg,
    events: [],            // chronological record of birth/death events
    particles: new Map(),  // particleId -> { species, generation, parentIds, birthFrame, deathFrame, cause }
    speciesGenerations: new Map(),  // speciesId -> max generation seen
    totalBirths: 0,
    totalDeaths: 0,
    longestLineage: 0,     // deepest generation number observed
  };

  return engine;
}

/* ------------------------------------------------------------------ */
/*  Track a birth                                                      */
/* ------------------------------------------------------------------ */

/**
 * @param {object} engine
 * @param {number|string} parentId      Parent particle index (-1 or 'none' for seed)
 * @param {number|string} childId       New particle index
 * @param {number} species              Species ID (0–63)
 * @param {number} generation           Generation number (0 for seeds)
 */
export function trackBirth(engine, parentId, childId, species, generation) {
  const parentRecord = engine.particles.get(parentId);
  const gen = parentRecord ? parentRecord.generation + 1 : (generation || 0);

  const record = {
    type: 'birth',
    parentId,
    childId,
    species,
    generation: gen,
    parentIds: parentRecord ? [...parentRecord.parentIds, parentId] : [parentId],
    birthFrame: null,       // set externally if frame is known
    deathFrame: null,
    cause: null,
  };

  engine.particles.set(childId, record);
  engine.totalBirths++;

  if (gen > engine.longestLineage) {
    engine.longestLineage = gen;
  }

  // Track max generation per species
  const prevMax = engine.speciesGenerations.get(species) || 0;
  if (gen > prevMax) {
    engine.speciesGenerations.set(species, gen);
  }

  // Record event
  pushEvent(engine, {
    type: 'birth',
    parentId,
    childId,
    species,
    generation: gen,
  });

  engine.bus.emit('lineage:branch', {
    parentId,
    childId,
    species,
    generation: gen,
  });
}

/* ------------------------------------------------------------------ */
/*  Track a death                                                      */
/* ------------------------------------------------------------------ */

/**
 * @param {object} engine
 * @param {number|string} particleId
 * @param {string} cause   e.g. 'starvation', 'collision', 'age', 'predation', 'unknown'
 */
export function trackDeath(engine, particleId, cause) {
  const record = engine.particles.get(particleId);

  if (record) {
    record.deathFrame = null;   // set externally if frame is known
    record.cause = cause || 'unknown';
  }

  engine.totalDeaths++;

  pushEvent(engine, {
    type: 'death',
    particleId,
    cause: cause || 'unknown',
    species: record ? record.species : -1,
    generation: record ? record.generation : 0,
  });

  engine.bus.emit('lineage:death', {
    particleId,
    cause: cause || 'unknown',
  });
}

/* ------------------------------------------------------------------ */
/*  Statistics                                                         */
/* ------------------------------------------------------------------ */

/**
 * Return aggregate lineage statistics.
 *
 * @param {object} engine
 * @returns {{totalBirths, totalDeaths, longestLineage, speciesBreakdown, survivalRate}}
 */
export function getStats(engine) {
  const speciesBreakdown = {};
  for (const [, rec] of engine.particles) {
    const sp = rec.species;
    if (!speciesBreakdown[sp]) {
      speciesBreakdown[sp] = { births: 0, deaths: 0, maxGeneration: 0 };
    }
    speciesBreakdown[sp].births++;
    if (rec.deathFrame !== null || rec.cause) {
      speciesBreakdown[sp].deaths++;
    }
    if (rec.generation > speciesBreakdown[sp].maxGeneration) {
      speciesBreakdown[sp].maxGeneration = rec.generation;
    }
  }

  return {
    totalBirths:  engine.totalBirths,
    totalDeaths:  engine.totalDeaths,
    longestLineage: engine.longestLineage,
    speciesBreakdown,
    survivalRate: engine.totalBirths > 0
      ? (engine.totalBirths - engine.totalDeaths) / engine.totalBirths
      : 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Query helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Get the full ancestor chain for a particle.
 */
export function getAncestors(engine, particleId) {
  const record = engine.particles.get(particleId);
  if (!record) return [];
  return record.parentIds.slice();
}

/**
 * Get all living particles (no death recorded).
 */
export function getAlive(engine) {
  const alive = [];
  for (const [id, rec] of engine.particles) {
    if (rec.deathFrame === null && !rec.cause) {
      alive.push({ id, ...rec });
    }
  }
  return alive;
}

/* ------------------------------------------------------------------ */
/*  Internal                                                          */
/* ------------------------------------------------------------------ */

function pushEvent(engine, event) {
  engine.events.push(event);
  if (engine.events.length > engine.cfg.maxEvents) {
    engine.events.shift();
  }
}
