import { afterEach, describe, expect, it } from 'vitest';
import { PARTICLE_STRIDE as T, STRIDE_INDEXES as S, DNA_INDEXES as D, LAW_INDEXES as L } from '../../src/constants.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import { solve } from '../../src/physics/solver.js';
import { applyPolymer } from '../../src/physics/laws.js';
import { applyAdhesion } from '../../src/physics/lawgroups/mechanicsLaws.js';
import { resolveParticleContacts } from '../../src/physics/contactConstraints.js';

const previous = runtimeConfig.worldParams;
afterEach(() => { runtimeConfig.worldParams = previous; });
const slots = [S.BOND_PARTNER_1, S.BOND_PARTNER_2, S.BOND_PARTNER_3, S.BOND_PARTNER_4, S.BOND_PARTNER_5, S.BOND_PARTNER_6];
function world(points, radius = 3) {
  const v = new Float32Array(points.length * T);
  points.forEach((point, i) => {
    const b = i * T;
    [S.POS_X, S.POS_Y, S.POS_Z].forEach((slot, axis) => { v[b + slot] = point[axis]; });
    v[b + S.MASS] = 1;
    v[b + S.RADIUS] = radius;
    v[b + S.ENERGY] = 100;
    v[b + S.DNA_CACHE_START + D.BASE_RADIUS] = radius;
    v[b + S.DNA_CACHE_START + D.STIFFNESS] = 1;
    v[b + S.DNA_CACHE_START + D.VISCOSITY] = 1;
    slots.forEach((slot) => { v[b + slot] = -1; });
  });
  return v;
}
const distance = (v, i = 0, j = 1) => Math.hypot(...[S.POS_X, S.POS_Y, S.POS_Z].map((s) => v[j * T + s] - v[i * T + s]));
function laws(...names) { const state = createLawState(); names.forEach((name) => set(state, L[name])); return state; }

describe('surface contact and structures', () => {
  it('separates stationary coincident centers deterministically and preserves center of mass', () => {
    const v = world([[100, 100, 100], [100, 100, 100]]);
    v[T + S.MASS] = 3;
    const copy = v.slice();
    resolveParticleContacts(v, 2, T, 800, false);
    resolveParticleContacts(copy, 2, T, 800, false);
    expect(v).toEqual(copy);
    expect(distance(v)).toBeGreaterThanOrEqual(6 - 1e-4);
    for (const s of [S.POS_X, S.POS_Y, S.POS_Z]) expect((v[s] + 3 * v[T + s]) / 4).toBeCloseTo(100, 4);
  });
  it('resolves large bodies and toroidal seams without wrapping wall geometry', () => {
    const v = world([[1, 50, 50], [99, 50, 50]], 20);
    const walls = v.slice();
    resolveParticleContacts(v, 2, T, 100, true);
    const dx = Math.abs(v[S.POS_X] - v[T + S.POS_X]);
    expect(Math.min(dx, 100 - dx)).toBeGreaterThanOrEqual(40 - 1e-4);
    resolveParticleContacts(walls, 2, T, 100, false);
    expect(walls[S.POS_X]).toBe(1);
  });
  it('does not discard contacts because force budgets or cell caps are small', () => {
    const points = Array.from({ length: 16 }, (_, i) => [100 + (i % 4) * 4, 100 + Math.floor(i / 4) * 4, 100]);
    const v = world(points);
    runtimeConfig.worldParams = { AUTO_TUNE: 0, GRID_DIM: 64, CELL_CAP: 1, MAX_INTERACTIONS: 8, NEIGHBOR_BUF: 24 };
    solve(v, 16, T, laws('CONTACT'), null, 800, 0.1, () => 0.5);
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) expect(distance(v, i, j)).toBeGreaterThan(5.8);
  });
  it('projects after integration AND mass-derived radius growth; dead absorbed particles are skipped', () => {
    const v = world([[100, 100, 100], [105, 100, 100]], 8);
    v[S.VEL_X] = 5;
    v[T + S.VEL_X] = -5;
    solve(v, 2, T, laws('CONTACT'), null, 800, 0.5, () => 0.5);
    expect(distance(v)).toBeGreaterThanOrEqual(v[S.RADIUS] + v[T + S.RADIUS] - 1e-4);
    v[T + S.DEAD] = 1;
    v[T + S.POS_X] = v[S.POS_X];
    const before = v.slice();
    resolveParticleContacts(v, 2, T, 800, false);
    expect(v).toEqual(before);
  });
  it('POLYMER returns surface-restoring forces for large particles and the solver consumes the spring', () => {
    const v = world([[100, 100, 100], [109, 100, 100]], 4);
    const state = laws('POLYMER');
    const force = applyPolymer(state, v, 0, T, 9, 0, 0, 9, 1, T);
    expect(force.ax).toBeGreaterThan(0);
    expect(v[S.BOND_PARTNER_1]).toBe(1);
    const touching = applyPolymer(state, v, 0, T, 8, 0, 0, 8, 1, T);
    expect(touching.ax).toBe(0);
    solve(v, 2, T, state, null, 800, 0.25, () => 0.5);
    expect(v[S.VEL_X]).toBeGreaterThan(0);
    expect(distance(v)).toBeGreaterThanOrEqual(8 - 1e-4);
    expect(v[S.BOND_COUNT]).toBe(1);
    expect(v[T + S.BOND_COUNT]).toBe(1);
  });
  it('keeps a three-particle polymer chain bilateral and non-overlapping over repeated ticks', () => {
    const v = world([[100, 100, 100], [107, 100, 100], [114, 100, 100]]);
    runtimeConfig.worldParams = { POLYMER_LIMIT: 2, AUTO_TUNE: 0, QUALITY_MODE: 0 };
    const state = laws('POLYMER', 'CONTACT');
    for (let tick = 0; tick < 40; tick++) solve(v, 3, T, state, null, 800, 0.1, () => 0.5);
    expect(v[S.BOND_COUNT]).toBe(1);
    expect(v[T + S.BOND_COUNT]).toBe(2);
    expect(v[2 * T + S.BOND_COUNT]).toBe(1);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      expect(distance(v, i, j)).toBeGreaterThanOrEqual(v[i * T + S.RADIUS] + v[j * T + S.RADIUS] - 1e-4);
    }
  });

  it('adhesion closes a surface gap but stops pulling inward at contact', () => {
    const v = world([[100, 100, 100], [107, 100, 100]]);
    expect(applyAdhesion(v, 0, T, 7, 0, 0, 7).ax).toBeGreaterThan(0);
    expect(applyAdhesion(v, 0, T, 6, 0, 0, 6)).toBeNull();
    expect(applyAdhesion(v, 0, T, 5, 0, 0, 5).ax).toBeLessThan(0);
  });
});
