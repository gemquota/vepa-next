import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventJournal } from '../../src/state/event-journal.js';
import { createEventEnvelope } from '../../src/core/event-envelope.js';

function event(sequence, tick = 0, eventId = 'e-' + sequence, worldId = 'world-1') {
  return createEventEnvelope({ eventId, type: 'world.state-committed', schemaVersion: 1, worldId, tick, sequence, sourceModule: 'session.world', payload: { sequence } });
}

test('journal appends events in sequence and exposes immutable snapshots', () => {
  const journal = createEventJournal('world-1');
  assert.equal(journal.append(event(0, 2)).accepted, true);
  assert.equal(journal.append(event(1, 1)).accepted, true);
  const snapshot = journal.snapshot();
  assert.equal(snapshot.length, 2);
  assert.equal(journal.eventsAtTick(1).length, 1);
  assert.throws(() => { snapshot[0].payload.sequence = 99; }, TypeError);
});

test('journal rejects wrong world, duplicate IDs, sequence gaps and tick regression', () => {
  const journal = createEventJournal('world-1');
  assert.equal(journal.append(event(0)).accepted, true);
  assert.equal(journal.append(event(1, 3, 'other', 'world-2')).reason, 'wrong-world');
  assert.equal(journal.append(event(0, 2, 'e-0')).reason, 'duplicate-event-id');
  assert.equal(journal.append(event(3, 3, 'e-3')).reason, 'sequence-gap');
  assert.equal(journal.append(event(1, 1, 'e-1')).reason, 'tick-regression');
  assert.equal(journal.length, 1);
});
