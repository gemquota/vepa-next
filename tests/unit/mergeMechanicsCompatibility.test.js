import { describe, it, expect } from 'vitest';
import { LAW_INDEXES, PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../src/constants.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { createParticleIdentityAllocator } from '../../sim-foundation/src/sim/particle-identities.js';
import { adjoinParticles, isAccretionPair, applyAlloy } from '../../src/physics/mergePhysics.js';

function pair() {
  const view = new Float32Array(2 * PARTICLE_STRIDE);
  const rows = [
    { x: 10, mass: 3, vx: 2, species: 1, dna: 0.2, energy: 20, colour: [0.2, 0.4, 0.6] },
    { x: 11, mass: 1, vx: -2, species: 2, dna: 0.8, energy: 60, colour: [0.8, 0.6, 0.4] },
  ];
  rows.forEach((p, i) => {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = p.x; view[b + S.POS_Y] = 10; view[b + S.POS_Z] = 10;
    view[b + S.VEL_X] = p.vx; view[b + S.MASS] = p.mass; view[b + S.RADIUS] = 1;
    view[b + S.SPECIES_ID] = p.species; view[b + S.ENERGY] = p.energy;
    view[b + S.COLOR_R] = p.colour[0]; view[b + S.COLOR_G] = p.colour[1]; view[b + S.COLOR_B] = p.colour[2];
    view[b + S.BOND_PARTNER_1] = -1;
    for (let d = 0; d < 42; d++) view[b + S.DNA_CACHE_START + d] = p.dna;
  });
  return view;
}

describe('ACCR and ALLOY mechanics identity contract', () => {
  it('ACCR adjoins two particles without fusing mass or retiring either identity', () => {
    const view = pair();
    const identities = createParticleIdentityAllocator({ capacity: 2 });
    const a = identities.allocate(0), b = identities.allocate(1);
    adjoinParticles(view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE);
    expect(view[S.MASS]).toBe(3);
    expect(view[PARTICLE_STRIDE + S.MASS]).toBe(1);
    expect(view[S.DEAD]).toBe(0);
    expect(view[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    expect(isAccretionPair(view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE)).toBe(true);
    expect(identities.get(0)).toEqual(a);
    expect(identities.get(1)).toEqual(b);
    expect(view[S.BOND_COUNT]).toBe(1);
    expect(view[PARTICLE_STRIDE + S.BOND_COUNT]).toBe(1);
    const center = (3 * view[S.POS_X] + view[PARTICLE_STRIDE + S.POS_X]) / 4;
    expect(center).toBeCloseTo(10.25, 5);
    expect(Math.abs(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X])).toBeCloseTo(2, 5);
  });

  it('ALLOY fuses different species into one mass-weighted hybrid and retires only the absorbed endpoint', () => {
    const view = pair();
    const laws = createLawState();
    set(laws, LAW_INDEXES.ALLOY);
    const identities = createParticleIdentityAllocator({ capacity: 2 });
    const survivor = identities.allocate(0);
    const absorbed = identities.allocate(1);
    applyAlloy(laws, view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 1, 1);
    expect(view[S.MASS]).toBe(4);
    expect(view[S.VEL_X]).toBe(1);
    expect(view[S.DNA_CACHE_START]).toBeCloseTo(0.35, 6);
    expect(view[S.COLOR_R]).toBeCloseTo(0.35, 6);
    expect(view[S.ENERGY]).toBeCloseTo(30, 5);
    expect(view[S.SPECIES_ID]).toBe(1);
    expect(view[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(view[PARTICLE_STRIDE + S.MASS]).toBe(1);
    expect(identities.get(0)).toEqual(survivor);
    expect(identities.get(1)).toEqual(absorbed);
    expect(identities.release(absorbed)).toBe(true);
    expect(identities.get(1)).toBeNull();
    expect(identities.get(0)).toEqual(survivor);
  });
});
