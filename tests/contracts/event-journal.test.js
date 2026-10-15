import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventJournal } from '../../src/state/event-journal.js';
import { createEventEnvelope } from '../../src/core/event-envelope.js';

function event(sequence, tick = 0, eventId = 'e-' + sequence, worldId = 'world-1') {
  return createEventEnvelope({ eventId, type: 'world.state-committed', schemaVersion: 1, worldId, tick, sequence, sourceModule: 'session.world', payload: { sequence } });
}

test('journal appends events in sequence and exposes immutable snapshots', () => {
  const journal = createEventJournal('world-1');
  assert.equal(journal.append(event(0, 0)).accepted, true);
  assert.equal(journal.append(event(1, 1)).accepted, true);
  const snapshot = journal.snapshot();
  assert.equal(snapshot.length, 2);
  assert.equal(journal.eventsAtTick(1).length, 1);
  assert.throws(() => { snapshot[0].payload.sequence = 99; }, TypeError);
});

test('journal deep-copies nested payloads and rejects cyclic payloads', () => {
  const journal = createEventJournal('world-1');
  const nested = { details: { label: 'original' } };
  const first = createEventEnvelope({ eventId: 'nested-0', type: 'world.state-committed', worldId: 'world-1', tick: 0, sequence: 0, sourceModule: 'session.world', payload: nested });
  assert.equal(journal.append(first).accepted, true);
  nested.details.label = 'mutated';
  assert.equal(journal.snapshot()[0].payload.details.label, 'original');
  assert.throws(() => { journal.snapshot()[0].payload.details.label = 'tampered'; }, TypeError);
  const cyclic = {};
  cyclic.self = cyclic;
  const second = createEventEnvelope({ eventId: 'nested-1', type: 'world.state-committed', worldId: 'world-1', tick: 0, sequence: 1, sourceModule: 'session.world', payload: cyclic });
  assert.equal(journal.append(second).reason, 'invalid-payload');
});

test('journal rejects wrong world, duplicate IDs, sequence gaps and tick regression', () => {
  const journal = createEventJournal('world-1');
  assert.equal(journal.append(event(0, 2)).accepted, true);
  assert.equal(journal.append(event(1, 3, 'other', 'world-2')).reason, 'wrong-world');
  assert.equal(journal.append(event(0, 2, 'e-0')).reason, 'duplicate-event-id');
  assert.equal(journal.append(event(3, 3, 'e-3')).reason, 'sequence-gap');
  assert.equal(journal.append(event(1, 1, 'e-1')).reason, 'tick-regression');
  assert.equal(journal.length, 1);
});


test('journal preserves __proto__ as payload data without changing prototypes', () => {
  const journal = createEventJournal('world-1');
  const payload = JSON.parse('{"__proto__":{"polluted":true}}');
  const item = createEventEnvelope({
    eventId: 'proto-key-0',
    type: 'world.state-committed',
    worldId: 'world-1',
    tick: 0,
    sequence: 0,
    sourceModule: 'test.proto',
    payload,
  });
  assert.equal(journal.append(item).accepted, true);
  const stored = journal.snapshot()[0].payload;
  assert.equal(Object.getPrototypeOf(stored), Object.prototype);
  assert.equal(Object.hasOwn(stored, '__proto__'), true);
  assert.equal(stored.__proto__.polluted, true);
  assert.equal({}.polluted, undefined);
});
