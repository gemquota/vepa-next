import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalSnapshotJson,
  SNAPSHOT_SCHEMA_VERSION,
  createWorldSnapshot,
  snapshotChecksum,
  validateSnapshotAndReplay,
  validateWorldSnapshot,
  restoreSnapshotValue,
} from '../../src/state/snapshot.js';
import { createEventEnvelope } from '../../src/core/event-envelope.js';

function event(sequence, tick = sequence) {
  return createEventEnvelope({
    eventId: 'w-1:' + sequence,
    type: 'world.counter-incremented',
    schemaVersion: 1,
    worldId: 'w-1',
    tick,
    sequence,
    sourceModule: 'test.counter',
    payload: { amount: 1 },
  });
}

function snapshot(overrides = {}) {
  return createWorldSnapshot({
    worldId: 'w-1',
    tick: 4,
    generation: 2,
    config: { z: 1, a: { y: 2, x: 1 } },
    simulationState: { particles: [1, 2, 3] },
    prngState: { state: 42 },
    lastEventSequence: 4,
    ...overrides,
  });
}

test('canonical snapshot JSON sorts object keys consistently', () => {
  assert.equal(canonicalSnapshotJson({ z: 1, a: 2 }), canonicalSnapshotJson({ a: 2, z: 1 }));
  assert.equal(snapshotChecksum({ z: 1, a: 2 }), snapshotChecksum({ a: 2, z: 1 }));
});

test('snapshot is versioned and validates with a matching checksum', () => {
  const value = snapshot();
  assert.equal(value.schema, 'vepa.world-snapshot');
  assert.equal(value.schemaVersion, SNAPSHOT_SCHEMA_VERSION);
  assert.equal(validateWorldSnapshot(value, { expectedWorldId: 'w-1' }).valid, true);
});

test('snapshot detects accidental payload modification', () => {
  const value = snapshot();
  const tampered = { ...value, simulationState: { particles: [9, 9, 9] } };
  const result = validateWorldSnapshot(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('checksum-mismatch'));
});

test('snapshot rejects wrong world, unsupported version and malformed tick', () => {
  const value = snapshot();
  assert.ok(validateWorldSnapshot(value, { expectedWorldId: 'other' }).errors.includes('wrong-world'));
  assert.ok(validateWorldSnapshot({ ...value, schemaVersion: 99 }).errors.includes('unsupported-schema-version'));
  assert.ok(validateWorldSnapshot({ ...value, tick: -1 }).errors.includes('invalid-tick'));
});

test('snapshot creation rejects cycles, non-finite values and invalid counters', () => {
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => snapshot({ simulationState: cyclic }), /cycles/);
  assert.throws(() => snapshot({ simulationState: { value: Infinity } }), /finite/);
  assert.throws(() => snapshot({ tick: -1 }), /tick/);
});

test('snapshot can anchor a contiguous replay suffix', () => {
  const value = snapshot({ tick: 4, lastEventSequence: 4 });
  const result = validateSnapshotAndReplay(value, [event(5, 5), event(6, 6)], { expectedWorldId: 'w-1' });
  assert.equal(result.valid, true);
  assert.equal(result.replay.lastSequence, 6);
});

test('snapshot/replay validation rejects a gap after the checkpoint', () => {
  const value = snapshot({ tick: 4, lastEventSequence: 4 });
  const result = validateSnapshotAndReplay(value, [event(6, 6)], { expectedWorldId: 'w-1' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid-replay');
});

test('canonical snapshot JSON preserves special object keys as data', () => {
  const value = JSON.parse('{"__proto__":{"safe":true},"constructor":"value"}');
  const encoded = canonicalSnapshotJson(value);
  assert.equal(encoded, '{"__proto__":{"safe":true},"constructor":"value"}');
  assert.equal(JSON.parse(encoded).__proto__.safe, true);
});


test('snapshot schema v2 encodes and restores typed-array simulation buffers', () => {
  const original = new Float32Array([0.25, -3, 7.5]);
  const value = snapshot({ simulationState: { positions: original } });
  assert.equal(value.schemaVersion, 2);
  assert.deepEqual(value.simulationState.positions, {
    $vepaTypedArray: 'Float32Array',
    values: [0.25, -3, 7.5],
  });
  const restored = restoreSnapshotValue(value.simulationState);
  assert.ok(restored.positions instanceof Float32Array);
  assert.deepEqual([...restored.positions], [0.25, -3, 7.5]);
  assert.equal(validateWorldSnapshot(value).valid, true);
});

test('typed-array snapshot encoding rejects non-finite buffer values and unsupported views', () => {
  assert.throws(() => snapshot({ simulationState: { positions: new Float32Array([NaN]) } }), /finite/);
  assert.throws(() => snapshot({ simulationState: { view: new DataView(new ArrayBuffer(4)) } }), /unsupported typed array/);
  assert.throws(() => restoreSnapshotValue({ $vepaTypedArray: 'DataView', values: [] }), /Invalid typed-array/);
});


test('typed-array decoder rejects inherited object property names as constructors', () => {
  assert.throws(
    () => restoreSnapshotValue({ $vepaTypedArray: 'constructor', values: [] }),
    /Invalid typed-array/,
  );
});


test('snapshot payloads cannot collide with the reserved typed-array marker', () => {
  assert.throws(
    () => snapshot({ simulationState: { $vepaTypedArray: 'Float32Array', values: [1, 2] } }),
    /reserved/,
  );
  const valid = snapshot({ simulationState: { positions: new Float32Array([1, 2]) } });
  const malformed = {
    ...valid,
    simulationState: { positions: { $vepaTypedArray: 'constructor', values: [] } },
  };
  const verdict = validateWorldSnapshot(malformed);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.errors.some(error => error.startsWith('invalid-payload:')));
});
