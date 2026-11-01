/**
 * VEPA v3 — Narrative Engine
 * 4-voice internal monologue that consumes simulation events and produces
 * themed commentary.  Each voice has a distinct personality and colour.
 *
 *   Stabilizer (blue)   — seeks order, worries about collapse
 *   Diverger   (red)    — celebrates novelty, pushes boundaries
 *   Observer   (green)  — neutral, analytical, pattern-focused
 *   Dissolver  (purple) — embraces entropy, watches things end
 *
 * Consume events: cluster:detected, law:toggled, lineage:branch, goal:adjusted
 * Emit:           narrative:entry  { voice, text, timestamp }
 */

const VOICES = {
  stabilizer:  { name: 'Stabilizer',  color: '#4488ff', key: 'stabilizer'  },
  diverger:    { name: 'Diverger',    color: '#ff4444', key: 'diverger'    },
  observer:    { name: 'Observer',    color: '#44cc66', key: 'observer'    },
  dissolver:   { name: 'Dissolver',   color: '#aa55dd', key: 'dissolver'   },
};

const DEFAULTS = {
  cooldown: 15,          // minimum frames between entries from the same voice
  globalCooldown: 45,    // minimum frames between ANY entry (v8.1.1 pacing)
  maxQueue: 20,          // max events to buffer before dropping oldest
};

/* ------------------------------------------------------------------ */
/*  Template pools — one array per voice x event type                  */
/*  Each template is a function(data) -> string                       */
/* ------------------------------------------------------------------ */

const TEMPLATES = {
  cluster: {
    stabilizer: [
      (d) => `A colony of ${d.count} coalesces at (${fmt(d.center)}). Unity strengthens.`,
      (d) => `Order emerges — ${d.count} bodies draw near. The lattice holds.`,
      (d) => `${d.count} particles converge. Stability increases.`,
    ],
    diverger: [
      (d) => `A burst of ${d.count} — new alliances forming at (${fmt(d.center)}). Exciting.`,
      (d) => `${d.count} bodies swarm! Species ${d.speciesId} experiments with proximity.`,
      (d) => `Chaos births a cluster of ${d.count}. Novelty detected.`,
    ],
    observer: [
      (d) => `Cluster detected: ${d.count} particles, species ${d.speciesId}, avg energy ${d.avgEnergy.toFixed(1)}.`,
      (d) => `Spatio-temporal grouping — ${d.count} units within radius. Centre: (${fmt(d.center)}).`,
      (d) => `Pattern: ${d.count}-body cluster, energy ${d.avgEnergy.toFixed(1)}.`,
    ],
    dissolver: [
      (d) => `A brief gathering of ${d.count}. It will scatter, as all things do.`,
      (d) => `${d.count} cling together at (${fmt(d.center)}). Entropy remembers this place.`,
      (d) => `Transient cluster — ${d.count} units. Enjoy the closeness.`,
    ],
  },

  law: {
    stabilizer: [
      (d) => `The law "${d.name}" is engaged. Rules protect us from chaos.`,
      (d) => `Laws tighten. "${d.name}" now active — order is enforced.`,
    ],
    diverger: [
      (d) => `"${d.name}" toggled — new possibilities unfold!`,
      (d) => `Breaking conventions: "${d.name}" shifts state. Let's see what happens.`,
    ],
    observer: [
      (d) => `Law state change: "${d.name}" → ${d.value}. Recalculating dynamics.`,
      (d) => `Toggle event — "${d.name}" now at ${d.value}.`,
    ],
    dissolver: [
      (d) => `"${d.name}" changes. The old framework crumbles.`,
      (d) => `Even the laws are mutable. "${d.name}" is no longer what it was.`,
    ],
  },

  lineage: {
    stabilizer: [
      (d) => `A new life: particle ${d.childId} born to species ${d.species}. Continuity secured.`,
      (d) => `Generation ${d.generation} continues. Birth at index ${d.childId}.`,
    ],
    diverger: [
      (d) => `Mutation blooms! Particle ${d.childId} arrives — what will it become?`,
      (d) => `New life bursts forth: ${d.childId}, species ${d.species}. Evolution accelerates.`,
    ],
    observer: [
      (d) => `Birth event: parent ${d.parentId} → child ${d.childId}, species ${d.species}, gen ${d.generation}.`,
      (d) => `Reproduction recorded — particle ${d.childId} added to species ${d.species}.`,
    ],
    dissolver: [
      (d) => `Another particle enters the cycle. ${d.childId} will return to nothing, in time.`,
      (d) => `Birth and death are mirrors. Welcome, ${d.childId}.`,
    ],
  },

  goal: {
    stabilizer: [
      (d) => `Adjusting "${d.parameter}" toward equilibrium. Reason: ${d.reason}.`,
      (d) => `Self-correction: "${d.parameter}" ${d.oldValue.toFixed(2)} → ${d.newValue.toFixed(2)}.`,
    ],
    diverger: [
      (d) => `Pushing "${d.parameter}" into new territory. Reason: ${d.reason}.`,
      (d) => `Exploration: "${d.parameter}" shifts ${d.oldValue.toFixed(2)} → ${d.newValue.toFixed(2)}.`,
    ],
    observer: [
      (d) => `Goal adjustment — "${d.parameter}" ${d.oldValue.toFixed(2)} → ${d.newValue.toFixed(2)} (${d.reason}).`,
    ],
    dissolver: [
      (d) => `"${d.parameter}" drifts. Nothing holds still. ${d.reason}.`,
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a narrative engine instance.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {object} [config]
 * @returns {object} Engine handle.
 */
export function createNarrativeEngine(bus, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const engine = {
    bus,
    cfg,
    lastFrame: {},          // voiceKey -> last frame a narration was emitted
    lastEmit: 0,            // last frame ANY narration was emitted (global pace)
    frame: 0,
    recentEvents: [],       // ring buffer of recent events
    entries: [],            // all emitted narrative entries
  };

  // Wire up event subscriptions
  bus.on('cluster:detected', (data) => {
    // Templates expect a single cluster payload ({count, speciesId,
    // avgEnergy, center}); the insight engine emits {timestamp, clusters[]},
    // so narrate the largest cluster.
    if (data && Array.isArray(data.clusters) && data.clusters.length > 0) {
      const biggest = data.clusters.reduce((a, b) => (b.count > a.count ? b : a));
      pushEvent(engine, 'cluster', { ...biggest, timestamp: data.timestamp });
    }
  });
  bus.on('law:toggled',      (data) => pushEvent(engine, 'law',     data));
  bus.on('lineage:branch',   (data) => pushEvent(engine, 'lineage', data));
  // v8.1.1: insight-internal tuning (scanInterval/clusterRadius) has no
  // visible effect — narrating it was noise. Only user-visible knobs are
  // worth a log line.
  bus.on('goal:adjusted', (data) => {
    if (data && (data.parameter === 'scanInterval' || data.parameter === 'clusterRadius')) return;
    pushEvent(engine, 'goal', data);
  });

  return engine;
}

/* ------------------------------------------------------------------ */
/*  Update — called each frame from the main loop                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object}  engine
 * @param {Float32Array} particleBuffer   (kept for API parity)
 * @param {number}  particleCount
 * @param {number}  stride
 */
export function update(engine, particleBuffer, particleCount, stride) {
  engine.frame++;

  // v8.1.1: global pacing — at most one entry per globalCooldown frames.
  // Queued events accumulated while cooling down are dropped (transient
  // commentary) so the log never floods.
  if (engine.frame - engine.lastEmit < engine.cfg.globalCooldown) {
    engine.recentEvents.length = 0;
    return;
  }

  // Process one event per frame (if any) to pace the narrative
  while (engine.recentEvents.length > 0) {
    const evt = engine.recentEvents.shift();
    if (emitNarrative(engine, evt)) {
      engine.lastEmit = engine.frame;
      break;    // one narration per frame
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function pushEvent(engine, type, data) {
  engine.recentEvents.push({ type, data, frame: engine.frame });
  if (engine.recentEvents.length > engine.cfg.maxQueue) {
    engine.recentEvents.shift();
  }
}

function emitNarrative(engine, evt) {
  const voiceKeys = Object.keys(VOICES);
  // Pick a random voice (could be weighted in future)
  const voiceKey = voiceKeys[Math.floor(Math.random() * voiceKeys.length)];

  // Cooldown check
  const last = engine.lastFrame[voiceKey] || 0;
  if (engine.frame - last < engine.cfg.cooldown) return false;

  const pool = TEMPLATES[evt.type] && TEMPLATES[evt.type][voiceKey];
  if (!pool || pool.length === 0) return false;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const text = pick(evt.data);
  const voice = VOICES[voiceKey];

  const entry = { voice: voice.name, color: voice.color, text, timestamp: engine.frame };
  engine.entries.push(entry);
  engine.lastFrame[voiceKey] = engine.frame;

  engine.bus.emit('narrative:entry', entry);
  return true;
}

function fmt(obj) {
  if (!obj) return '?, ?, ?';
  return `${(obj.x || 0).toFixed(0)}, ${(obj.y || 0).toFixed(0)}, ${(obj.z || 0).toFixed(0)}`;
}
