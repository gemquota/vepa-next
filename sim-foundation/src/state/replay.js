import { validateEventEnvelope } from '../core/event-envelope.js';

/**
 * Validate a replay stream before handing it to a domain reducer.
 * This validates event ordering and envelope integrity only; it cannot prove
 * that the reducer is deterministic or that the events contain complete state.
 */
export function validateReplay(events, { worldId, initialTick = 0, initialSequence = 0 } = {}) {
  const errors = [];
  if (!Array.isArray(events)) return { valid: false, errors: ['events must be an array'] };
  if (typeof worldId !== 'string' || !worldId) {
    return { valid: false, errors: ['worldId must be a non-empty string'] };
  }
  if (!Number.isInteger(initialTick) || initialTick < 0) {
    return { valid: false, errors: ['initialTick must be a non-negative integer'] };
  }
  if (!Number.isInteger(initialSequence) || initialSequence < 0) {
    return { valid: false, errors: ['initialSequence must be a non-negative integer'] };
  }

  const ids = new Set();
  let lastTick = initialTick;
  let expectedSequence = initialSequence;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const verdict = validateEventEnvelope(event);
    if (!verdict.valid) {
      errors.push({ index, reason: 'invalid-envelope', details: verdict.errors });
      continue;
    }
    if (event.worldId !== worldId) errors.push({ index, reason: 'wrong-world', expected: worldId, actual: event.worldId });
    if (ids.has(event.eventId)) errors.push({ index, reason: 'duplicate-event-id', eventId: event.eventId });
    ids.add(event.eventId);
    if (event.tick < lastTick) errors.push({ index, reason: 'tick-regression', previous: lastTick, actual: event.tick });
    if (event.sequence !== expectedSequence) errors.push({ index, reason: 'sequence-gap', expected: expectedSequence, actual: event.sequence });
    lastTick = Math.max(lastTick, event.tick);
    expectedSequence = Math.max(expectedSequence + 1, event.sequence + 1);
  }
  return {
    valid: errors.length === 0,
    errors,
    eventCount: events.length,
    firstSequence: events[0]?.sequence ?? null,
    lastSequence: events.at(-1)?.sequence ?? null,
    lastTick: events.length ? events.reduce((tick, event) =>
      Number.isInteger(event?.tick) ? Math.max(tick, event.tick) : tick, initialTick) : initialTick,
  };
}

/**
 * Replay validated events through a caller-owned pure reducer.
 * The reducer must return the next state and must not perform I/O or read ambient
 * time/randomness. State cloning is delegated to the caller to avoid assuming a
 * serialization format for the domain state.
 */
export function replayEvents(events, {
  worldId,
  initialState,
  reduce,
  cloneState = value => structuredClone(value),
  initialTick = 0,
  initialSequence = 0,
} = {}) {
  if (typeof reduce !== 'function') throw new TypeError('reduce must be a function');
  if (typeof cloneState !== 'function') throw new TypeError('cloneState must be a function');
  const validation = validateReplay(events, { worldId, initialTick, initialSequence });
  if (!validation.valid) {
    return { status: 'rejected', reason: 'invalid-replay', validation };
  }

  let state = cloneState(initialState);
  try {
    for (let index = 0; index < events.length; index++) {
      state = reduce(state, cloneState(events[index]), { index, worldId });
    }
    return {
      status: 'replayed',
      state,
      eventCount: events.length,
      lastSequence: validation.lastSequence,
      lastTick: validation.lastTick,
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: 'reducer-failed',
      error: error instanceof Error ? error.message : String(error),
      eventCount: events.length,
    };
  }
}
