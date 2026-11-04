export const V3_SPECIES_DNA_SCHEMA_VERSION = 3;
export const V3_SPECIES_DNA_STRIDE = 64;
export const CURRENT_SPECIES_DNA_SCHEMA_VERSION = 4;
export const CURRENT_SPECIES_DNA_STRIDE = 64;
export const DNA_PACK_MAX = 65535;

// All shared trait ranges match except base radius (29) and magnetic moment (33).
const RANGE_MIGRATIONS = Object.freeze({
  29: { source: [0.5, 10], target: [0.2, 4] },
  33: { source: [0, 1], target: [-1, 1] },
});

// Current DNA_RANGES defaults for traits appended after V3's 42 traits.
const APPENDED_DEFAULTS = Object.freeze([
  [0, 1, 0.5], [0, 0.5, 0.1], [0, 0.1, 0.01], [0, 1, 0.5],
  [0, 1, 0.2], [-1, 1, 0], [1, 8, 2], [0, 1, 0.1],
  [0, 1, 0.05], [0, 1, 0.5], [0, 1, 0.1], [0, 1, 0.5],
  [0, 1, 0.5], [0, 1, 0.2], [0, 1, 0.05], [0, 1, 0.1],
  [-1, 1, 0], [0, 1, 0.5], [0, 1, 0.5], [1, 4, 2],
  [0, 1, 0.5], [1, 10, 3],
]);

const encode = (value, min, max) => Math.round(((value - min) / (max - min)) * DNA_PACK_MAX);

/**
 * Convert a V3 species genome buffer (one 64-Uint16 record per species)
 * into the current 64-trait schema. The species count must be explicit:
 * the pinned V3 source does not declare a canonical buffer capacity.
 *
 * Shared traits retain their indices. The two changed ranges are converted
 * through semantic floats; new traits 42..63 receive current schema defaults.
 * This function does not migrate particle buffers, laws, world config, PRNG,
 * species metadata or save envelopes.
 */
export function migrateV3SpeciesDNABuffer(buffer, { speciesCount } = {}) {
  if (!(buffer instanceof Uint16Array)) {
    throw new TypeError('V3 species DNA buffer must be a Uint16Array');
  }
  if (!Number.isSafeInteger(speciesCount) || speciesCount < 0) {
    throw new TypeError('speciesCount must be a non-negative safe integer');
  }
  const expectedLength = speciesCount * V3_SPECIES_DNA_STRIDE;
  if (!Number.isSafeInteger(expectedLength) || buffer.length !== expectedLength) {
    throw new RangeError(`V3 species DNA length mismatch: expected ${expectedLength}, received ${buffer.length}`);
  }

  const migrated = new Uint16Array(speciesCount * CURRENT_SPECIES_DNA_STRIDE);
  for (let species = 0; species < speciesCount; species += 1) {
    const base = species * V3_SPECIES_DNA_STRIDE;
    migrated.set(buffer.subarray(base, base + 42), base);
    for (const [key, ranges] of Object.entries(RANGE_MIGRATIONS)) {
      const index = Number(key);
      const normalized = buffer[base + index] / DNA_PACK_MAX;
      const semantic = ranges.source[0] + normalized * (ranges.source[1] - ranges.source[0]);
      const clamped = Math.max(ranges.target[0], Math.min(ranges.target[1], semantic));
      migrated[base + index] = encode(clamped, ranges.target[0], ranges.target[1]);
    }
    for (let i = 0; i < APPENDED_DEFAULTS.length; i += 1) {
      const [min, max, value] = APPENDED_DEFAULTS[i];
      migrated[base + 42 + i] = encode(value, min, max);
    }
  }
  return migrated;
}
