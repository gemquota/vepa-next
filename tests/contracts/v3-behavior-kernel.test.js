import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_SLOTS as S, PARTICLE_STRIDE } from '../../src/sim/particle-layout.js';
import { createParticleIdentityAllocator } from '../../src/sim/particle-identities.js';
import { createDeterministicRandomStreams } from '../../src/core/random-streams.js';
import { applyV3BehaviorKernel } from '../../src/sim/v3-behavior-kernel.js';

function fixture(seed = 42) {
  const count = 3, state = new Float64Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    state[b + S.MASS] = 1; state[b + S.RADIUS] = 1;
    state[b + S.ENERGY] = 100; state[b + S.AGE] = 0;
    state[b + S.POS_X] = i * 2; state[b + S.DEAD] = 0;
  }
  const identities = createParticleIdentityAllocator({ capacity: count });
  for (let i = 0; i < count; i++) identities.allocate(i);
  return { state, count, identities, streams: createDeterministicRandomStreams({ seed }) };
}

test('15-workstream kernel is deterministic for identical state, identities and seed', () => {
  const config = { features: { heat:true, cold:true, radiation:true, sublimation:true, melt:true, boil:true, convection:true, intrinsicJitter:true, chaos:true, genotypeDrift:true, isomerization:true, senescence:true, reproduction:true, allotropy:true, phaseThrough:true, exothermicHeat:true }, parameters: { senescenceAge:999, spawnRate:1, radiationRate:0.001, sublimationThreshold:999, heatJitter:0.2, coldDamping:0.95, meltScale:0.2, boilEnergyThreshold:999, heatOutput:0.1, entropy:0.2, intrinsicJitter:0.1, chaosProbability:1, chaosScale:0.2, genotypeDriftRate:1, genotypeDriftAmplitude:0.01, isomerizationRate:1 } };
  const a = fixture(), b = fixture();
  const ra = applyV3BehaviorKernel({ ...a, dt:0.1, config, pairs:[{a:0,b:1,distance:2,symmetry:0.5}] });
  const rb = applyV3BehaviorKernel({ ...b, dt:0.1, config, pairs:[{a:0,b:1,distance:2,symmetry:0.5}] });
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(ra, rb);
});

test('disabled features consume no random streams and do not mutate state', () => {
  const f = fixture(), before = new Float64Array(f.state);
  applyV3BehaviorKernel({ ...f, dt:0.1, config:{ features:{} } });
  assert.deepEqual(f.state, before);
  assert.equal(f.streams.streamCount, 0);
});

test('reproduction allocates a new generation and initializes a live child', () => {
  const f = fixture();
  f.state[2 * PARTICLE_STRIDE + S.DEAD] = 1;
  f.state[2 * PARTICLE_STRIDE + S.MASS] = 0;
  f.identities.release(f.identities.get(2));
  const result = applyV3BehaviorKernel({ ...f, dt:1, config:{ features:{ reproduction:true }, parameters:{ spawnRate:1, worldWidth:100, worldHeight:100, worldDepth:100 } } });
  assert.equal(result.applied.reproduction, 1);
  assert.equal(f.identities.get(2).id, 'particle:2:2');
  assert.equal(f.state[2 * PARTICLE_STRIDE + S.DEAD], 0);
  assert.ok(f.state[2 * PARTICLE_STRIDE + S.MASS] > 0);
});

test('mass-loss behaviors retire identities exactly once', () => {
  const f = fixture();
  const result = applyV3BehaviorKernel({ ...f, dt:2, config:{ features:{ radiation:true }, parameters:{ radiationRate:1 } } });
  assert.equal(result.applied.retired, 3);
  assert.equal(f.identities.activeCount, 0);
  assert.equal(f.state[S.DEAD], 1);
});

test('pair traversal direction does not change canonical pair-scoped random values', () => {
  const a = fixture(), b = fixture();
  const config = { features:{ allotropy:true, phaseThrough:true, exothermicHeat:true }, parameters:{ allotropyRate:1, exothermicRadius:20 } };
  applyV3BehaviorKernel({ ...a, dt:1, config, pairs:[{a:0,b:1,distance:1}] });
  applyV3BehaviorKernel({ ...b, dt:1, config, pairs:[{a:1,b:0,distance:1}] });
  assert.deepEqual(a.state, b.state);
});
