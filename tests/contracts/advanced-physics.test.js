import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { stepParticleWorld } from '../../src/sim/solver.js';
import { validateAdvancedPhysicsConfig } from '../../src/sim/advanced-physics.js';

function pair({ x1 = 40, x2 = 44, mass1 = 1, mass2 = 1 } = {}) {
  const v = new Float64Array(2 * STRIDE);
  for (const [i, x, mass] of [[0, x1, mass1], [1, x2, mass2]]) {
    const b = i * STRIDE;
    v[b + S.POS_X] = x; v[b + S.POS_Y] = 50; v[b + S.POS_Z] = 50;
    v[b + S.MASS] = mass; v[b + S.RADIUS] = 3;
    v[b + S.ENERGY] = 20; v[b + S.TEMPERATURE] = i ? 10 : 0;
  }
  return v;
}
const base = { worldSize: 100, dt: 1, interactionRadius: 20, gravitationalConstant: 0,
  electricConstant: 0, dragCoefficient: 0, resolveContacts: false, activeLawIds: [] };

test('advanced physics is opt-in and validates its explicit profile', () => {
  const view = pair();
  const result = stepParticleWorld(view, 2, base);
  assert.deepEqual(result.advancedPhysics, { pairs: 0, thermalTransfers: 0, reactions: 0, decays: 0, phaseChanges: 0 });
  assert.throws(() => validateAdvancedPhysicsConfig({ magnetic: { enabled: true, field: [1, 2] } }), /three-number/);
  assert.throws(() => validateAdvancedPhysicsConfig({ collisions: { enabled: true, restitution: 2, friction: 0 } }), /<= 1/);
});

test('magnetic Lorentz force bends charged moving particles perpendicular to field', () => {
  const view = pair();
  view[S.VEL_X] = 1; view[S.CHARGE] = 1;
  stepParticleWorld(view, 2, { ...base, advancedPhysics: { magnetic: { enabled: true, field: [0, 0, 1], scale: 1 } } });
  assert.ok(view[S.VEL_Y] < 0);
  assert.equal(view[S.VEL_X], 1);
});

test('thermal conduction transfers energy without changing total thermal energy', () => {
  const view = pair();
  const before = view[S.ENERGY] + view[STRIDE + S.ENERGY];
  const result = stepParticleWorld(view, 2, { ...base, advancedPhysics: {
    thermal: { enabled: true, conductivity: 1, smoothingLength: 10, heatCapacity: 2 },
  } });
  assert.equal(result.advancedPhysics.thermalTransfers, 1);
  assert.equal(view[S.ENERGY] + view[STRIDE + S.ENERGY], before);
  assert.ok(view[S.TEMPERATURE] > 0);
  assert.ok(view[STRIDE + S.TEMPERATURE] < 10);
});

test('contact restitution conserves pair momentum for equal masses', () => {
  const view = pair();
  view[S.VEL_X] = 1; view[STRIDE + S.VEL_X] = -1;
  stepParticleWorld(view, 2, { ...base, advancedPhysics: {
    collisions: { enabled: true, restitution: 1, friction: 0 },
  } });
  assert.ok(Math.abs(view[S.VEL_X] + view[STRIDE + S.VEL_X]) < 1e-12);
  assert.ok(view[S.VEL_X] < 0 && view[STRIDE + S.VEL_X] > 0);
});

test('phase transitions consume configured latent heat exactly once', () => {
  const view = pair();
  view[S.SPECIES_ID] = 2; view[S.TEMPERATURE] = 100; view[S.PHASE_1] = 0;
  const profile = { phase: { enabled: true, materials: [
    { speciesId: 2, meltPoint: 20, boilPoint: 80, latentFusion: 3, latentVaporization: 5 },
  ] } };
  const first = stepParticleWorld(view, 2, { ...base, advancedPhysics: profile });
  assert.equal(first.advancedPhysics.phaseChanges, 1);
  assert.equal(view[S.PHASE_1], 2);
  assert.equal(view[S.ENERGY], 15);
  const second = stepParticleWorld(view, 2, { ...base, advancedPhysics: profile });
  assert.equal(second.advancedPhysics.phaseChanges, 0);
  assert.equal(view[S.ENERGY], 15);
});

test('pair chemistry advances deterministic reaction progress and applies enthalpy', () => {
  const view = pair();
  view[S.SPECIES_ID] = 1; view[STRIDE + S.SPECIES_ID] = 2;
  const result = stepParticleWorld(view, 2, { ...base, advancedPhysics: { chemistry: {
    enabled: true, reactions: [{ speciesA: 1, speciesB: 2, productA: 3, productB: 4, rate: 1, energy: 6 }],
  } } });
  assert.equal(result.advancedPhysics.reactions, 1);
  assert.equal(view[S.SPECIES_ID], 3);
  assert.equal(view[STRIDE + S.SPECIES_ID], 4);
  assert.equal(view[S.ENERGY] + view[STRIDE + S.ENERGY], 46);
});

test('radioactive decay converts configured mass defect into energy', () => {
  const view = pair();
  view[S.SPECIES_ID] = 5;
  const result = stepParticleWorld(view, 2, { ...base, advancedPhysics: { nuclear: {
    enabled: true, decays: [{ speciesId: 5, productSpeciesId: 6, rate: 1, massDefectFraction: 0.1, speedOfLightSquared: 100 }],
  } } });
  assert.equal(result.advancedPhysics.decays, 1);
  assert.equal(view[S.MASS], 0.9);
  assert.equal(view[S.ENERGY], 30);
  assert.equal(view[S.SPECIES_ID], 6);
});

test('SPH pressure and viscosity produce equal-and-opposite pair momentum changes', () => {
  const view = pair();
  view[S.VEL_X] = 1; view[STRIDE + S.VEL_X] = -1;
  const before = view[S.MASS] * view[S.VEL_X] + view[STRIDE + S.MASS] * view[STRIDE + S.VEL_X];
  stepParticleWorld(view, 2, { ...base, advancedPhysics: { sph: {
    enabled: true, smoothingLength: 10, restDensity: 0.1, pressureStiffness: 2, viscosity: 0.1,
  } } });
  const after = view[S.MASS] * view[S.VEL_X] + view[STRIDE + S.MASS] * view[STRIDE + S.VEL_X];
  assert.ok(Math.abs(after - before) < 1e-10);
});

test('radiation pressure applies a configurable external acceleration', () => {
  const view = pair({ mass1: 2 });
  stepParticleWorld(view, 2, { ...base, advancedPhysics: { radiation: {
    enabled: true, direction: [1, 0, 0], pressure: 2,
  } } });
  assert.equal(view[S.VEL_X], 1);
});
