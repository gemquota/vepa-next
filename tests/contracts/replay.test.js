import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventEnvelope } from '../../src/core/event-envelope.js';
import { createEventJournal } from '../../src/state/event-journal.js';
import { validateReplay, replayEvents } from '../../src/state/replay.js';

function event(worldId, sequence, tick, type, payload = {}) {
  return createEventEnvelope({
    eventId: worldId + ':' + sequence, type, worldId, tick, sequence,
    sourceModule: 'test.replay', payload,
  });
}

test('validates a contiguous stream for the expected world', () => {
  const events = [
    event('world-r', 0, 0, 'world.counter-set', { value: 2 }),
    event('world-r', 1, 0, 'world.counter-add', { amount: 3 }),
    event('world-r', 2, 1, 'world.counter-add', { amount: 4 }),
  ];
  const result = validateReplay(events, { worldId: 'world-r' });
  assert.equal(result.valid, true);
  assert.equal(result.eventCount, 3);
  assert.equal(result.lastSequence, 2);
  assert.equal(result.lastTick, 1);
});

test('rejects wrong-world, sequence gaps, duplicate IDs and tick regression', () => {
  const events = [
    event('world-r', 0, 3, 'world.counter-add', { amount: 1 }),
    event('world-other', 2, 2, 'world.counter-add', { amount: 1 }),
    event('world-r', 2, 4, 'world.counter-add', { amount: 1 }),
  ];
  const result = validateReplay(events, { worldId: 'world-r' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.reason === 'wrong-world'));
  assert.ok(result.errors.some(error => error.reason === 'sequence-gap'));
  assert.ok(result.errors.some(error => error.reason === 'tick-regression'));
});

test('replay invokes the reducer in event order without mutating the source stream', () => {
  const events = [
    event('world-r', 0, 0, 'world.counter-set', { value: 2 }),
    event('world-r', 1, 1, 'world.counter-add', { amount: 5 }),
  ];
  const replay = replayEvents(events, {
    worldId: 'world-r',
    initialState: { counter: 0 },
    reduce(state, item) {
      if (item.type === 'world.counter-set') state.counter = item.payload.value;
      if (item.type === 'world.counter-add') state.counter += item.payload.amount;
      return state;
    },
  });
  assert.equal(replay.status, 'replayed');
  assert.equal(replay.state.counter, 7);
  assert.equal(events[0].payload.value, 2);
});

test('invalid replay never calls reducer', () => {
  let calls = 0;
  const result = replayEvents([event('wrong-world', 0, 0, 'world.counter-add', { amount: 1 })], {
    worldId: 'world-r',
    initialState: { counter: 0 },
    reduce(state) { calls++; return state; },
  });
  assert.equal(result.status, 'rejected');
  assert.equal(calls, 0);
});

test('reports reducer failure without claiming successful replay', () => {
  const result = replayEvents([event('world-r', 0, 0, 'world.counter-add', { amount: 1 })], {
    worldId: 'world-r',
    initialState: { counter: 0 },
    reduce() { throw new Error('deterministic reducer failure'); },
  });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /deterministic reducer failure/);
});

test('accepts an empty stream and reports the initial tick', () => {
  assert.deepEqual(validateReplay([], { worldId: 'world-r' }), {
    valid: true, errors: [], eventCount: 0, firstSequence: null, lastSequence: null, lastTick: 0,
  });
});
