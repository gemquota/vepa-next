/**
 * VEPA v3 — Goal Engine
 * Auto-tunes world parameters to steer the simulation toward target
 * stability, complexity, and diversity levels.  Evaluates current
 * metrics against goals and emits goal:adjusted events with proposed
 * parameter changes.
 *
 * Goals (normalised 0–1):
 *   stability  — how steady the particle population is
 *   complexity — richness of law interactions and cluster formation
 *   diversity  — number of active species relative to max
 *
 * The engine does NOT apply changes directly — it emits events for the
 * orchestrator to evaluate and commit.
 */

const DEFAULTS = {
  evaluationInterval: 120,   // frames between evaluations
  stabilityTarget:   0.6,
  complexityTarget:  0.5,
  diversityTarget:   0.5,
  stepSize:          0.05,   // max fractional adjustment per cycle
  parameters: [
    {
      name: 'clusterRadius',
      path: 'insight.clusterRadius',
      min:  20,
      max:  150,
      goal: 'complexity',    // which goal this knob serves
      direction:  1,         // +1 = increase helps goal, -1 = decrease helps
    },
    {
      name: 'birthRate',
      path: 'world.birthRate',
      min:  0.01,
      max:  1.0,
      goal: 'diversity',
      direction:  1,
    },
    {
      name: 'deathRate',
      path: 'world.deathRate',
      min:  0.01,
      max:  1.0,
      goal: 'stability',
      direction: -1,         // lower death → more stability
    },
    {
      name: 'maxForce',
      path: 'world.maxForce',
      min:  5.0,
      max:  80.0,
      goal: 'complexity',
      direction:  1,
    },
    {
      name: 'drag',
      path: 'world.drag',
      min:  0.8,
      max:  1.0,
      goal: 'stability',
      direction:  1,         // higher drag → more stability
    },
    {
      name: 'scanInterval',
      path: 'insight.scanInterval',
      min:  10,
      max:  120,
      goal: 'complexity',
      direction: -1,         // shorter scan → more reactive
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a goal engine instance.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {object} [config]  Override any DEFAULTS key.
 * @returns {object} Engine handle.
 */
export function createGoalEngine(bus, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const engine = {
    bus,
    cfg,
    frame: 0,
    goals: {
      stability:  cfg.stabilityTarget,
      complexity: cfg.complexityTarget,
      diversity:  cfg.diversityTarget,
    },
    currentValues: {},        // name → current value (populated on first update)
    history: [],              // array of {timestamp, adjustments}
  };

  return engine;
}

/* ------------------------------------------------------------------ */
/*  Main update — call each frame                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object}  engine
 * @param {object}  metrics  Current simulation metrics, e.g.
 *                           { populationAlive, speciesAlive, clusterCount,
 *                             avgEnergy, frameDelta, lawActiveCount }
 */
export function update(engine, metrics) {
  engine.frame++;
  if (engine.frame % engine.cfg.evaluationInterval !== 0) return;

  const score = evaluateGoals(engine.goals, metrics);
  const adjustments = [];

  for (const param of engine.cfg.parameters) {
    const currentVal = engine.currentValues[param.name];
    if (currentVal === undefined) continue;

    const gap = score[param.goal] - engine.goals[param.goal];
    if (Math.abs(gap) < 0.02) continue;              // close enough

    // Move in the direction that closes the gap
    const desired = gap > 0 ? param.direction : -param.direction;
    const range = param.max - param.min;
    const delta = desired * engine.cfg.stepSize * range;
    let newVal = currentVal + delta;
    newVal = Math.max(param.min, Math.min(param.max, newVal));

    if (newVal === currentVal) continue;

    const adjustment = {
      parameter: param.name,
      path:      param.path,
      oldValue:  currentVal,
      newValue:  newVal,
      reason:    `${param.goal} score ${(score[param.goal] * 100).toFixed(0)}% vs target ${(engine.goals[param.goal] * 100).toFixed(0)}%`,
    };

    adjustments.push(adjustment);
    engine.currentValues[param.name] = newVal;
    engine.bus.emit('goal:adjusted', adjustment);
  }

  if (adjustments.length > 0) {
    engine.history.push({ timestamp: engine.frame, adjustments });
  }
}

/* ------------------------------------------------------------------ */
/*  Metric evaluation (normalised 0–1)                                 */
/* ------------------------------------------------------------------ */

function evaluateGoals(targets, metrics) {
  const maxParticles = 10000;
  const maxSpecies   = 64;
  const maxLaws      = 64;

  // Stability: ratio of alive to total, penalised by extreme frame deltas
  const aliveRatio   = Math.min(1, (metrics.populationAlive || 0) / maxParticles);
  const frameDelta   = Math.abs(metrics.frameDelta || 0);
  const stabilityPenalty = Math.min(1, frameDelta / 500);
  const stability    = Math.max(0, Math.min(1, aliveRatio - stabilityPenalty * 0.3));

  // Complexity: cluster count normalised + active law fraction
  const clusterScore  = Math.min(1, (metrics.clusterCount || 0) / 20);
  const lawScore      = Math.min(1, (metrics.lawActiveCount || 0) / maxLaws);
  const complexity    = (clusterScore * 0.5 + lawScore * 0.5);

  // Diversity: species alive / max species
  const diversity     = Math.min(1, (metrics.speciesAlive || 0) / maxSpecies);

  return { stability, complexity, diversity };
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Update a tracked parameter value (call when orchestrator commits a change).
 */
export function setCurrentValue(engine, paramName, value) {
  engine.currentValues[paramName] = value;
}

/**
 * Get current goal targets.
 */
export function getGoals(engine) {
  return { ...engine.goals };
}

/**
 * Get recent adjustment history.
 */
export function getHistory(engine) {
  return engine.history.slice();
}
