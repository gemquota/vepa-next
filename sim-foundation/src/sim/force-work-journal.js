export const FORCE_WORK_SCHEMA = 'vepa.force-work-journal';
export const FORCE_WORK_VERSION = 1;
const finite = (v, label) => {
  if (!Number.isFinite(v)) throw new RangeError(label + ' must be finite');
  return v === 0 ? 0 : v;
};
const text = (v, label) => {
  if (typeof v !== 'string' || !v.trim()) throw new TypeError(label + ' must be non-empty');
  return v;
};

/** Bounded evidence of pair potential changes for the exact softened, finite-cutoff solver kernel. */
export function createForceWorkJournal({ capacity = 50000, snapshot = null } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be positive');
  let sequence = 0, events = [];
  if (snapshot !== null) {
    if (!snapshot || snapshot.schema !== FORCE_WORK_SCHEMA || snapshot.version !== FORCE_WORK_VERSION ||
        !Number.isInteger(snapshot.sequence) || !Array.isArray(snapshot.events) || snapshot.events.length > capacity) {
      throw new TypeError('Invalid force-work snapshot');
    }
    let previous = 0;
    events = snapshot.events.map(e => {
      if (!Number.isInteger(e.sequence) || e.sequence <= previous ||
          e.kind !== 'pair-force-work' || !['gravity', 'electric'].includes(e.law) ||
          typeof e.worldId !== 'string' || typeof e.entityA !== 'string' || typeof e.entityB !== 'string' ||
          !Number.isInteger(e.substepIndex) || e.substepIndex < 0) throw new TypeError('Invalid force-work event');
      for (const k of ['potentialBefore','potentialAfter','potentialDelta','conservativeWork']) finite(e[k], k);
      previous = e.sequence;
      return Object.freeze(structuredClone(e));
    });
    if (previous !== snapshot.sequence) throw new TypeError('Force-work sequence mismatch');
    sequence = previous;
  }
  function normalize(e, seq) {
    if (!e || e.kind !== 'pair-force-work' || !['gravity','electric'].includes(e.law)) throw new TypeError('Invalid pair force-work event');
    if (!Number.isInteger(e.substepIndex) || e.substepIndex < 0) throw new RangeError('Invalid substep index');
    const before = finite(e.potentialBefore, 'potentialBefore');
    const after = finite(e.potentialAfter, 'potentialAfter');
    const delta = finite(e.potentialDelta, 'potentialDelta');
    const work = finite(e.conservativeWork, 'conservativeWork');
    if (Math.abs((after - before) - delta) > 1e-10 * Math.max(1, Math.abs(before), Math.abs(after)) ||
        Math.abs(work + delta) > 1e-10 * Math.max(1, Math.abs(work), Math.abs(delta))) throw new RangeError('Inconsistent force-work values');
    return Object.freeze({ sequence: seq, kind: e.kind, law: e.law, worldId: text(e.worldId,'worldId'),
      entityA: text(e.entityA,'entityA'), entityB: text(e.entityB,'entityB'), pairId: text(e.pairId,'pairId'),
      substepIndex: e.substepIndex, potentialBefore: before, potentialAfter: after,
      potentialDelta: delta, conservativeWork: work });
  }
  return Object.freeze({
    appendBatch(batch) {
      if (!Array.isArray(batch) || events.length + batch.length > capacity) throw new RangeError('Invalid or over-capacity force-work batch');
      const next = batch.map((e,i) => normalize(e, sequence+i+1));
      events.push(...next); sequence += next.length;
      return Object.freeze(next.map(e => structuredClone(e)));
    },
    list({ afterSequence = 0, law = null, worldId = null } = {}) {
      if (!Number.isInteger(afterSequence) || afterSequence < 0) throw new RangeError('Invalid cursor');
      return Object.freeze(events.filter(e => e.sequence > afterSequence &&
        (law === null || e.law === law) && (worldId === null || e.worldId === worldId))
        .map(e => structuredClone(e)));
    },
    summary() {
      const byLaw = {};
      let conservativeWork = 0, potentialDelta = 0;
      for (const e of events) { byLaw[e.law] = (byLaw[e.law] ?? 0)+1; conservativeWork += e.conservativeWork; potentialDelta += e.potentialDelta; }
      return Object.freeze({ schema: FORCE_WORK_SCHEMA, version: FORCE_WORK_VERSION,
        eventCount: events.length, sequence, byLaw: Object.freeze(byLaw), conservativeWork, potentialDelta });
    },
    createSnapshot() { return Object.freeze({ schema: FORCE_WORK_SCHEMA, version: FORCE_WORK_VERSION,
      sequence, events: Object.freeze(events.map(e => structuredClone(e))) }); },
    exportJSON() { return JSON.stringify(this.createSnapshot(), null, 2); },
  });
}
