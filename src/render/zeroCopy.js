// ============================================================================
// VEPA4 — Zero-copy particle view
//
// Both renderers need a Float32Array view over the particle storage on every
// frame. They each shipped an identical private copy of this helper; it is
// here so the Canvas2D and PixiJS backends cannot drift apart.
//
// See docs/CODEBASE-AUDIT-2026-09-30.md §2.1 (DUP-7).
// ============================================================================

/**
 * Return a Float32Array view over particle storage without copying.
 *
 * The render loop is called every frame with either a raw (Shared)ArrayBuffer
 * or an existing Float32Array view. Wrapping a buffer into `new Float32Array`
 * is free, but doing it over an existing Float32Array would copy 1MB+ per
 * frame — and multiplex mode renders up to 16 shards a frame. This helper
 * returns the typed array itself when one is passed in.
 *
 * @param {SharedArrayBuffer|ArrayBuffer|Float32Array} buffer
 * @returns {Float32Array} A live view over the same memory (never a copy)
 */
export function asParticleView(buffer) {
  return buffer instanceof Float32Array ? buffer : new Float32Array(buffer);
}
