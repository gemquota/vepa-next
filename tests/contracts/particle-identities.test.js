import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createParticleIdentityAllocator,
  PARTICLE_IDENTITY_SCHEMA,
} from '../../src/sim/particle-identities.js';

test('allocates deterministic lowest-free slots with generation-qualified IDs', () => {
  const ids = createParticleIdentityAllocator({ capacity: 4 });
  const a = ids.allocate();
  const b = ids.allocate();
  assert.deepEqual(a, { slot: 0, generation: 1, id: 'particle:0:1' });
  assert.deepEqual(b, { slot: 1, generation: 1, id: 'particle:1:1' });
  assert.equal(ids.activeCount, 2);
});

test('reusing a released slot creates a distinct identity', () => {
  const ids = createParticleIdentityAllocator({ capacity: 2 });
  const first = ids.allocate(1);
  assert.equal(ids.release(first), true);
  const second = ids.allocate(1);
  assert.equal(second.id, 'particle:1:2');
  assert.notEqual(first.id, second.id);
  assert.equal(ids.isCurrent(first), false);
  assert.equal(ids.isCurrent(second), true);
  assert.equal(ids.release(first), false);
  assert.equal(ids.get(1).id, second.id);
});

test('stale release cannot free a newer occupant of the same slot', () => {
  const ids = createParticleIdentityAllocator({ capacity: 1 });
  const first = ids.allocate();
  ids.release(first);
  const second = ids.allocate();
  assert.equal(ids.release(first), false);
  assert.equal(ids.get(0).id, second.id);
  assert.equal(ids.activeCount, 1);
});

test('snapshot restore preserves active identities and future generations', () => {
  const original = createParticleIdentityAllocator({ capacity: 3 });
  const first = original.allocate(2);
  original.allocate(0);
  const snapshot = original.snapshot();
  assert.equal(snapshot.schema, PARTICLE_IDENTITY_SCHEMA);
  const restored = createParticleIdentityAllocator({ capacity: 3, snapshot });
  assert.equal(restored.get(2).id, first.id);
  assert.equal(restored.release(first), true);
  const reused = restored.allocate(2);
  assert.equal(reused.id, 'particle:2:2');
  assert.deepEqual(restored.snapshot(), {
    schema: PARTICLE_IDENTITY_SCHEMA,
    version: 1,
    capacity: 3,
    generations: [1, 2, 0],
    active: [true, true, false],
  });
});

test('snapshot restore is atomic and rejects malformed or incompatible state', () => {
  const ids = createParticleIdentityAllocator({ capacity: 2 });
  const current = ids.allocate(0);
  const before = ids.snapshot();
  assert.throws(() => ids.restore({ ...before, capacity: 3 }), /Incompatible/);
  assert.throws(() => ids.restore({ ...before, generations: [0, -1] }), /Invalid/);
  assert.deepEqual(ids.snapshot(), before);
  assert.equal(ids.isCurrent(current), true);
});

test('rejects duplicate allocation, invalid slots, malformed identities and exhaustion', () => {
  const ids = createParticleIdentityAllocator({ capacity: 1 });
  const identity = ids.allocate();
  assert.throws(() => ids.allocate(0), /already allocated/);
  assert.throws(() => ids.allocate(1), /outside/);
  assert.throws(() => ids.allocate(), /no free slot/);
  assert.throws(() => ids.release({ slot: 0, generation: 1, id: 'wrong' }), /malformed/);
  assert.equal(ids.release(identity), true);
  assert.throws(() => createParticleIdentityAllocator({ capacity: -1 }), /capacity/);
});
