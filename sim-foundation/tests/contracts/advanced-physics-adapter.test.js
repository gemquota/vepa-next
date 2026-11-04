import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';

function initial() {
  const state = new Float64Array(2 * STRIDE);
  for (const i of [0, 1]) {
    const b = i * STRIDE;
    state[b + S.POS_X] = 40 + i * 4;
    state[b + S.POS_Y] = 50; state[b + S.POS_Z] = 50;
    state[b + S.MASS] = 1; state[b + S.RADIUS] = 1;
  }
  return state;
}
const config = { worldSize: 100, dt: 1, interactionRadius: 20, resolveContacts: false };

test('advanced physics profiles are validated, cloned and preserved in snapshots', () => {
  const profile = { thermal: { enabled: true, conductivity: 0.2, smoothingLength: 12, heatCapacity: 2 } };
  const runtime = createParticleExecutionAdapter({ initialState: initial(), config: { ...config, advancedPhysics: profile } });
  profile.thermal.conductivity = 99;
  const snapshot = runtime.createSnapshot();
  assert.equal(snapshot.config.advancedPhysics.thermal.conductivity, 0.2);
  const restored = createParticleExecutionAdapter({ initialState: initial(), config });
  restored.restoreSnapshot(snapshot);
  assert.equal(restored.getConfig().advancedPhysics.thermal.conductivity, 0.2);
  assert.throws(() => runtime.configure({ advancedPhysics: { magnetic: { enabled: true, field: [1, 2] } } }), /three-number/);
});
