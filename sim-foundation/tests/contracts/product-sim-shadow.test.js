import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createProductSimShadow } from '../../src/interop/product-shadow-runtime.js';

function initial() {
  const state = new Float32Array(PARTICLE_STRIDE);
  state[S.POS_X] = 50; state[S.POS_Y] = 50; state[S.POS_Z] = 50;
  state[S.MASS] = 1; state[S.RADIUS] = 0.1; state[S.DEAD] = 0;
  state[S.ENERGY] = 10;
  return state;
}
const basePayload = (activeLawNames = [], config = {}) => ({
  state: initial(), count: 1, stride: PARTICLE_STRIDE,
  worldId: 'product-shadow-contract', seed: 77, legacyPrngState: 77,
  activeLawNames,
  config: { worldId: 'product-shadow-contract', worldSize: 100, dt: 0.001, interactionRadius: 20,
    boundaryMode: 'toroidal', gravitationalConstant: 1, electricConstant: 0,
    dragCoefficient: 0.01, softening: 0.5, ...config },
});

test('product shadow uses versioned worker envelopes and fails closed for unsupported laws', () => {
  const shadow = createProductSimShadow({ worldId: 'product-shadow-contract', seed: 77 });
  const init = shadow.request('INIT', basePayload(['GRAV', 'ACCR']));
  assert.equal(init.type, 'INIT_COMPLETE');
  assert.equal(init.payload.status, 'unsupported');
  assert.deepEqual(init.payload.unsupportedLawNames, ['ACCR']);
  assert.equal(shadow.status, 'unsupported');
  assert.equal(shadow.request('TICK', { dt: 0.001 }).type, 'ERROR');
  assert.equal(shadow.request('TOGGLE_LAW', { lawName: 'GRAV' }).type, 'ERROR');
});

test('product shadow steps an isolated SIM copy, reports parity and snapshots/restores', () => {
  const shadow = createProductSimShadow({ worldId: 'product-shadow-contract', seed: 77 });
  const init = shadow.request('INIT', basePayload([]));
  assert.equal(init.type, 'INIT_COMPLETE');
  assert.equal(init.payload.status, 'ready');
  const tick = shadow.request('TICK', {
    dt: 0.001, productState: initial(), legacyPrngState: 78,
  });
  assert.equal(tick.type, 'TICK_COMPLETE');
  assert.equal(tick.payload.status, 'ready');
  assert.equal(tick.payload.comparison.maxAbsDifference, 0);
  const read = shadow.request('GET_STATE');
  assert.equal(read.type, 'STATE');
  assert.equal(read.payload.snapshot.schema, 'vepa.product-sim-shadow');
  assert.equal(read.payload.snapshot.legacyPrng.state, 78);
  const restored = shadow.request('RESTORE', { snapshot: read.payload.snapshot });
  assert.equal(restored.type, 'RESTORE_COMPLETE');
  assert.equal(restored.payload.status, 'ready');
});

test('advanced physics is opt-in, validated and included in shadow checkpoints', () => {
  const shadow = createProductSimShadow({ worldId: 'product-shadow-contract', seed: 77 });
  const profile = { thermal: { enabled: true, conductivity: 0.2, smoothingLength: 12, heatCapacity: 2 } };
  const init = shadow.request('INIT', basePayload([], { advancedPhysics: profile }));
  assert.equal(init.payload.status, 'ready');
  const read = shadow.request('GET_STATE');
  assert.deepEqual(read.payload.snapshot.simSnapshot.config.advancedPhysics.thermal, profile.thermal);

  const invalid = createProductSimShadow({ worldId: 'product-shadow-contract', seed: 77 });
  const rejected = invalid.request('INIT', basePayload([], {
    advancedPhysics: { thermal: { enabled: true, conductivity: Infinity, smoothingLength: 12, heatCapacity: 2 } },
  }));
  assert.equal(rejected.type, 'ERROR');
});

test('shadow worker protocol maps CONFIG, STEP, READ_STATE and RESTORE but never maps TOGGLE_LAW', () => {
  const shadow = createProductSimShadow({ worldId: 'product-shadow-contract', seed: 77 });
  shadow.request('INIT', basePayload([]));
  assert.equal(shadow.request('CONFIG', { state: initial(), count: 1, stride: PARTICLE_STRIDE,
    worldId: 'product-shadow-contract', activeLawNames: [], seed: 77,
    config: { worldSize: 100, dt: 0.002, interactionRadius: 20, boundaryMode: 'toroidal' } }).type, 'CONFIG_COMPLETE');
  assert.equal(shadow.request('PING').type, 'PONG');
  assert.equal(shadow.request('GET_STATE').type, 'STATE');
});
