export const PARTICLE_IDENTITY_SCHEMA = 'vepa.particle-identities';
export const PARTICLE_IDENTITY_VERSION = 1;
const MAX_CAPACITY = 10_000_000;

function validateCapacity(capacity) {
  if (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > MAX_CAPACITY) {
    throw new RangeError('capacity must be a safe integer between 0 and ' + MAX_CAPACITY);
  }
  return capacity;
}

function identityFor(slot, generation) {
  return Object.freeze({
    slot,
    generation,
    id: 'particle:' + slot + ':' + generation,
  });
}

function validateIdentity(identity, capacity) {
  if (!identity || typeof identity !== 'object' ||
      !Number.isSafeInteger(identity.slot) || identity.slot < 0 || identity.slot >= capacity ||
      !Number.isSafeInteger(identity.generation) || identity.generation < 1 ||
      identity.id !== 'particle:' + identity.slot + ':' + identity.generation) {
    throw new TypeError('identity is malformed or belongs to another allocator');
  }
}

/**
 * Generation-aware identities for fixed particle slots.
 *
 * A slot is storage, not identity. Each successful allocation increments that
 * slot's generation and returns a token such as particle:12:3. Reusing slot 12
 * therefore creates a new random-stream identity. Persist snapshot() beside
 * particle state and restore it before resuming simulation.
 *
 * Allocation is explicit and deterministic: automatic allocation chooses the
 * lowest free slot. This module deliberately does not infer births/deaths from
 * particle buffers; the simulation lifecycle must call allocate/release at the
 * authoritative mutation point.
 */
export function createParticleIdentityAllocator({ capacity, snapshot = undefined } = {}) {
  validateCapacity(capacity);
  let generations = new Array(capacity).fill(0);
  let active = new Array(capacity).fill(false);

  function current(slot) {
    if (!Number.isSafeInteger(slot) || slot < 0 || slot >= capacity) {
      throw new RangeError('slot is outside allocator capacity');
    }
    return active[slot] ? identityFor(slot, generations[slot]) : null;
  }

  function allocate(requestedSlot = undefined) {
    let slot = requestedSlot;
    if (slot === undefined) {
      slot = active.findIndex(value => !value);
    }
    if (!Number.isSafeInteger(slot) || slot < 0 || slot >= capacity) {
      throw new RangeError('slot is outside allocator capacity or no free slot remains');
    }
    if (active[slot]) throw new Error('particle slot is already allocated');
    if (generations[slot] >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('particle slot generation is exhausted');
    }
    generations[slot]++;
    active[slot] = true;
    return identityFor(slot, generations[slot]);
  }

  function release(identity) {
    validateIdentity(identity, capacity);
    if (!active[identity.slot] || generations[identity.slot] !== identity.generation) {
      return false;
    }
    active[identity.slot] = false;
    return true;
  }

  function restore(value) {
    if (!value || value.schema !== PARTICLE_IDENTITY_SCHEMA ||
        value.version !== PARTICLE_IDENTITY_VERSION || value.capacity !== capacity ||
        !Array.isArray(value.generations) || !Array.isArray(value.active) ||
        value.generations.length !== capacity || value.active.length !== capacity) {
      throw new TypeError('Incompatible particle identity snapshot');
    }
    const nextGenerations = new Array(capacity);
    const nextActive = new Array(capacity);
    for (let slot = 0; slot < capacity; slot++) {
      const generation = value.generations[slot];
      const isActive = value.active[slot];
      if (!Number.isSafeInteger(generation) || generation < 0 ||
          typeof isActive !== 'boolean' || (isActive && generation < 1)) {
        throw new TypeError('Invalid particle identity snapshot entry at slot ' + slot);
      }
      nextGenerations[slot] = generation;
      nextActive[slot] = isActive;
    }
    generations = nextGenerations;
    active = nextActive;
    return Object.freeze({ restored: true, capacity, activeCount: active.filter(Boolean).length });
  }

  if (snapshot !== undefined) restore(snapshot);

  return Object.freeze({
    capacity,
    allocate,
    release,
    get(slot) { return current(slot); },
    isCurrent(identity) {
      validateIdentity(identity, capacity);
      return active[identity.slot] && generations[identity.slot] === identity.generation;
    },
    snapshot() {
      return Object.freeze({
        schema: PARTICLE_IDENTITY_SCHEMA,
        version: PARTICLE_IDENTITY_VERSION,
        capacity,
        generations: Object.freeze(generations.slice()),
        active: Object.freeze(active.slice()),
      });
    },
    get activeCount() { return active.filter(Boolean).length; },
  });
}
