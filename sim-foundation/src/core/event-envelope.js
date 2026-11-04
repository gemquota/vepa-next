const REQUIRED = ['eventId', 'type', 'schemaVersion', 'worldId', 'tick', 'sequence', 'sourceModule', 'payload'];

export function validateEventEnvelope(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { valid: false, errors: ['event must be an object'] };
  }
  const errors = [];
  for (const key of REQUIRED) {
    if (!(key in event)) errors.push(`missing ${key}`);
  }
  if (typeof event.eventId !== 'string' || !event.eventId) errors.push('eventId must be a non-empty string');
  if (typeof event.type !== 'string' || !/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(event.type)) {
    errors.push('type must be a namespaced semantic identifier');
  }
  if (!Number.isInteger(event.schemaVersion) || event.schemaVersion < 1) errors.push('schemaVersion must be a positive integer');
  if (typeof event.worldId !== 'string' || !event.worldId) errors.push('worldId must be a non-empty string');
  if (!Number.isInteger(event.tick) || event.tick < 0) errors.push('tick must be a non-negative integer');
  if (!Number.isInteger(event.sequence) || event.sequence < 0) errors.push('sequence must be a non-negative integer');
  if (typeof event.sourceModule !== 'string' || !event.sourceModule) errors.push('sourceModule must be a non-empty string');
  if (event.payload === null || typeof event.payload !== 'object') errors.push('payload must be an object or array');
  return { valid: errors.length === 0, errors };
}

export function createEventEnvelope(input) {
  const event = {
    eventId: input.eventId,
    type: input.type,
    schemaVersion: input.schemaVersion ?? 1,
    worldId: input.worldId,
    tick: input.tick,
    sequence: input.sequence,
    sourceModule: input.sourceModule,
    payload: input.payload ?? {},
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  };
  const result = validateEventEnvelope(event);
  if (!result.valid) throw new TypeError(`Invalid event envelope: ${result.errors.join('; ')}`);
  return Object.freeze(event);
}
