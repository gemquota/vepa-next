import { validateReplay } from './replay.js';

export const SNAPSHOT_SCHEMA = 'vepa.world-snapshot';
export const SNAPSHOT_SCHEMA_VERSION = 2;

const TYPED_ARRAYS = Object.freeze({
  Float32Array, Float64Array,
  Int8Array, Uint8Array, Uint8ClampedArray,
  Int16Array, Uint16Array,
  Int32Array, Uint32Array,
});

function canonicalize(value, seen = new WeakSet(), allowEncodedMarkers = false) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot numbers must be finite');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw new TypeError('Snapshot must contain JSON-compatible values');
  if (Object.hasOwn(value, '$vepaTypedArray')) {
    if (!allowEncodedMarkers) throw new TypeError('Snapshot payload key $vepaTypedArray is reserved');
    const keys = Object.keys(value).sort();
    const name = value.$vepaTypedArray;
    if (keys.length !== 2 || keys[0] !== '$vepaTypedArray' || keys[1] !== 'values' ||
        !Object.hasOwn(TYPED_ARRAYS, name) || !Array.isArray(value.values) ||
        value.values.some(item => typeof item !== 'number' || !Number.isFinite(item))) {
      throw new TypeError('Invalid typed-array snapshot encoding');
    }
    return { $vepaTypedArray: name, values: value.values.slice() };
  }
  if (ArrayBuffer.isView(value)) {
    const name = value.constructor?.name;
    if (!name || TYPED_ARRAYS[name] !== value.constructor || value instanceof DataView) {
      throw new TypeError('Snapshot contains an unsupported typed array');
    }
    if (seen.has(value)) throw new TypeError('Snapshot cannot contain cycles');
    seen.add(value);
    const values = Array.from(value, item => canonicalize(item, seen, allowEncodedMarkers));
    seen.delete(value);
    // "$vepaTypedArray" is reserved in snapshot payloads for typed-array encoding.
    return { $vepaTypedArray: name, values };
  }
  if (seen.has(value)) throw new TypeError('Snapshot cannot contain cycles');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Snapshot objects must be plain objects or arrays');
  }
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map(item => canonicalize(item, seen, allowEncodedMarkers));
  } else {
    // Preserve ordinary-object semantics while defining keys as data properties,
    // so a literal "__proto__" key cannot mutate the result's prototype.
    result = {};
    for (const key of Object.keys(value).sort()) {
      Object.defineProperty(result, key, {
        value: canonicalize(value[key], seen, allowEncodedMarkers),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  seen.delete(value);
  return result;
}


/**
 * Decode tagged numeric typed arrays from a validated snapshot payload.
 * Plain objects are rebuilt with data-property definitions so "__proto__"
 * remains data rather than changing the result's prototype.
 */
export function restoreSnapshotValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(restoreSnapshotValue);
  const keys = Object.keys(value).sort();
  if (keys.length === 2 && keys[0] === '$vepaTypedArray' && keys[1] === 'values') {
    const Constructor = Object.hasOwn(TYPED_ARRAYS, value.$vepaTypedArray)
      ? TYPED_ARRAYS[value.$vepaTypedArray]
      : null;
    if (!Constructor || !Array.isArray(value.values)) {
      throw new TypeError('Invalid typed-array snapshot encoding');
    }
    for (const item of value.values) {
      if (typeof item !== 'number' || !Number.isFinite(item)) {
        throw new TypeError('Typed-array snapshot values must be finite numbers');
      }
    }
    return new Constructor(value.values);
  }
  const result = {};
  for (const key of keys) {
    Object.defineProperty(result, key, {
      value: restoreSnapshotValue(value[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}

export function canonicalSnapshotJson(value) {
  return JSON.stringify(canonicalize(value));
}

/**
 * Stable non-cryptographic checksum for accidental corruption detection.
 * This is not an authenticity signature and must not be used as a security boundary.
 */
function checksumText(text) {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export function snapshotChecksum(value) {
  const text = typeof value === 'string' ? value : canonicalSnapshotJson(value);
  return checksumText(text);
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
  journalEvents = undefined,
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
    ...(journalEvents === undefined ? {} : { journalEvents }),
  });
  return Object.freeze({ ...payload, checksum: checksumText(JSON.stringify(payload)) });
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
  if (Object.hasOwn(snapshot, 'journalEvents')) {
    const replay = validateReplay(snapshot.journalEvents, {
      worldId: snapshot.worldId,
      initialTick: 0,
      initialSequence: 0,
    });
    if (!replay.valid) errors.push('invalid-journal:' + JSON.stringify(replay.errors));
    else if ((snapshot.journalEvents.length ? replay.lastSequence : -1) !== snapshot.lastEventSequence) {
      errors.push('journal-cursor-mismatch');
    }
  }
  if (typeof snapshot.checksum !== 'string' || !/^[0-9a-f]{16}$/.test(snapshot.checksum)) {
    errors.push('invalid-checksum-format');
  } else {
    try {
      const { checksum, ...payload } = snapshot;
      const canonicalPayload = canonicalize(payload, new WeakSet(), true);
      if (checksumText(JSON.stringify(canonicalPayload)) !== checksum) errors.push('checksum-mismatch');
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
