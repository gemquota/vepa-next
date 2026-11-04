// ============================================================================
// VEPA4 — Shared numeric primitives
//
// Single source of truth for the small numeric helpers that were previously
// copy-pasted across 25+ modules (see docs/CODEBASE-AUDIT-2026-09-30.md §2.1).
//
// IMPORTANT — three of these look interchangeable but are NOT. Do not collapse
// them without auditing the call sites first:
//
//   clamp(v, lo, hi)    Requires all three arguments. No defaults.
//   clampForce(v)       Finite-guarded, defaults to the ±50 force envelope.
//   nanGuard(v)         Strict: rejects NaN *and* ±Infinity, returns 0.
//
// `clampForce` exists because mechanicsLaws.js calls a single-argument clamp
// that relies on both the default bounds and the folded finite check. Swapping
// it for `clamp` yields clamp(x, undefined, undefined) => NaN and silently
// poisons the mechanics laws. Keep the two distinct.
//
// `nanGuard` is strict. laws.js historically shipped a narrower NaN-only guard
// (`v !== v ? 0 : v`) that lets ±Infinity through to the downstream clamp. That
// module keeps its local guard until the physics semantics are reviewed; see
// the audit doc §2.3 follow-up.
// ============================================================================

/** Clamp to [lo, hi]. All three arguments are required. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Clamp a single force component to the ±50 stability envelope, rejecting
 * non-finite input. This is the form mechanicsLaws.js calls with one argument.
 */
export function clampForce(v, lo = -50, hi = 50) {
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0;
}

/** Clamp to [0, 1], rejecting non-finite input. */
export function clamp01(v) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** Clamp a treasury/price value to [0, max] (VEPA's sanity cap is 10000). */
export function clampTreasury(v, max = 10000) {
  return v < 0 ? 0 : v > max ? max : v;
}

/**
 * Strict NaN/Infinity guard. Returns 0 for anything that is not finite.
 * Prefer this over an ad-hoc `(v !== v) ? 0 : v` check.
 */
export function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/** Coerce to a finite number, falling back to `fallback` (default 0). */
export function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Coerce to a number, falling back to `dflt` when the value is absent or
 * non-numeric. Unlike `finite`, this runs `Number(v)` first, so it also
 * accepts numeric strings.
 */
export function num(v, dflt = 0) {
  return Number.isFinite(Number(v)) ? Number(v) : dflt;
}

/**
 * Deterministic 32-bit integer hash of a coordinate pair. Used by the
 * deterministic placement passes in stellar/exoticMatter/quantumMacro, so the
 * exact arithmetic here is part of the reproducibility contract — do not
 * "simplify" it.
 */
export function hash2(a, b) {
  let h = (a * 73856093) ^ (b * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Squared 3D distance between two `{ cx, cy, cz }` centroid records.
 * Squared to avoid a sqrt in comparison loops.
 */
export function centroidDist2(a, b) {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 + (a.cz - b.cz) ** 2;
}

/** Recursively freeze a plain object/array tree. Idempotent. */
export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
