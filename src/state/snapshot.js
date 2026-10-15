import { validateReplay } from './replay.js';

export const SNAPSHOT_SCHEMA = 'vepa.world-snapshot';
export const SNAPSHOT_SCHEMA_VERSION = 1;

function canonicalize(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot numbers must be finite');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw new TypeError('Snapshot must contain JSON-compatible values');
  if (seen.has(value)) throw new TypeError('Snapshot cannot contain cycles');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Snapshot objects must be plain objects or arrays');
  }
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map(item => canonicalize(item, seen));
  } else {
    result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(value[key], seen);
    }
  }
  seen.delete(value);
  return result;
}

export function canonicalSnapshotJson(value) {
  return JSON.stringify(canonicalize(value));
}

/**
 * Stable non-cryptographic checksum for accidental corruption detection.
 * This is not an authenticity signature and must not be used as a security boundary.
 */
export function snapshotChecksum(value) {
  const text = typeof value === 'string' ? value : canonicalSnapshotJson(value);
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export function createWorldSnapshot({
  worldId,
  tick,
  generation = 0,
  config = {},
  simulationState,
  prngState = null,
  fidelityPolicy = null,
  lastEventSequence = -1,
} = {}) {
  if (typeof worldId !== 'string' || !worldId) throw new TypeError('worldId is required');
  for (const [name, value] of Object.entries({ tick, generation, lastEventSequence })) {
    if (!Number.isInteger(value) || value < (name === 'lastEventSequence' ? -1 : 0)) {
      throw new RangeError(name + ' has an invalid integer value');
    }
  }
  const payload = canonicalize({
    schema: SNAPSHOT_SCHEMA,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    worldId,
    tick,
    generation,
    config,
    simulationState,
    prngState,
    fidelityPolicy,
    lastEventSequence,
  });
  return Object.freeze({ ...payload, checksum: snapshotChecksum(payload) });
}

export function validateWorldSnapshot(snapshot, { expectedWorldId } = {}) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { valid: false, errors: ['snapshot must be an object'] };
  }
  if (snapshot.schema !== SNAPSHOT_SCHEMA) errors.push('unsupported-schema');
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) errors.push('unsupported-schema-version');
  if (typeof snapshot.worldId !== 'string' || !snapshot.worldId) errors.push('invalid-world-id');
  if (expectedWorldId !== undefined && snapshot.worldId !== expectedWorldId) errors.push('wrong-world');
  for (const [name, value] of Object.entries({
    tick: snapshot.tick,
    generation: snapshot.generation,
    lastEventSequence: snapshot.lastEventSequence,
  })) {
    const min = name === 'lastEventSequence' ? -1 : 0;
    if (!Number.isInteger(value) || value < min) errors.push('invalid-' + name);
  }
  if (!Object.hasOwn(snapshot, 'config') || !Object.hasOwn(snapshot, 'simulationState')) {
    errors.push('missing-state-payload');
  }
  if (typeof snapshot.checksum !== 'string' || !/^[0-9a-f]{16}$/.test(snapshot.checksum)) {
    errors.push('invalid-checksum-format');
  } else {
    try {
      const { checksum, ...payload } = snapshot;
      if (snapshotChecksum(payload) !== checksum) errors.push('checksum-mismatch');
    } catch (error) {
      errors.push('invalid-payload:' + (error instanceof Error ? error.message : String(error)));
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validate a snapshot and an event suffix before a caller restores/replays it. */
export function validateSnapshotAndReplay(snapshot, events, { expectedWorldId } = {}) {
  const snapshotResult = validateWorldSnapshot(snapshot, { expectedWorldId });
  if (!snapshotResult.valid) {
    return { valid: false, reason: 'invalid-snapshot', snapshot: snapshotResult, replay: null };
  }
  const replayResult = validateReplay(events, {
    worldId: snapshot.worldId,
    initialTick: snapshot.tick,
    initialSequence: snapshot.lastEventSequence + 1,
  });
  return {
    valid: replayResult.valid,
    reason: replayResult.valid ? null : 'invalid-replay',
    snapshot: snapshotResult,
    replay: replayResult,
  };
}
