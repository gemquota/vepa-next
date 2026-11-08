import test from 'node:test';
import assert from 'node:assert/strict';
import { stepParticleWorld } from '../../src/sim/solver.js';
import { PARTICLE_SLOTS as S, PARTICLE_STRIDE } from '../../src/sim/particle-layout.js';

function world({ a = {}, b = {}, law, ...config }) {
  const state = new Float64Array(PARTICLE_STRIDE * 2);
  const set = (index, values) => {
    const base = index * PARTICLE_STRIDE;
    state[base + S.MASS] = 1;
    state[base + S.RADIUS] = 1;
    state[base + S.POS_X] = index === 0 ? 10 : 12;
    state[base + S.POS_Y] = 10;
    state[base + S.POS_Z] = 10;
    state[base + S.DEAD] = 0;
    for (const [key, value] of Object.entries(values)) {
      if (key === 'VISCOSITY') state[base + S.DNA_CACHE_START + 1] = value;
      else state[base + S[key]] = value;
    }
  };
  set(0, a); set(1, b);
  const metrics = stepParticleWorld(state, 2, {
    worldSize: 100, dt: 0.1, interactionRadius: 20, softening: 1,
    gravitationalConstant: 0, electricConstant: 0, resolveContacts: false,
    activeLawIds: [law], ...config,
  });
  return { state, metrics };
}

test('TIDE ports the product massJ * coefficient / distance attraction', () => {
  const { state } = world({ law: 'law.tide', b: { MASS: 2 } });
  assert.ok(state[S.VEL_X] > 0);
});

test('HORIZON ports the bounded mass/radius capture falloff', () => {
  const { state } = world({ law: 'law.horizon', b: { MASS: 100, RADIUS: 1 } });
  assert.ok(state[S.VEL_X] > 0);
});

test('RADIATION_PRESSURE pushes away from a neighbor energy inventory', () => {
  const { state } = world({ law: 'law.radiation-pressure', b: { ENERGY: 10 } });
  assert.ok(state[S.VEL_X] < 0);
});

test('FIELD attracts toward the world centre once per product neighbor pair', () => {
  const { state } = world({ law: 'law.field' });
  assert.ok(state[S.VEL_X] > 0);
  assert.ok(state[S.VEL_Y] > 0);
  assert.ok(state[S.VEL_Z] > 0);
});

test('FRICTION damps velocity and converts removed motion into temperature', () => {
  const { state } = world({
    law: 'law.friction',
    a: { VEL_X: 2, VISCOSITY: 0.5 },
    frictionCoefficient: 0.05,
  });
  assert.ok(state[S.VEL_X] < 2);
  assert.ok(state[S.VEL_X] > 0);
  assert.ok(state[S.TEMPERATURE] > 0);
});
