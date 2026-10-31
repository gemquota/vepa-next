import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeterministicRandomStreams,
  RANDOM_STREAMS_SCHEMA,
} from '../../src/core/random-streams.js';

test('same seed and keys reproduce identical domain/entity streams', () => {
  const a = createDeterministicRandomStreams({ seed: 123456 });
  const b = createDeterministicRandomStreams({ seed: 123456 });
  const left = a.get('mutation', 'particle:17');
  const right = b.get('mutation', 'particle:17');
  assert.deepEqual(Array.from({ length: 12 }, () => left.nextUint32()),
    Array.from({ length: 12 }, () => right.nextUint32()));
});

test('different seeds diverge for the same stream identity', () => {
  const a = createDeterministicRandomStreams({ seed: 123 });
  const b = createDeterministicRandomStreams({ seed: 124 });
  assert.notDeepEqual(
    Array.from({ length: 8 }, () => a.get('reproduction', 8).nextUint32()),
    Array.from({ length: 8 }, () => b.get('reproduction', 8).nextUint32()),
  );
});

test('domain and entity streams are isolated from request order', () => {
  const a = createDeterministicRandomStreams({ seed: 99 });
  const b = createDeterministicRandomStreams({ seed: 99 });
  const aTarget = a.get('thermal-jitter', 42);
  const bTarget = b.get('thermal-jitter', 42);
  const aExpected = Array.from({ length: 10 }, () => aTarget.next());
  b.get('mutation', 42).next();
  b.get('reproduction', 7).next();
  b.get('thermal-jitter', 99).next();
  const bActual = Array.from({ length: 10 }, () => bTarget.next());
  assert.deepEqual(aExpected, bActual);
});

test('snapshot and restore reproduce future values exactly', () => {
  const original = createDeterministicRandomStreams({ seed: 0xdecafbad });
  const mutation = original.get('mutation', 'cell-A');
  const thermal = original.get('thermal', 'cell-A');
  for (let i = 0; i < 9; i++) mutation.nextUint32();
  for (let i = 0; i < 4; i++) thermal.next();
  const snapshot = original.snapshot();
  assert.equal(snapshot.schema, RANDOM_STREAMS_SCHEMA);
  const expectedMutation = Array.from({ length: 20 }, () => mutation.nextUint32());
  const expectedThermal = Array.from({ length: 20 }, () => thermal.next());

  const restored = createDeterministicRandomStreams({ seed: 0xdecafbad, snapshot });
  assert.deepEqual(Array.from({ length: 20 }, () => restored.get('mutation', 'cell-A').nextUint32()), expectedMutation);
  assert.deepEqual(Array.from({ length: 20 }, () => restored.get('thermal', 'cell-A').next()), expectedThermal);
});

test('snapshot order is canonical and independent of stream access order', () => {
  const a = createDeterministicRandomStreams({ seed: 5 });
  const b = createDeterministicRandomStreams({ seed: 5 });
  a.get('z', 2).next();
  a.get('a', 1).next();
  b.get('a', 1).next();
  b.get('z', 2).next();
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test('rejects mismatched seeds, unsorted entries and malformed stream keys', () => {
  const runtime = createDeterministicRandomStreams({ seed: 7 });
  const snapshot = runtime.snapshot();
  assert.throws(() => createDeterministicRandomStreams({ seed: 8, snapshot }), /Incompatible/);
  assert.throws(() => runtime.get('', 1), /domain/);
  assert.throws(() => runtime.get('mutation', -1), /entityId/);
  assert.throws(() => runtime.restore({
    ...snapshot,
    streams: [{ key: 'z', state: 1 }, { key: 'a', state: 2 }],
  }), /Invalid/);
});
