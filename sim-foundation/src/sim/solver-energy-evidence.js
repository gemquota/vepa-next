export const SOLVER_EVIDENCE_SCHEMA = 'vepa.solver-energy-evidence';
export const SOLVER_EVIDENCE_VERSION = 1;

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new RangeError(label + ' must be finite');
  return value === 0 ? 0 : value;
};
const nonEmpty = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(label + ' must be a non-empty string');
  return value;
};

/**
 * Deterministic bounded evidence journal for measured solver boundary effects.
 * Events report measured impulses/kinetic deltas; they do not infer unmodelled
 * wall compliance, external work, or periodic-image field energy.
 */
export function createSolverEnergyEvidence({ capacity = 20000, snapshot = null } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
  let sequence = 0, events = [];
  if (snapshot !== null) {
    if (!snapshot || snapshot.schema !== SOLVER_EVIDENCE_SCHEMA || snapshot.version !== SOLVER_EVIDENCE_VERSION ||
        !Number.isInteger(snapshot.sequence) || !Array.isArray(snapshot.events) || snapshot.events.length > capacity) {
      throw new TypeError('Invalid solver evidence snapshot');
    }
    let last = 0;
    events = snapshot.events.map(event => {
      if (!Number.isInteger(event.sequence) || event.sequence <= last ||
          !['reflective-wall-impulse', 'toroidal-wrap'].includes(event.kind) ||
          typeof event.worldId !== 'string' || !event.worldId || typeof event.entityId !== 'string' || !event.entityId ||
          !Number.isInteger(event.substepIndex) || event.substepIndex < 0 ||
          !['x', 'y', 'z'].includes(event.axis)) throw new TypeError('Invalid solver evidence event');
      for (const key of ['impulse', 'kineticEnergyDelta', 'work']) if (event[key] !== undefined && !Number.isFinite(event[key])) throw new TypeError('Invalid solver evidence numeric field');
      last = event.sequence;
      return Object.freeze(structuredClone(event));
    });
    if (last !== snapshot.sequence) throw new TypeError('Solver evidence sequence mismatch');
    sequence = last;
  }
  function normalize(input, nextSequence) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('evidence event must be an object');
    if (!['reflective-wall-impulse', 'toroidal-wrap'].includes(input.kind)) throw new RangeError('Unsupported solver evidence kind');
    const event = {
      sequence: nextSequence, kind: input.kind,
      worldId: nonEmpty(input.worldId, 'worldId'), entityId: nonEmpty(input.entityId, 'entityId'),
      substepIndex: input.substepIndex, particleIndex: input.particleIndex,
      axis: input.axis, work: finite(input.work ?? 0, 'work'),
    };
    if (!Number.isInteger(event.substepIndex) || event.substepIndex < 0) throw new RangeError('substepIndex must be non-negative');
    if (!Number.isInteger(event.particleIndex) || event.particleIndex < 0) throw new RangeError('particleIndex must be non-negative');
    if (!['x', 'y', 'z'].includes(event.axis)) throw new RangeError('axis must be x, y or z');
    if (input.kind === 'reflective-wall-impulse') {
      if (!['lower', 'upper'].includes(input.wall)) throw new RangeError('wall must be lower or upper');
      event.wall = input.wall;
      event.impulse = finite(input.impulse, 'impulse');
      event.kineticEnergyDelta = finite(input.kineticEnergyDelta, 'kineticEnergyDelta');
      event.position = finite(input.positionBefore, 'positionBefore');
    } else {
      event.positionBefore = finite(input.positionBefore, 'positionBefore');
      event.positionAfter = finite(input.positionAfter, 'positionAfter');
    }
    return Object.freeze(event);
  }
  function appendBatch(batch) {
    if (!Array.isArray(batch)) throw new TypeError('batch must be an array');
    if (events.length + batch.length > capacity) throw new RangeError('Solver evidence capacity exceeded');
    const normalized = batch.map((event, index) => normalize(event, sequence + index + 1));
    events.push(...normalized);
    sequence += normalized.length;
    return Object.freeze(normalized.map(event => Object.freeze(structuredClone(event))));
  }
  function createSnapshot() {
    return Object.freeze({ schema: SOLVER_EVIDENCE_SCHEMA, version: SOLVER_EVIDENCE_VERSION, sequence,
      events: Object.freeze(events.map(event => Object.freeze(structuredClone(event)))) });
  }
  return Object.freeze({
    appendBatch,
    list({ afterSequence = 0, kind = null, worldId = null } = {}) {
      if (!Number.isInteger(afterSequence) || afterSequence < 0) throw new RangeError('afterSequence must be non-negative');
      return Object.freeze(events.filter(event => event.sequence > afterSequence &&
        (kind === null || event.kind === kind) && (worldId === null || event.worldId === worldId))
        .map(event => Object.freeze(structuredClone(event))));
    },
    summary() {
      const byKind = {};
      for (const event of events) byKind[event.kind] = (byKind[event.kind] ?? 0) + 1;
      return Object.freeze({ schema: SOLVER_EVIDENCE_SCHEMA, version: SOLVER_EVIDENCE_VERSION,
        eventCount: events.length, sequence, byKind: Object.freeze(byKind) });
    },
    createSnapshot,
    exportJSON() { return JSON.stringify(createSnapshot(), null, 2); },
  });
}
