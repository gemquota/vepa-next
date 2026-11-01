import { DNA_RANGES, DNA_INDEXES } from '../constants.js';

const SPECIES_COUNT = 64;
const PARAM_COUNT = 64;
const TOTAL = SPECIES_COUNT * PARAM_COUNT;
const PACK_MAX = 65535;

/**
 * Allocate a Uint16Array DNA configuration buffer [64 species × 64 params].
 * @returns {Uint16Array}
 */
export function createDNABuffer() {
    return new Uint16Array(TOTAL);
}

/**
 * Get raw uint16 value for a specific species and param index.
 */
export function getDNA(buffer, species, param) {
    return buffer[species * PARAM_COUNT + param];
}

/**
 * Set raw uint16 value for a specific species and param index.
 */
export function setDNA(buffer, species, param, value) {
    buffer[species * PARAM_COUNT + param] = value;
}

/**
 * Get DNA param as a normalized float in [min, max] range.
 */
export function getDNAFloat(buffer, species, param, min, max) {
    const raw = buffer[species * PARAM_COUNT + param];
    return min + (raw / PACK_MAX) * (max - min);
}

/**
 * Set DNA param by quantizing a float in [min, max] to uint16.
 */
export function setDNAFloat(buffer, species, param, value, min, max) {
    const clamped = Math.max(min, Math.min(max, value));
    const normalized = (clamped - min) / (max - min);
    buffer[species * PARAM_COUNT + param] = Math.round(normalized * PACK_MAX);
}

/**
 * Get all 64 DNA params for a species as float values using DNA_RANGES.
 * @param {Uint16Array} buffer
 * @param {number} species - Species index (0-63)
 * @returns {number[]} Float array of 64 normalized values
 */
export function getSpeciesDNA(buffer, species) {
    const result = new Float32Array(PARAM_COUNT);
    const base = species * PARAM_COUNT;
    for (let i = 0; i < PARAM_COUNT; i++) {
        const raw = buffer[base + i];
        if (i < DNA_RANGES.length) {
            const { min, max } = DNA_RANGES[i];
            result[i] = min + (raw / PACK_MAX) * (max - min);
        } else {
            result[i] = raw / PACK_MAX;
        }
    }
    return result;
}

/**
 * Set all 64 DNA params for a species from a float array using DNA_RANGES.
 * @param {Uint16Array} buffer
 * @param {number} species - Species index (0-63)
 * @param {number[]} dnaArray - Float values (only first PARAM_COUNT are used)
 */
export function setSpeciesDNA(buffer, species, dnaArray) {
    const base = species * PARAM_COUNT;
    for (let i = 0; i < PARAM_COUNT; i++) {
        if (i >= dnaArray.length) break;
        if (i < DNA_RANGES.length) {
            const { min, max } = DNA_RANGES[i];
            const clamped = Math.max(min, Math.min(max, dnaArray[i]));
            const normalized = (clamped - min) / (max - min);
            buffer[base + i] = Math.round(normalized * PACK_MAX);
        } else {
            buffer[base + i] = Math.round(Math.max(0, Math.min(1, dnaArray[i])) * PACK_MAX);
        }
    }
}

/**
 * Copy all DNA from one species to another.
 * @param {Uint16Array} buffer
 * @param {number} sourceSpecies
 * @param {number} targetSpecies
 */
export function cloneSpecies(buffer, sourceSpecies, targetSpecies) {
    const srcBase = sourceSpecies * PARAM_COUNT;
    const tgtBase = targetSpecies * PARAM_COUNT;
    for (let i = 0; i < PARAM_COUNT; i++) {
        buffer[tgtBase + i] = buffer[srcBase + i];
    }
}

/**
 * Apply mutation to a single DNA param within a range.
 * The mutation shifts the raw uint16 value by a random amount scaled by range.
 * @param {Uint16Array} buffer
 * @param {number} species - Species index
 * @param {number} param - Param index
 * @param {number} range - Maximum mutation magnitude (fraction of full range, 0-1)
 * @param {Function} prng - PRNG function returning float in [0, 1)
 */
export function mutateSpecies(buffer, species, param, range, prng) {
    const idx = species * PARAM_COUNT + param;
    const current = buffer[idx];

    // Compute param range for scaling
    let min = 0;
    let max = 1;
    if (param < DNA_RANGES.length) {
        min = DNA_RANGES[param].min;
        max = DNA_RANGES[param].max;
    }
    const paramRange = max - min;

    // Convert current uint16 to float, apply mutation, convert back
    const asFloat = min + (current / PACK_MAX) * paramRange;
    const mutation = (prng() * 2 - 1) * range * paramRange;
    const newFloat = Math.max(min, Math.min(max, asFloat + mutation));
    const normalized = (newFloat - min) / paramRange;
    buffer[idx] = Math.round(normalized * PACK_MAX);
}

/**
 * Load default DNA values from DNA_RANGES into the buffer for all species.
 * @param {Uint16Array} buffer
 * @param {Array<{min: number, max: number, default: number}>} ranges - DNA_RANGES constant
 */
export function loadDefaults(buffer, ranges) {
    for (let species = 0; species < SPECIES_COUNT; species++) {
        const base = species * PARAM_COUNT;
        for (let i = 0; i < PARAM_COUNT; i++) {
            if (i < ranges.length) {
                const { min, max, default: def } = ranges[i];
                const clamped = Math.max(min, Math.min(max, def));
                const normalized = (clamped - min) / (max - min);
                buffer[base + i] = Math.round(normalized * PACK_MAX);
            } else {
                buffer[base + i] = Math.round(PACK_MAX / 2);
            }
        }
    }
}
