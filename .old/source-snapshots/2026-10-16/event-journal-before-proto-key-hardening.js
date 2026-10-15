import { validateEventEnvelope } from '../core/event-envelope.js';

function cloneAndFreeze(value, seen = new WeakSet()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Event payload numbers must be finite');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('Event payload must be JSON-compatible');
  if (seen.has(value)) throw new TypeError('Event payload cannot contain cycles');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
    throw new TypeError('Event payload must contain only plain objects and arrays');
  }
  seen.add(value);
  let clone;
  if (Array.isArray(value)) {
    clone = value.map(item => cloneAndFreeze(item, seen));
  } else {
    clone = {};
    for (const [key, item] of Object.entries(value)) clone[key] = cloneAndFreeze(item, seen);
  }
  seen.delete(value);
  return Object.freeze(clone);
}

/** In-memory append-only journal. Payloads are copied and deeply frozen. */
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
      let payload;
      try {
        payload = cloneAndFreeze(event.payload);
      } catch (error) {
        return { accepted: false, reason: 'invalid-payload', error: error instanceof Error ? error.message : String(error) };
      }
      const stored = Object.freeze({ ...event, payload });
      events.push(stored);
      ids.add(stored.eventId);
      lastTick = stored.tick;
      lastSequence = stored.sequence;
      return { accepted: true, event: stored, index: events.length - 1 };
    },
    snapshot() { return events.slice(); },
    eventsAtTick(tick) {
      if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
      return events.filter(event => event.tick === tick);
    },
    get length() { return events.length; },
    get lastSequence() { return lastSequence; },
    get lastTick() { return lastTick; },
  });
}
