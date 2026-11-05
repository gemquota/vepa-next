/**
 * VEPA4 — Agency Engine (Set H.1 · Agency & Narrative)
 *
 * The Narrative Consciousness stops being a passive observer and gains bounded,
 * reversible hands. Every cadence it evaluates the world and may emit one
 * `agency:action` — a param nudge (rescue) or a field write (fertilize /
 * balance). The orchestrator applies the action through the undo ring so every
 * agency move is undoable, and journals it.
 *
 * Also hosts world milestones (H.3): emergent "quests" detected from metrics,
 * each fired exactly once and journaled.
 */

export const AGENCY_CADENCE = 300;     // frames between agency evaluations
export const AGENCY_COOLDOWN = 1500;   // frames between two accepted actions

export function createAgencyEngine(bus, config = {}) {
  return {
    bus: bus || null,
    cfg: {
      cadence: config.cadence ?? AGENCY_CADENCE,
      cooldown: config.cooldown ?? AGENCY_COOLDOWN,
      maxActions: config.maxActions ?? 1,
    },
    frame: 0,
    cooldownUntil: 0,
    actions: [],   // history of accepted actions
    events: [],    // drained by the caller
  };
}

/**
 * Decide the actor's next move from the current metrics. Pure + deterministic —
 * no randomness, no I/O — so it is fully unit-testable.
 *
 * @param {object} metrics  { populationAlive, avgEnergy, lawActiveCount }
 * @param {object} opts     { extinctionOpen, spawnRate, worldSize }
 * @returns {object|null}   { kind: 'param'|'field', ... , reason }
 */
export function decideAction(metrics, opts = {}) {
  const alive = metrics.populationAlive ?? 0;
  const avgEnergy = metrics.avgEnergy ?? 0;
  const lawActive = metrics.lawActiveCount ?? 0;
  const ws = opts.worldSize || 2000;
  const c = ws / 2;

  if (opts.extinctionOpen) {
    return {
      kind: 'param',
      key: 'SPAWN_RATE',
      value: (opts.spawnRate ?? 5) + 2,
      reason: 'rescue',
    };
  }
  if (lawActive > 0 && avgEnergy < 30) {
    return {
      kind: 'field',
      name: 'INFO',
      x: c, y: c, z: c,
      delta: 8,
      reason: 'fertilize',
    };
  }
  if (alive > 800) {
    return {
      kind: 'field',
      name: 'INFO',
      x: c, y: c, z: c,
      delta: -8,
      reason: 'balance',
    };
  }
  return null;
}

/**
 * Advance the agency clock; emit at most one action per cadence, then cool down.
 * @returns {Array} events drained this tick.
 */
export function updateAgency(engine, opts = {}) {
  engine.frame++;
  engine.events.length = 0;
  if (engine.frame < engine.cooldownUntil) return engine.events;
  if (!opts.metrics || (opts.metrics.lawActiveCount ?? 0) <= 0) return engine.events;
  if (engine.frame % engine.cfg.cadence !== 0) return engine.events;

  const action = decideAction(opts.metrics, opts);
  if (!action) return engine.events;

  engine.actions.push({ frame: engine.frame, ...action });
  engine.events.push({ type: 'agency:action', action });
  engine.cooldownUntil = engine.frame + engine.cfg.cooldown;
  return engine.events;
}

/** Reset agency state on restart. */
export function resetAgency(engine) {
  engine.frame = 0;
  engine.cooldownUntil = 0;
  engine.actions.length = 0;
  engine.events.length = 0;
}

/**
 * H.3 — world milestones. Idempotent via the `seen` set: each milestone fires
 * exactly once. Pure + deterministic.
 * @returns {Array<{id, text}>}
 */
export function detectMilestones(metrics, seen) {
  const out = [];
  const add = (id, text) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, text });
  };

  const alive = metrics.populationAlive ?? 0;
  const species = metrics.speciesAlive ?? 0;
  const groups = metrics.groupCount ?? 0;

  if (species >= 8) add('species-8', 'Eight species coexist — the tree of life branches.');
  if (groups >= 3) add('groups-3', 'Three civilizations now stand.');
  if (alive >= 1500) add('pop-1500', 'The dish teems with 1,500 lives.');
  if (alive > 0 && (metrics.avgEnergy ?? 0) >= 80) add('energy-80', 'Abundant energy suffuses the world.');
  return out;
}
