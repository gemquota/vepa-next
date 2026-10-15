import test from 'node:test';
import assert from 'node:assert/strict';
import { textToSeed } from '../../src/core/seed.js';
import { SplitMix32 } from '../../src/core/prng.js';
import { createEventEnvelope, validateEventEnvelope } from '../../src/core/event-envelope.js';
import { createTransactionCoordinator } from '../../src/state/transaction.js';
import { createLawRegistry } from '../../src/sim/law-registry.js';

test('text-to-seed is stable for identical text', () => {
  assert.equal(textToSeed('primordial soup'), textToSeed('primordial soup'));
  assert.notEqual(textToSeed('primordial soup'), textToSeed('peaceful'));
});

test('PRNG snapshot restores the exact next value', () => {
  const rng = new SplitMix32(42);
  rng.next();
  const snapshot = rng.snapshot();
  const expected = rng.next();
  assert.equal(new SplitMix32(0).restore(snapshot).next(), expected);
});

test('event envelopes reject missing semantic fields', () => {
  assert.equal(validateEventEnvelope({ type: 'world.started' }).valid, false);
  assert.equal(createEventEnvelope({
    eventId: 'e-1', type: 'world.started', worldId: 'w-1',
    tick: 0, sequence: 0, sourceModule: 'session.world', payload: {}
  }).type, 'world.started');
});

test('invalid transaction leaves live state untouched', async () => {
  let live = { count: 1 };
  const tx = createTransactionCoordinator({
    getCurrent: () => structuredClone(live),
    validate: () => ({ valid: false, reason: 'test-rejection' }),
    apply: (value) => { live = value; },
    restore: (value) => { live = value; },
  });
  const result = await tx.transact({ count: 99 });
  assert.equal(result.status, 'rejected');
  assert.deepEqual(live, { count: 1 });
});

test('transaction rolls back when apply fails', async () => {
  let live = { count: 1 };
  const tx = createTransactionCoordinator({
    getCurrent: () => structuredClone(live),
    validate: (value) => ({ valid: true, value }),
    apply: () => { live = { count: 99 }; throw new Error('simulated failure'); },
    restore: (value) => { live = value; },
  });
  const result = await tx.transact({ count: 2 });
  assert.equal(result.status, 'rolled-back');
  assert.deepEqual(live, { count: 1 });
});

test('law registry rejects duplicate identifiers', () => {
  const registry = createLawRegistry();
  const law = { id: 'law.gravity', version: 1, step() {} };
  registry.register(law);
  assert.throws(() => registry.register(law), /Duplicate law id/);
});
