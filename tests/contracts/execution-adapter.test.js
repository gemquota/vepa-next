import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';

function initial() {
 const state = new Float64Array(2 * STRIDE);
 for (const [i, x] of [[0, 40], [1, 50]]) { const b = i * STRIDE; state[b + S.POS_X] = x; state[b + S.POS_Y] = 50; state[b + S.POS_Z] = 50; state[b + S.MASS] = 1; state[b + S.RADIUS] = 0.1; }
 return state;
}
const config = { worldSize: 100, dt: 1, interactionRadius: 20, resolveContacts: false };

test('execution adapter owns state and returns defensive copies', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 const copy = runtime.readState(); copy[S.POS_X] = -100;
 assert.equal(runtime.readState()[S.POS_X], 40);
 runtime.step(); assert.equal(runtime.tick, 1);
});

test('snapshot restore reproduces the next deterministic state', () => {
 const a = createParticleExecutionAdapter({ initialState: initial(), config });
 a.step(); const snapshot = a.createSnapshot();
 const b = createParticleExecutionAdapter({ initialState: initial(), config });
 b.restoreSnapshot(snapshot);
 a.step(); b.step();
 assert.deepEqual(a.readState(), b.readState());
 assert.equal(a.tick, b.tick);
});

test('invalid configuration leaves the active configuration unchanged', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 assert.throws(() => runtime.configure({ interactionRadius: 100 }), /Invalid physics configuration range/);
 assert.equal(runtime.getConfig().interactionRadius, 20);
});

test('restore rejects a mismatched particle layout before replacing state', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 const snapshot = runtime.createSnapshot();
 assert.throws(() => runtime.restoreSnapshot({ ...snapshot, stride: 99 }), /incompatible/);
 assert.equal(runtime.readState()[S.POS_X], 40);
});

test('keyed random draws are repeatable and included in checkpoints', () => {
 const a = createParticleExecutionAdapter({ initialState: initial(), config, randomSeed: 1234 });
 const b = createParticleExecutionAdapter({ initialState: initial(), config, randomSeed: 1234 });
 assert.equal(a.nextRandom('mutation', 'particle-1'), b.nextRandom('mutation', 'particle-1'));
 a.nextRandom('thermal', 'particle-1');
 const checkpoint = a.createSnapshot();
 const expected = Array.from({ length: 8 }, () => a.nextRandom('mutation', 'particle-1'));
 const restored = createParticleExecutionAdapter({ initialState: initial(), config, randomSeed: 1234 });
 restored.restoreSnapshot(checkpoint);
 assert.deepEqual(Array.from({ length: 8 }, () => restored.nextRandom('mutation', 'particle-1')), expected);
 assert.equal(checkpoint.randomState.schema, 'vepa.random-streams');
});

test('particle identities survive checkpoints and change when a slot is reused', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 const first = runtime.getParticleIdentity(0);
 assert.equal(first.id, 'particle:0:1');
 assert.equal(runtime.retireParticle(0), true);
 const values = new Float64Array(STRIDE);
 values[S.MASS] = 2;
 values[S.RADIUS] = 0.1;
 values[S.DEAD] = 0;
 const second = runtime.allocateParticle(0, values);
 assert.equal(second.id, 'particle:0:2');
 assert.equal(runtime.getParticleIdentity(0).id, second.id);
 const snapshot = runtime.createSnapshot();
 const restored = createParticleExecutionAdapter({ initialState: initial(), config });
 restored.restoreSnapshot(snapshot);
 assert.equal(restored.getParticleIdentity(0).id, second.id);
 assert.equal(restored.retireParticle(0), true);
 assert.equal(restored.retireParticle(0), false);
});

test('particle allocation validates the complete live slot before mutation', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 const before = runtime.readState();
 assert.throws(() => runtime.allocateParticle(0, new Float64Array(STRIDE)), /already alive/);
 assert.throws(() => runtime.allocateParticle(1, [1, 2]), /exactly stride/);
 assert.deepEqual(runtime.readState(), before);
});

test('execution adapter applies opt-in V3 behavior mutations with checkpointed identities', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config, randomSeed: 77 });
 const before = runtime.readState();
 const result = runtime.applyV3Behaviors({ features: { heat: true }, parameters: { heatJitter: 0.5 }, worldId: 'contract-world' });
 assert.equal(result.applied.heat, 2);
 assert.notDeepEqual(runtime.readState(), before);
 const snapshot = runtime.createSnapshot();
 assert.equal(snapshot.identityState.active.filter(Boolean).length, 2);
});

test('energy ledger is integrated into adapter snapshots and advances with simulation ticks', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 runtime.transferEnergy({ source: 'external', destination: 'thermal', amount: 4, cause: 'initial-heating' });
 runtime.step();
 assert.equal(runtime.getEnergySummary().tick, 1);
 assert.equal(runtime.getEnergyAccount('thermal').balance, 4);
 const snapshot = runtime.createSnapshot();
 assert.equal(snapshot.energyLedger.version, 1);
 const restored = createParticleExecutionAdapter({ initialState: initial(), config });
 restored.restoreSnapshot(snapshot);
 assert.deepEqual(restored.getEnergySummary(), runtime.getEnergySummary());
 assert.deepEqual(restored.readEnergyEvents(), runtime.readEnergyEvents());
 restored.transferEnergy({ source: 'external', destination: 'kinetic', amount: 2, cause: 'external-work' });
 assert.equal(restored.getEnergyAccount('kinetic').balance, 2);
});

test('adapter rejects an invalid energy transaction without changing ledger or particle state', () => {
 const runtime = createParticleExecutionAdapter({ initialState: initial(), config });
 const before = runtime.readState();
 assert.throws(() => runtime.transactEnergy([
  { source: 'external', destination: 'thermal', amount: 2, cause: 'valid' },
  { source: 'thermal', destination: 'kinetic', amount: 3, cause: 'invalid' },
 ]), /Insufficient/);
 assert.equal(runtime.getEnergyAccount('thermal').balance, 0);
 assert.equal(runtime.readEnergyEvents().length, 0);
 assert.deepEqual(runtime.readState(), before);
});
