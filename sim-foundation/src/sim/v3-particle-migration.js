import { PARTICLE_STRIDE } from './particle-layout.js';

export const V3_PARTICLE_LAYOUT_VERSION = 3;
export const V3_PARTICLE_STRIDE = 64;
export const V3_PARTICLE_CACHED_DNA_COUNT = 42;

/**
 * Migrate a V3 interleaved particle buffer (64 numeric slots per particle)
 * into the current VEPA Next layout (100 slots per particle).
 *
 * V3 and the current stable/Next layout share offsets 0..63, including the
 * 42 cached DNA values at offsets 8..49. Newer state slots are initialized
 * to zero. This function does not migrate species-level DNA/genome buffers,
 * world configuration, law bitmasks, PRNG state, or save envelopes.
 *
 * The input is never mutated. Float64Array output matches the current solver
 * contract. Callers must supply the particle count explicitly so truncated
 * and trailing data cannot be silently accepted.
 */
export function migrateV3ParticleBuffer(buffer, { particleCount } = {}) {
  if (!(buffer instanceof Float32Array) && !(buffer instanceof Float64Array)) {
    throw new TypeError('V3 particle buffer must be a Float32Array or Float64Array');
  }
  if (!Number.isSafeInteger(particleCount) || particleCount < 0) {
    throw new TypeError('particleCount must be a non-negative safe integer');
  }
  const expectedLength = particleCount * V3_PARTICLE_STRIDE;
  if (!Number.isSafeInteger(expectedLength) || buffer.length !== expectedLength) {
    throw new RangeError(`V3 particle buffer length mismatch: expected ${expectedLength}, received ${buffer.length}`);
  }
  for (let i = 0; i < buffer.length; i += 1) {
    if (!Number.isFinite(buffer[i])) {
      throw new TypeError(`V3 particle buffer contains a non-finite value at index ${i}`);
    }
  }

  const migrated = new Float64Array(particleCount * PARTICLE_STRIDE);
  for (let particle = 0; particle < particleCount; particle += 1) {
    const sourceStart = particle * V3_PARTICLE_STRIDE;
    const targetStart = particle * PARTICLE_STRIDE;
    migrated.set(buffer.subarray(sourceStart, sourceStart + V3_PARTICLE_STRIDE), targetStart);
    // Float64Array initializes all appended slots (64..99) to zero.
  }
  return migrated;
}
