export const LIFECYCLE_AUDIT_SCHEMA = 'vepa.energy-lifecycle-audit';
export const LIFECYCLE_AUDIT_VERSION = 1;

const finite = (v, label) => {
  if (!Number.isFinite(v)) throw new RangeError(label + ' must be finite');
  return v === 0 ? 0 : v;
};
const label = (v, name) => {
  if (typeof v !== 'string' || !v.trim()) throw new TypeError(name + ' must be a non-empty string');
  return v;
};
const KINDS = new Set([
  'particle-created', 'particle-retired', 'accretion', 'external-work',
  'boundary-work', 'boundary-flux', 'magnetic-field-work', 'radiation-work',
  'radiation-momentum-exchange', 'source-work', 'substep-transfer',
]);

/**
 * Append-only source/lifecycle evidence. Signed deltas describe the measured
 * participant's change; they are not silently converted into ledger transfers.
 */
export function createEnergyLifecycleAudit({ capacity = 10000, snapshot = null } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
  let sequence = 0, events = [];
  if (snapshot !== null) {
    if (!snapshot || snapshot.schema !== LIFECYCLE_AUDIT_SCHEMA || snapshot.version !== LIFECYCLE_AUDIT_VERSION ||
        !Number.isInteger(snapshot.sequence) || !Array.isArray(snapshot.events) ||
        snapshot.events.length > capacity) throw new TypeError('Invalid lifecycle audit snapshot');
    let last = 0;
    events = snapshot.events.map(event => {
      if (!Number.isInteger(event.sequence) || event.sequence <= last ||
          !Number.isInteger(event.tick) || event.tick < 0 || !KINDS.has(event.kind) ||
          typeof event.sourceId !== 'string' || !event.sourceId ||
          !Number.isFinite(event.massDelta) || !Number.isFinite(event.kineticEnergyDelta) ||
          !Array.isArray(event.momentumDelta) || event.momentumDelta.length !== 3 ||
          event.momentumDelta.some(v => !Number.isFinite(v))) throw new TypeError('Invalid lifecycle audit event');
      last = event.sequence;
      return Object.freeze(structuredClone(event));
    });
    if (last !== snapshot.sequence) throw new TypeError('Lifecycle audit sequence mismatch');
    sequence = last;
  }
  function record(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('event must be an object');
    if (!KINDS.has(input.kind)) throw new RangeError('Unsupported lifecycle audit event kind');
    const tick = input.tick;
    if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
    const sourceId = label(input.sourceId, 'sourceId');
    const event = Object.freeze({
      sequence: sequence + 1, tick, kind: input.kind, sourceId,
      entityId: input.entityId == null ? null : label(input.entityId, 'entityId'),
      targetId: input.targetId == null ? null : label(input.targetId, 'targetId'),
      massDelta: finite(input.massDelta ?? 0, 'massDelta'),
      kineticEnergyDelta: finite(input.kineticEnergyDelta ?? 0, 'kineticEnergyDelta'),
      thermalEnergyDelta: finite(input.thermalEnergyDelta ?? 0, 'thermalEnergyDelta'),
      chemicalEnergyDelta: finite(input.chemicalEnergyDelta ?? 0, 'chemicalEnergyDelta'),
      radiationEnergyDelta: finite(input.radiationEnergyDelta ?? 0, 'radiationEnergyDelta'),
      momentumDelta: Object.freeze((input.momentumDelta ?? [0, 0, 0]).map((v, i) => finite(v, 'momentumDelta[' + i + ']'))),
      work: input.work == null ? null : finite(input.work, 'work'),
      energyUnit: input.energyUnit == null ? null : label(input.energyUnit, 'energyUnit'),
      provenance: input.provenance == null ? null : structuredClone(input.provenance),
      metadata: input.metadata == null ? null : structuredClone(input.metadata),
    });
    if (event.momentumDelta.length !== 3) throw new TypeError('momentumDelta must contain three components');
    if (events.length >= capacity) throw new RangeError('Lifecycle audit capacity exceeded');
    events.push(event); sequence++;
    return event;
  }
  function snapshotState() {
    return Object.freeze({ schema: LIFECYCLE_AUDIT_SCHEMA, version: LIFECYCLE_AUDIT_VERSION,
      sequence, events: Object.freeze(events.map(e => Object.freeze(structuredClone(e)))) });
  }
  return Object.freeze({
    record,
    list({ afterSequence = 0, kind = null, sourceId = null } = {}) {
      if (!Number.isInteger(afterSequence) || afterSequence < 0) throw new RangeError('afterSequence must be non-negative');
      return Object.freeze(events.filter(e => e.sequence > afterSequence && (kind === null || e.kind === kind) &&
        (sourceId === null || e.sourceId === sourceId)).map(e => Object.freeze(structuredClone(e))));
    },
    summary() {
      const byKind = {};
      for (const e of events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      return Object.freeze({ schema: LIFECYCLE_AUDIT_SCHEMA, version: LIFECYCLE_AUDIT_VERSION,
        eventCount: events.length, byKind: Object.freeze(byKind), sequence });
    },
    createSnapshot: snapshotState,
    exportJSON() { return JSON.stringify(snapshotState(), null, 2); },
  });
}
