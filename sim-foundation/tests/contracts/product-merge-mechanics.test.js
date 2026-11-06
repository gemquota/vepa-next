import test from 'node:test';
import assert from 'node:assert/strict';
import { LAW_INDEXES, PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../../src/constants.js';
import { createLawState, set } from '../../../src/state/lawState.js';
import { adjoinParticles, isAccretionPair, applyAlloy } from '../../../src/physics/mergePhysics.js';

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

test('ACCR adjoins two particles without fusing mass or retiring either identity', () => {
  const view = pair();
  adjoinParticles(view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE);
  assert.equal(view[S.MASS], 3);
  assert.equal(view[PARTICLE_STRIDE + S.MASS], 1);
  assert.equal(view[S.DEAD], 0);
  assert.equal(view[PARTICLE_STRIDE + S.DEAD], 0);
  assert.equal(isAccretionPair(view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE), true);
  assert.equal(view[S.BOND_COUNT], 1);
  assert.equal(view[PARTICLE_STRIDE + S.BOND_COUNT], 1);
  const center = (3 * view[S.POS_X] + view[PARTICLE_STRIDE + S.POS_X]) / 4;
  assert.ok(Math.abs(center - 10.25) < 1e-5);
  assert.ok(Math.abs(Math.abs(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]) - 2) < 1e-5);
});

test('ALLOY fuses different species into one mass-weighted hybrid and retires only the absorbed endpoint', () => {
  const view = pair();
  const laws = createLawState();
  set(laws, LAW_INDEXES.ALLOY);
  applyAlloy(laws, view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 1, 1);
  assert.equal(view[S.MASS], 4);
  assert.equal(view[S.VEL_X], 1);
  assert.ok(Math.abs(view[S.DNA_CACHE_START] - 0.35) < 1e-5);
  assert.ok(Math.abs(view[S.COLOR_R] - 0.35) < 1e-5);
  assert.ok(Math.abs(view[S.ENERGY] - 30) < 1e-5);
  assert.equal(view[S.SPECIES_ID], 1);
  assert.equal(view[S.DEAD], 0);
  assert.equal(view[PARTICLE_STRIDE + S.DEAD], 1);
  assert.equal(view[PARTICLE_STRIDE + S.MASS], 1);
});

test('ALLOY leaves bonded pairs separate', () => {
  const view = pair();
  view[S.BOND_COUNT] = 1;
  view[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
  view[S.BOND_PARTNER_1] = 1;
  view[PARTICLE_STRIDE + S.BOND_PARTNER_1] = 0;
  const laws = createLawState();
  set(laws, LAW_INDEXES.ALLOY);
  applyAlloy(laws, view, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 1, 1);
  assert.equal(view[S.MASS], 3);
  assert.equal(view[PARTICLE_STRIDE + S.MASS], 1);
  assert.equal(view[PARTICLE_STRIDE + S.DEAD], 0);
});
