import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldSnapshot, restoreSnapshotValue } from '../../src/state/snapshot.js';
import { createSnapshotStore } from '../../src/state/snapshot-store.js';

class MemoryStorage {
  values = new Map();
  failNextSet = null;
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (this.failNextSet && this.failNextSet(key)) throw new Error('simulated-storage-failure');
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

function snap(tick) {
  return createWorldSnapshot({
    worldId: 'w-1', tick, generation: tick,
    config: { mode: 'configured' },
    simulationState: { count: tick },
    prngState: { state: tick + 1 },
    lastEventSequence: tick - 1,
  });
}

test('two-slot store saves and loads a validated snapshot', () => {
  const storage = new MemoryStorage();
  const store = createSnapshotStore(storage);
  assert.equal(store.save(snap(1)).status, 'saved');
  const loaded = store.load();
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.snapshot.tick, 1);
});

test('failed slot write preserves the previous checkpoint', () => {
  const storage = new MemoryStorage();
  const store = createSnapshotStore(storage);
  store.save(snap(1));
  storage.failNextSet = key => key.endsWith('.slot.b');
  const failed = store.save(snap(2));
  assert.equal(failed.status, 'failed');
  assert.equal(store.load().snapshot.tick, 1);
});

test('corrupt active slot falls back to the last valid slot', () => {
  const storage = new MemoryStorage();
  const store = createSnapshotStore(storage);
  store.save(snap(1));
  store.save(snap(2));
  const active = storage.getItem('vepa.snapshot.active');
  storage.setItem('vepa.snapshot.slot.' + active, '{not-json');
  const loaded = store.load();
  assert.equal(loaded.status, 'recovered');
  assert.equal(loaded.snapshot.tick, 1);
  assert.equal(loaded.reason, 'active-slot-invalid');
});

test('newer slot is recovered when pointer update fails', () => {
  const storage = new MemoryStorage();
  const store = createSnapshotStore(storage);
  store.save(snap(1));
  storage.failNextSet = key => key.endsWith('.active');
  const saved = store.save(snap(2));
  assert.equal(saved.status, 'committed-unpointed');
  const loaded = store.load();
  assert.equal(loaded.status, 'recovered');
  assert.equal(loaded.snapshot.tick, 2);
  assert.equal(loaded.reason, 'newer-valid-slot-than-active-pointer');
});

test('store rejects invalid snapshots and reports empty storage explicitly', () => {
  const store = createSnapshotStore(new MemoryStorage());
  assert.equal(store.load().status, 'empty');
  assert.equal(store.save({ tick: -1 }).status, 'rejected');
});


test('two-slot store preserves typed-array simulation buffers through JSON roundtrip', () => {
  const store = createSnapshotStore(new MemoryStorage());
  const value = createWorldSnapshot({
    worldId: 'typed-array-world',
    tick: 7,
    generation: 2,
    config: { mode: 'configured' },
    simulationState: { positions: new Float32Array([0.5, 1.25, -4]) },
    prngState: { algorithm: 'splitmix32-v1', state: 17 },
    lastEventSequence: 6,
  });
  assert.equal(store.save(value).status, 'saved');
  const loaded = store.load();
  assert.equal(loaded.status, 'loaded');
  const state = restoreSnapshotValue(loaded.snapshot.simulationState);
  assert.ok(state.positions instanceof Float32Array);
  assert.deepEqual([...state.positions], [0.5, 1.25, -4]);
});
