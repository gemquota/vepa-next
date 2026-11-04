import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../src/constants.js';
import {
  setBuffer,
  applyChargeForce,
  applyMemoryRefresh,
  applyTrailWrite,
  applyEntanglePair,
} from '../../src/physics/laws.js';

/**
 * Characterization test for the A9 debt (docs/A9-MIGRATION-PLAN.md).
 *
 * These assertions pin the CURRENT implicit-global contract. They exist so the
 * migration has a safety net and so the debt stays visible: if someone removes
 * `setBuffer` without migrating the 45 laws, this file fails loudly instead of
 * the laws silently writing through a stale or null buffer.
 */
const LAWS_SRC = readFileSync('src/physics/laws.js', 'utf8');
const SOLVER_SRC = readFileSync('src/physics/solver.js', 'utf8');

function fixture() {
  const view = new Float32Array(PARTICLE_STRIDE * 2);
  view[S.MASS] = 2;
  view[S.POS_X] = 1;
  view[S.POS_Y] = 0;
  view[S.POS_Z] = 0;
  view[PARTICLE_STRIDE + S.MASS] = 3;
  view[PARTICLE_STRIDE + S.POS_X] = 3;
  return view;
}

describe('A9 debt inventory (buffer_global singleton)', () => {
  it('still declares a module-level mutable buffer binding', () => {
    expect(LAWS_SRC).toMatch(/let\s+buffer_global\s*=\s*null/);
  });

  it('binds it from exactly one place, at the top of solve()', () => {
    expect(SOLVER_SRC).toMatch(/setBuffer\(particleBuffer\)/);
    // The whole point of the migration is that this call disappears.
    const bindings = SOLVER_SRC.match(/setBuffer\(/g) || [];
    expect(bindings).toHaveLength(1);
  });

  it('leaves laws writing through the global without an explicit view', () => {
    // Sanity-check the hazard is real: a law mutates the buffer that was last
    // handed to setBuffer, with no buffer argument of its own.
    const view = fixture();
    setBuffer(view);
    const before = view[S.TRAIL_X];
    // speed >= 0.5 takes the direct write path: TRAIL = pos + vel * 8
    applyTrailWrite(0, 5, 6, 7, 1, 1, 1);
    expect(view[S.TRAIL_X]).toBe(13);
    expect(view[S.TRAIL_X]).not.toBe(before);
  });

  it('rebinds per buffer, which is what makes shards unsafe if run concurrently', () => {
    const a = fixture();
    const b = fixture();
    setBuffer(a);
    applyTrailWrite(0, 11, 0, 0, 1, 0, 0);
    setBuffer(b);
    applyTrailWrite(0, 22, 0, 0, 1, 0, 0);
    // Each write landed in whichever buffer was bound last — the laws had no
    // way to state which world they meant.
    expect(a[S.TRAIL_X]).toBe(19);
    expect(b[S.TRAIL_X]).toBe(30);
  });

  it('exercises the laws named in the migration plan', () => {
    const view = fixture();
    setBuffer(view);
    applyMemoryRefresh(0, PARTICLE_STRIDE);
    applyEntanglePair(0, PARTICLE_STRIDE, 1);
    expect(Number.isFinite(view[S.MEMORY])).toBe(true);
    expect(Number.isFinite(view[S.ENTANGLE_ID])).toBe(true);
  });

  it('keeps the raw pair laws independent of lawState gating', () => {
    // These are primitive laws invoked directly by the solver; the bitmask is
    // checked by the dispatcher, not inside them. Pinning this so the migration
    // does not accidentally start gating them.
    const view = fixture();
    setBuffer(view);
    view[S.DNA_CACHE_START + D.POLARITY] = 1;
    view[PARTICLE_STRIDE + S.DNA_CACHE_START + D.POLARITY] = 1;
    const force = applyChargeForce(0, PARTICLE_STRIDE, 1, 0, 0, 1.5, 0.8);
    expect(force).not.toBeNull();
    expect(Number.isFinite(force.ax)).toBe(true);
  });
});
