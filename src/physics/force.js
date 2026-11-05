// ============================================================================
// VEPA4 — Force emission helpers
//
// Law functions return accelerations as { ax, ay, az }. Every law used to
// hand-write that triple with the same guard-and-clamp on each axis:
//
//   return { ax: clamp(nanGuard(dx * k), -50, 50),
//            ay: clamp(nanGuard(dy * k), -50, 50),
//            az: clamp(nanGuard(dz * k), -50, 50) };
//
// That shape appeared 64 times across 8 law modules, so a change to the
// stability envelope (MAX_FORCE) meant editing dozens of sites, and a missing
// guard on one axis was invisible in review. force3() makes the envelope a
// single argument and the guard impossible to omit.
//
// SCOPE: this is for *force components only*. Laws that clamp buffer state
// (ENERGY 0-200, SIGNAL 0-10, ARMOR 0-5, ...) are NOT forces and must keep
// using clamp()/nanGuard() directly against their own bounds.
//
// See docs/CODEBASE-AUDIT-2026-09-30.md §2.2 (P-1).
// ============================================================================

import { clamp, nanGuard } from '../core/numeric.js';

/** Default stability envelope, matching MAX_FORCE in src/physics/solver.js. */
export const DEFAULT_FORCE_LIMIT = 50;

/**
 * Build a guarded, envelope-clamped { ax, ay, az } force.
 *
 * @param {number} ax  x acceleration (non-finite values become 0)
 * @param {number} ay  y acceleration
 * @param {number} az  z acceleration
 * @param {number} [limit=50]  symmetric magnitude limit
 * @returns {{ax:number, ay:number, az:number}}
 */
export function force3(ax, ay, az, limit = DEFAULT_FORCE_LIMIT) {
  return {
    ax: clamp(nanGuard(ax), -limit, limit),
    ay: clamp(nanGuard(ay), -limit, limit),
    az: clamp(nanGuard(az), -limit, limit),
  };
}
