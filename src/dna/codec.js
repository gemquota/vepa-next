// ============================================================================
// VEPA4 — Species genome codec
//
// The species genome is a Uint16Array of [64 species × 64 params]. A float
// parameter is stored quantized into [0, 65535] against that param's
// DNA_RANGES entry:
//
//   write:  raw = round((clamp(value, min, max) - min) / (max - min) * 65535)
//   read:   value = min + (raw / 65535) * (max - min)
//
// That contract was previously implemented five separate times
// (physics/laws.js read/writeSpeciesDNAParam, state/quantumMacro.js readDNA,
// and two inline copies in main.js). It is a serialization boundary, so a
// divergence between two copies silently corrupts inherited traits. One
// implementation now.
//
// IMPORTANT: params 42-63 (genetics/regulatory) live ONLY in this genome
// buffer, never in the 42-float per-particle stride cache. Reading a cached
// value for those indices is a bug.
//
// See docs/CODEBASE-AUDIT-2026-09-30.md §2.2 (P-2).
// ============================================================================

import { DNA_RANGES, DEFAULT_DNA_STRIDE } from '../constants.js';

/** Maximum quantized value (uint16 full scale). */
export const DNA_PACK_MAX = 65535;

/** Offset of a species' genome row within the flat buffer. */
export function genomeBase(species) {
  return species * DEFAULT_DNA_STRIDE;
}

/**
 * Read one genome param as a float, dequantized against DNA_RANGES.
 *
 * @param {Uint16Array|null} buffer  genome buffer (null-safe: returns 0)
 * @param {number} species  species index
 * @param {number} idx      DNA param index (0-63)
 * @returns {number} value in [min, max] for the param, or raw/65535 if the
 *   index has no DNA_RANGES entry
 */
export function readDNAParam(buffer, species, idx) {
  if (!buffer) return 0;
  const raw = buffer[genomeBase(species) + idx] || 0;
  const r = DNA_RANGES[idx];
  if (r) return r.min + (raw / DNA_PACK_MAX) * (r.max - r.min);
  return raw / DNA_PACK_MAX;
}

/**
 * Write one genome param, clamping to the param's DNA_RANGES bounds and
 * quantizing to uint16. Out-of-range indices are clamped to [-1, 1].
 *
 * @param {Uint16Array} buffer
 * @param {number} species
 * @param {number} idx
 * @param {number} value
 */
export function writeDNAParam(buffer, species, idx, value) {
  if (!buffer) return;
  const r = DNA_RANGES[idx] || { min: -1, max: 1 };
  const clamped = Math.max(r.min, Math.min(r.max, value));
  const normalized = (clamped - r.min) / (r.max - r.min);
  buffer[genomeBase(species) + idx] = Math.round(normalized * DNA_PACK_MAX);
}

/**
 * Quantize a float to its uint16 genome representation without writing it.
 * Use when the caller is writing straight into a buffer it already holds a
 * reference to (e.g. bulk species mutation passes).
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number} quantized uint16
 */
export function quantizeDNA(value, min, max) {
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (clamped - min) / (max - min);
  return Math.round(normalized * DNA_PACK_MAX);
}
