/**
 * VEPA4 — Goal-Driven Behavior (Set H.2 · Agency & Narrative)
 *
 * Each species' learned memory (Set G) becomes a behavioral goal:
 *   THREAT high        → flee (push away from the world centre)
 *   EXPLORATION high   → seek (pull toward the world centre)
 *   otherwise          → hold (no nudge)
 *
 * Nudges are small velocity deltas applied after the solve, well under
 * MAX_FORCE / MAX_VELOCITY — the physics still decides everything else.
 */

import { STRIDE_INDEXES } from '../constants.js';
import { MEM } from '../state/memoryBuffers.js';

/**
 * Derive a per-species goal from its memory buffer.
 * @param {object} memoryBuffers  memoryBuffers instance (Set G)
 * @param {Iterable<number>} speciesIds
 * @returns {Map<number, {kind: 'seek'|'flee'|'hold', strength: number}>}
 */
export function computeSpeciesGoals(memoryBuffers, speciesIds) {
  const goals = new Map();
  for (const id of speciesIds) {
    const mem = memoryBuffers.speciesMem.get(id);
    if (!mem) continue;
    let kind = 'hold';
    let strength = 0;
    if (mem[MEM.THREAT] > 0.6) {
      kind = 'flee';
      strength = mem[MEM.THREAT];
    } else if (mem[MEM.EXPLORATION] > 0.3) {
      kind = 'seek';
      strength = mem[MEM.EXPLORATION];
    }
    goals.set(id, { kind, strength: Math.max(0, Math.min(1, strength)) });
  }
  return goals;
}

/**
 * Apply goal velocity nudges in place. Deterministic and bounded.
 * @param {Float32Array} view
 * @param {number} count
 * @param {number} stride
 * @param {Map} goals  output of computeSpeciesGoals
 * @param {number} worldSize
 * @param {object} [opts]  { strength } — nudge magnitude (default 0.02)
 */
export function applyGoalNudges(view, count, stride, goals, worldSize, opts = {}) {
  const S = STRIDE_INDEXES;
  const base = opts.strength ?? 0.02;
  const center = worldSize / 2;

  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const goal = goals.get(view[b + S.SPECIES_ID] | 0);
    if (!goal || goal.kind === 'hold') continue;

    const px = view[b + S.POS_X];
    const py = view[b + S.POS_Y];
    const pz = view[b + S.POS_Z];
    const dx = center - px;
    const dy = center - py;
    const dz = center - pz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const dir = goal.kind === 'seek' ? 1 : -1;
    const s = (base * goal.strength) / dist;

    view[b + S.VEL_X] += dx * s * dir;
    view[b + S.VEL_Y] += dy * s * dir;
    view[b + S.VEL_Z] += dz * s * dir;
  }
}
