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
