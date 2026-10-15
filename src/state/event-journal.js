import { validateEventEnvelope } from '../core/event-envelope.js';

/**
 * In-memory append-only journal for committed semantic events.
 * Persistence, event ID generation and domain payload schemas are adapters
 * layered above this primitive.
 */
export function createEventJournal(worldId) {
  if (typeof worldId !== 'string' || !worldId) throw new TypeError('worldId is required');
  const events = [];
  const ids = new Set();
  let lastTick = -1;
  let lastSequence = -1;

  return Object.freeze({
    append(event) {
      const verdict = validateEventEnvelope(event);
      if (!verdict.valid) return { accepted: false, reason: 'invalid-envelope', errors: verdict.errors };
      if (event.worldId !== worldId) return { accepted: false, reason: 'wrong-world' };
      if (ids.has(event.eventId)) return { accepted: false, reason: 'duplicate-event-id' };
      if (event.tick < lastTick) return { accepted: false, reason: 'tick-regression' };
      if (event.sequence !== lastSequence + 1) return { accepted: false, reason: 'sequence-gap', expected: lastSequence + 1 };
      const stored = Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) });
      events.push(stored);
      ids.add(stored.eventId);
      lastTick = stored.tick;
      lastSequence = stored.sequence;
      return { accepted: true, event: stored, index: events.length - 1 };
    },
    snapshot() {
      return events.map(event => Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) }));
    },
    eventsAtTick(tick) {
      if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
      return events.filter(event => event.tick === tick);
    },
    get length() { return events.length; },
    get lastSequence() { return lastSequence; },
    get lastTick() { return lastTick; },
  });
}
