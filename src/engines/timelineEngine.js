/**
 * VEPA v3 — Timeline Engine
 * State snapshots and replay/scrub capabilities.
 *
 * Snapshots capture a lightweight state payload (particle buffer slice,
 * metadata, tick number) so the simulation can be rewound or replayed.
 * Circular buffer limits memory use via maxSnapshots.
 *
 * Emits: timeline:snapshot  { index, tick, timestamp, metadata }
 *        timeline:scrubbed  { index, tick, timestamp }
 */

const DEFAULTS = {
  maxSnapshots: 100,
  autoSnapshotInterval: 0,   // 0 = disabled; set >0 to auto-snapshot every N frames
};

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a timeline engine instance.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {object} [config]
 * @returns {object} Engine handle.
 */
export function createTimelineEngine(bus, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const engine = {
    bus,
    cfg,
    snapshots: [],         // circular buffer of {tick, timestamp, data, metadata}
    frame: 0,
    nextIndex: 0,
    isScrubbing: false,    // true while restoring from a snapshot
  };

  return engine;
}

/* ------------------------------------------------------------------ */
/*  Snapshot                                                           */
/* ------------------------------------------------------------------ */

/**
 * Save a state snapshot.  `state` can be any serialisable value — the
 * caller decides what to capture (typically a Float32Array slice or a
 * plain-object summary).
 *
 * @param {object} engine
 * @param {object} state       The state payload to store.
 * @param {object} [metadata]  Optional extra info (e.g. { particleCount, laws }).
 * @returns {number} Index of the saved snapshot.
 */
export function snapshot(engine, state, metadata) {
  const entry = {
    index:     engine.nextIndex,
    tick:      engine.frame,
    timestamp: Date.now(),
    data:      state,
    metadata:  metadata || null,
  };

  engine.snapshots.push(entry);

  // Circular buffer eviction
  if (engine.snapshots.length > engine.cfg.maxSnapshots) {
    engine.snapshots.shift();
  }

  const savedIndex = engine.nextIndex;
  engine.nextIndex++;

  engine.bus.emit('timeline:snapshot', {
    index:     savedIndex,
    tick:      entry.tick,
    timestamp: entry.timestamp,
    metadata:  entry.metadata,
  });

  return savedIndex;
}

/* ------------------------------------------------------------------ */
/*  Scrub — restore state from a snapshot                              */
/* ------------------------------------------------------------------ */

/**
 * Retrieve a snapshot by index and mark the engine as scrubbing.
 * Returns the stored state (or null if not found).  The orchestrator
 * is responsible for actually applying the state to buffers.
 *
 * @param {object} engine
 * @param {number} tickIndex   The snapshot index (as returned by snapshot()).
 * @returns {object|null}      The snapshot entry, or null.
 */
export function scrub(engine, tickIndex) {
  const entry = engine.snapshots.find((s) => s.index === tickIndex);
  if (!entry) return null;

  engine.isScrubbing = true;

  engine.bus.emit('timeline:scrubbed', {
    index:     entry.index,
    tick:      entry.tick,
    timestamp: entry.timestamp,
  });

  return entry;
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

/**
 * Return a lightweight list of all snapshots (without data payloads)
 * suitable for a timeline UI.
 *
 * @param {object} engine
 * @returns {Array<{index, tick, timestamp, metadata}>}
 */
export function getTimeline(engine) {
  return engine.snapshots.map((s) => ({
    index:     s.index,
    tick:      s.tick,
    timestamp: s.timestamp,
    metadata:  s.metadata,
  }));
}

/**
 * Get a snapshot by index (with data payload).
 */
export function getSnapshot(engine, tickIndex) {
  return engine.snapshots.find((s) => s.index === tickIndex) || null;
}

/**
 * Get the most recent snapshot.
 */
export function getLatest(engine) {
  return engine.snapshots.length > 0
    ? engine.snapshots[engine.snapshots.length - 1]
    : null;
}

/**
 * Clear all snapshots and reset the timeline.
 */
export function clearTimeline(engine) {
  engine.snapshots = [];
  engine.nextIndex = 0;
  engine.isScrubbing = false;
}

/* ------------------------------------------------------------------ */
/*  Frame tracking (call from main loop)                               */
/* ------------------------------------------------------------------ */

/**
 * Advance the internal frame counter.  Also auto-snapshots if configured.
 *
 * @param {object}  engine
 * @param {object}  [currentState]  Required if autoSnapshotInterval > 0.
 * @param {object}  [metadata]
 */
export function tick(engine, currentState, metadata) {
  engine.frame++;

  if (engine.cfg.autoSnapshotInterval > 0 && currentState) {
    if (engine.frame % engine.cfg.autoSnapshotInterval === 0) {
      snapshot(engine, currentState, metadata);
    }
  }
}
