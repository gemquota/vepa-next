import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { PARTICLE_SLOTS as S, PARTICLE_STRIDE } from '../../src/sim/particle-layout.js';

function makeWorld(particles, config = {}) {
  const state = new Float64Array(particles.length * PARTICLE_STRIDE);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i], b = i * PARTICLE_STRIDE;
    state[b + S.MASS] = p.mass ?? 1;
    state[b + S.RADIUS] = p.radius ?? 0.25;
    state[b + S.POS_X] = p.x ?? i * 1.25;
    state[b + S.POS_Y] = p.y ?? 10;
    state[b + S.POS_Z] = p.z ?? 10;
    state[b + S.VEL_X] = p.vx ?? 0;
    state[b + S.VEL_Y] = p.vy ?? 0;
    state[b + S.VEL_Z] = p.vz ?? 0;
    state[b + S.ENERGY] = p.energy ?? 0;
    state[b + S.STORED_ENERGY] = p.stored ?? 0;
    state[b + S.TEMPERATURE] = p.temperature ?? 0;
    state[b + S.SPECIES_ID] = p.species ?? 0;
    state[b + S.PHASE_1] = p.phase ?? 0;
    state[b + S.PHASE_2] = p.progress ?? 0;
    state[b + S.RADIATION_EXPOSURE] = p.exposure ?? 0;
    state[b + S.DEAD] = 0;
  }
  return createParticleExecutionAdapter({
    initialState: state,
    config: {
      worldSize: 100, interactionRadius: 10, dt: 1,
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0,
      activeLawIds: [], resolveContacts: false, contactIterations: 0,
      numerics: { adaptiveSubsteps: false, diagnostics: true, rollbackOnNonFinite: true },
      ...config,
    },
  });
}

test('drag emits exact kinetic loss to a configurable dissipation destination', () => {
  const runtime = makeWorld([{ vx: 3, mass: 2 }], {
    activeLawIds: ['law.drag'], dragCoefficient: 0.5, dragEnergyDestination: 'thermal',
  });
  const result = runtime.step();
  const [event] = runtime.readEnergyEvents();
  const expected = 0.5 * 2 * 3 ** 2 * (1 - Math.exp(-1));
  assert.equal(event.cause, 'drag-dissipation');
  assert.equal(event.destination, 'thermal:particle:0');
  assert.ok(Math.abs(event.amount - expected) < 1e-12);
  assert.equal(result.energyTransferCount, 1);
  assert.equal(event.tick, 0);
  assert.equal(runtime.getEnergySummary().tick, 1);
});

test('thermal conduction emits deterministic pairwise transfer in the physical direction', () => {
  const runtime = makeWorld([
    { x: 10, energy: 0, temperature: 0 },
    { x: 11, energy: 10, temperature: 10 },
  ], { advancedPhysics: { thermal: { enabled: true, conductivity: 1, smoothingLength: 3, heatCapacity: 1 } } });
  runtime.step();
  const event = runtime.readEnergyEvents().find(e => e.cause === 'thermal-conduction');
  assert.equal(event.source, 'thermal:particle:1');
  assert.equal(event.destination, 'thermal:particle:0');
  assert.ok(event.amount > 0);
});

test('inelastic contact books measured kinetic-energy loss as heat', () => {
  const runtime = makeWorld([
    { x: 10, vx: 1, radius: 1 },
    { x: 11, vx: -1, radius: 1 },
  ], { advancedPhysics: { collisions: { enabled: true, restitution: 0, friction: 0 } } });
  runtime.step();
  const event = runtime.readEnergyEvents().find(e => e.cause === 'inelastic-contact-dissipation');
  assert.ok(event);
  assert.ok(event.amount > 0);
});

test('phase changes and reversals emit latent-heat transfers', () => {
  const runtime = makeWorld([{ species: 7, temperature: 20, energy: 8 }], {
    advancedPhysics: { phase: { enabled: true, materials: [{ speciesId: 7, meltPoint: 5, boilPoint: 10, latentFusion: 2, latentVaporization: 3 }] } },
  });
  runtime.step();
  const event = runtime.readEnergyEvents().find(e => e.cause === 'vaporization-latent-heat');
  assert.equal(event.amount, 5);
  assert.equal(event.source, 'thermal:particle:0');
  assert.equal(event.destination, 'phase:particle:0');
});

test('chemical enthalpy and radioactive mass defect emit typed energy flows', () => {
  const chemical = makeWorld([
    { x: 10, species: 1, stored: 2, progress: 0 },
    { x: 11, species: 2 },
  ], { advancedPhysics: { chemistry: { enabled: true, reactions: [{ speciesA: 1, speciesB: 2, productA: 3, productB: 4, rate: 1, energy: 2 }] } } });
  chemical.step();
  assert.ok(chemical.readEnergyEvents().some(e => e.cause === 'chemical-reaction-enthalpy' && e.source.startsWith('chemical:')));

  const nuclear = makeWorld([{ species: 9, mass: 1, exposure: 0 }], {
    advancedPhysics: { nuclear: { enabled: true, decays: [{ speciesId: 9, productSpeciesId: 10, rate: 1, massDefectFraction: 0.1, speedOfLightSquared: 10 }] } },
  });
  nuclear.step();
  const event = nuclear.readEnergyEvents().find(e => e.cause === 'radioactive-mass-defect');
  assert.equal(event.amount, 1);
  assert.equal(event.source, 'rest-mass:particle:0');
  assert.equal(event.destination, 'radiation:particle:0');
});

test('energy journal commit is rolled back with a failed simulation tick', () => {
  const runtime = makeWorld([{ vx: 3, mass: 2 }], { activeLawIds: ['law.drag'], dragCoefficient: 0.5 });
  const before = runtime.readState();
  const original = runtime.transactEnergy;
  assert.equal(typeof original, 'function');
  // Fill the bounded journal to force the next solver-produced batch to reject.
  for (let i = 0; i < 10000; i++) runtime.transferEnergy({ source: 'external', destination: 'thermal', amount: 0.001, cause: 'capacity-fill' });
  const atCapacity = runtime.readState();
  assert.throws(() => runtime.step(), /capacity/i);
  assert.deepEqual(runtime.readState(), atCapacity);
  assert.equal(runtime.tick, 0);
  assert.equal(runtime.getEnergySummary().eventCount, 10000);
  assert.notDeepEqual(before, atCapacity);
});
