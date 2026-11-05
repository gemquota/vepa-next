/**
 * VEPA4 — Epoch Engine (Set D.1 · Deep Time & Epochs)
 *
 * The world advances through named eras on a tick boundary. Every era
 * boundary snapshots the full world (via an injected captureFn) so any era
 * can be restored later — history becomes a navigable, first-class thing.
 *
 * Population collapse past EXTINCTION_THRESHOLD marks an extinction; a later
 * rebound past RECOVERY_THRESHOLD marks a recovery. Both are epoch-anchored,
 * once-per-cycle events the orchestrator can respond to reversibly.
 *
 * Emits (drained from engine.events by the caller):
 *   epoch:boundary  { era, tick, name, summary }
 *   epoch:extinction { era, tick, alive, baseline }
 *   epoch:recovery   { era, tick, alive, baseline }
 */

import { STRIDE_INDEXES } from '../constants.js';

export const EPOCH_CAP = 16;                       // restorable era snapshots kept
export const DEFAULT_EPOCH_LENGTH = 600;           // ticks per era
export const DEFAULT_EXTINCTION_THRESHOLD = 0.35;  // alive/baseline below → extinction
export const DEFAULT_RECOVERY_THRESHOLD = 0.7;     // alive/baseline above → recovery

const ERA_NAMES = [
  'GENESIS', 'DAWN', 'BLOOM', 'STAGNATION', 'TUMULT', 'RUIN',
  'RENAISSANCE', 'APOGEE', 'TWILIGHT', 'RECURRENCE',
];

/**
 * @param {object} [bus]       optional EventBus (engine never emits directly —
 *                             events are drained so tests stay synchronous)
 * @param {object} [config]    { epochLength, extinctionThreshold, recoveryThreshold }
 */
export function createEpochEngine(bus, config = {}) {
  return {
    bus: bus || null,
    cfg: {
      epochLength: config.epochLength ?? DEFAULT_EPOCH_LENGTH,
      extinctionThreshold: config.extinctionThreshold ?? DEFAULT_EXTINCTION_THRESHOLD,
      recoveryThreshold: config.recoveryThreshold ?? DEFAULT_RECOVERY_THRESHOLD,
    },
    frame: 0,
    era: 0,
    eras: [],                 // [{ index, tick, name, snapshot, summary }]
    baselineAlive: 0,         // population at the most recent era boundary
    extinctionOpen: false,    // true while inside an extinction (awaiting recovery)
    events: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Main update — call once per tick                                   */
/* ------------------------------------------------------------------ */

/**
 * @param {object} engine
 * @param {Float32Array} view    particle buffer
 * @param {number} count         live particle count
 * @param {number} stride        PARTICLE_STRIDE
 * @param {object} opts          { tick, captureFn }
 *   captureFn() → a restorable snapshot (caller supplies captureWorldState).
 * @returns {Array} events drained this tick
 */
export function updateEpoch(engine, view, count, stride, opts = {}) {
  engine.frame++;
  engine.events.length = 0;

  const alive = countAlive(view, count, stride);
  const tick = opts.tick ?? engine.frame;

  // Initialise the baseline lazily on the first live sample.
  if (engine.baselineAlive <= 0) engine.baselineAlive = Math.max(1, alive);

  // ── Era boundary ──
  const epochLength = Math.max(1, engine.cfg.epochLength);
  if (tick > 0 && tick % epochLength === 0) {
    advanceEra(engine, alive, tick, opts.captureFn);
  }

  // ── Extinction / recovery (population deltas vs. the era baseline) ──
  const ratio = alive / Math.max(1, engine.baselineAlive);
  if (!engine.extinctionOpen && ratio < engine.cfg.extinctionThreshold) {
    engine.extinctionOpen = true;
    engine.events.push({
      type: 'epoch:extinction',
      era: engine.era,
      tick,
      alive,
      baseline: engine.baselineAlive,
    });
  } else if (engine.extinctionOpen && ratio >= engine.cfg.recoveryThreshold) {
    engine.extinctionOpen = false;
    engine.baselineAlive = Math.max(1, alive); // rebase on recovery
    engine.events.push({
      type: 'epoch:recovery',
      era: engine.era,
      tick,
      alive,
      baseline: engine.baselineAlive,
    });
  }

  return engine.events;
}

/* ------------------------------------------------------------------ */
/*  Era lifecycle                                                      */
/* ------------------------------------------------------------------ */

function advanceEra(engine, alive, tick, captureFn) {
  const index = engine.era;
  const name = ERA_NAMES[index % ERA_NAMES.length];
  const snapshot = typeof captureFn === 'function' ? captureFn() : null;

  engine.eras.push({
    index,
    tick,
    name,
    snapshot,
    summary: { alive, tick },
  });
  // Cap the navigable history — oldest eras evicted (full snapshots are ~1 MB).
  while (engine.eras.length > EPOCH_CAP) engine.eras.shift();

  engine.era++;
  engine.baselineAlive = Math.max(1, alive);
  engine.extinctionOpen = false;

  // The boundary announces the NEW era (the just-closed era is what we snapshotted).
  const nextIndex = engine.era;
  engine.events.push({
    type: 'epoch:boundary',
    era: nextIndex,
    tick,
    name: ERA_NAMES[nextIndex % ERA_NAMES.length],
    summary: { alive, tick },
  });
}

/* ------------------------------------------------------------------ */
/*  Query / restore                                                    */
/* ------------------------------------------------------------------ */

/** Compact era list (no snapshot payloads) for a timeline UI. */
export function getEpochs(engine) {
  return engine.eras.map((e) => ({
    index: e.index,
    tick: e.tick,
    name: e.name,
    summary: e.summary,
  }));
}

/** Return the stored snapshot for an era index, or null. */
export function getEpochSnapshot(engine, eraIndex) {
  const era = engine.eras.find((e) => e.index === eraIndex);
  return era ? era.snapshot : null;
}

/** Reset engine state on simulation restart. */
export function resetEpoch(engine) {
  engine.frame = 0;
  engine.era = 0;
  engine.eras.length = 0;
  engine.baselineAlive = 0;
  engine.extinctionOpen = false;
  engine.events.length = 0;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function countAlive(view, count, stride) {
  let alive = 0;
  const n = Math.max(0, Math.min(count, view ? (view.length / stride) | 0 : 0));
  for (let i = 0; i < n; i++) {
    const b = i * stride;
    if (view[b + STRIDE_INDEXES.DEAD] < 0.5 && (view[b + STRIDE_INDEXES.MASS] || 0) > 0) alive++;
  }
  return alive;
}
