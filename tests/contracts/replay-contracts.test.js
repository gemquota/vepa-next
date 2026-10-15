import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventEnvelope } from '../../src/core/event-envelope.js';
import { validateReplay, replayEvents } from '../../src/state/replay.js';

function event({ worldId = 'w-1', eventId, tick, sequence, payload }) {
  return createEventEnvelope({
    eventId, type: 'world.counter-incremented', schemaVersion: 1,
    worldId, tick, sequence, sourceModule: 'test.counter', payload,
  });
}

const events = [
  event({ eventId: 'w-1:0', tick: 0, sequence: 0, payload: { amount: 2 } }),
  event({ eventId: 'w-1:1', tick: 1, sequence: 1, payload: { amount: 3 } }),
];

test('valid replay applies events in order to a caller-owned reducer', () => {
  const result = replayEvents(events, {
    worldId: 'w-1',
    initialState: { count: 0 },
    reduce: (state, item) => ({ count: state.count + item.payload.amount }),
  });
  assert.equal(result.status, 'replayed');
  assert.deepEqual(result.state, { count: 5 });
  assert.equal(result.eventCount, 2);
  assert.equal(result.lastSequence, 1);
  assert.equal(result.lastTick, 1);
});

test('replay rejects a sequence gap before invoking reducer', () => {
  let calls = 0;
  const malformed = [events[0], event({
    eventId: 'w-1:2', tick: 1, sequence: 2, payload: { amount: 3 },
  })];
  const result = replayEvents(malformed, {
    worldId: 'w-1',
    initialState: { count: 0 },
    reduce: state => { calls++; return state; },
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'invalid-replay');
  assert.equal(calls, 0);
  assert.ok(result.validation.errors.some(error => error.reason === 'sequence-gap'));
});

test('replay rejects a different world and duplicate event IDs', () => {
  const wrongWorld = [event({
    worldId: 'other', eventId: 'other:0', tick: 0, sequence: 0, payload: {},
  })];
  assert.equal(validateReplay(wrongWorld, { worldId: 'w-1' }).valid, false);

  const duplicate = [events[0], { ...events[1], eventId: events[0].eventId }];
  const result = validateReplay(duplicate, { worldId: 'w-1' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.reason === 'duplicate-event-id'));
});

test('replay reports reducer failure without claiming success', () => {
  const result = replayEvents(events, {
    worldId: 'w-1',
    initialState: { count: 0 },
    reduce: () => { throw new Error('fixture-reducer-error'); },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'reducer-failed');
  assert.equal(result.error, 'fixture-reducer-error');
  assert.equal(result.eventCount, 2);
});

test('replay does not mutate event payloads passed to the reducer', () => {
  const result = replayEvents(events, {
    worldId: 'w-1',
    initialState: { count: 0 },
    reduce: (state, item) => {
      item.payload.amount = 100;
      return { count: state.count + 1 };
    },
  });
  assert.equal(result.status, 'replayed');
  assert.equal(events[0].payload.amount, 2);
  assert.equal(events[1].payload.amount, 3);
});

test('empty replay preserves the initial state and reports initial tick', () => {
  const result = replayEvents([], {
    worldId: 'w-1',
    initialState: { count: 4 },
    initialTick: 7,
    initialSequence: 9,
    reduce: state => state,
  });
  assert.equal(result.status, 'replayed');
  assert.deepEqual(result.state, { count: 4 });
  assert.equal(result.eventCount, 0);
  assert.equal(result.lastSequence, null);
  assert.equal(result.lastTick, 7);
});
