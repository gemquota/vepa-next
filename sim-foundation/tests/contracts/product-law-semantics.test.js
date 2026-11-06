import test from 'node:test';
import assert from 'node:assert/strict';
import { LAW_INDEXES, DNA_INDEXES, PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../../src/constants.js';
import { createLawState, set } from '../../../src/state/lawState.js';
import { applyBuoyancy, applyLifeCycle, applySenescence, applyDrag, applyGravity, applyCurrentTransfer, applyResistance, applyMagneticForce, setBuffer } from '../../../src/physics/laws.js';
import { LAW_HELP_PATCHES } from '../../../src/state/lawHelpPatches.js';
import {
  LAW_RELATIONSHIPS, LAW_RELATIONSHIP_EVIDENCE, validateLawOntology,
  getLawExecutionStatus, isLawExecutable, validateLawParameterContracts, LAW_PARAMETER_CONTRACTS,
} from '../../../src/state/lawOntology.js';
import { readFileSync } from 'node:fs';

function particle() {
  const view = new Float32Array(PARTICLE_STRIDE);
  view[S.MASS] = 1;
  view[S.ENERGY] = 100;
  view[S.TEMPERATURE] = 1;
  view[S.AGE] = 600;
  view[S.HUNGER] = 0;
  view[S.DEAD] = 0;
  view[S.DNA_CACHE_START + DNA_INDEXES.HEAT_OUTPUT] = 0.5;
  return view;
}

test('BUOYANCY is inert when disabled and produces upward acceleration when enabled', () => {
  const view = particle();
  const off = createLawState();
  assert.equal(applyBuoyancy(off, view, 0), null);
  set(off, LAW_INDEXES.BUOYANCY);
  const force = applyBuoyancy(off, view, 0);
  assert.ok(force.az < 0);
  assert.equal(force.ax, 0);
  assert.equal(force.ay, 0);
});

test('BUOYANCY rejects non-finite temperature and sanitizes non-finite heat modifiers', () => {
  const laws = createLawState();
  set(laws, LAW_INDEXES.BUOYANCY);
  const view = particle();
  view[S.TEMPERATURE] = Infinity;
  assert.equal(applyBuoyancy(laws, view, 0), null);
  view[S.TEMPERATURE] = NaN;
  assert.equal(applyBuoyancy(laws, view, 0), null);
  view[S.TEMPERATURE] = 1;
  view[S.DNA_CACHE_START + DNA_INDEXES.HEAT_OUTPUT] = Infinity;
  const force = applyBuoyancy(laws, view, 0);
  assert.ok(force && Number.isFinite(force.az));
});

test('SENESCENCE requires both LIFE and SENESCENCE gates', () => {
  const view = particle();
  const dna = new Float64Array(42);
  dna[11] = 1000;
  const laws = createLawState();
  set(laws, LAW_INDEXES.LIFE);
  assert.equal(applySenescence(laws, view, 0, dna, 1, () => 0, null), false);
  assert.equal(view[S.DEAD], 0);
  set(laws, LAW_INDEXES.SENESCENCE);
  assert.equal(applySenescence(laws, view, 0, dna, 1, () => 0, null), true);
  assert.equal(view[S.DEAD], 1);
});

test('SENESCENCE is a separate lifecycle stage and rejects invalid rates or timesteps', () => {
  const view = particle();
  const dna = new Float64Array(42);
  dna[11] = 1000;
  const laws = createLawState();
  set(laws, LAW_INDEXES.LIFE);
  set(laws, LAW_INDEXES.SENESCENCE);
  applyLifeCycle(laws, view, 0, dna, 0.1, () => 0, 1, null);
  assert.equal(view[S.DEAD], 0, 'LIFE must not secretly apply SENESCENCE');
  assert.equal(applySenescence(laws, view, 0, dna, Infinity, () => 0, null), false);
  dna[11] = Infinity;
  assert.equal(applySenescence(laws, view, 0, dna, 1, () => 0, null), false);
  assert.equal(view[S.DEAD], 0);
});

test('ELECTRIC_FIELD is explicitly metadata-only, not an executable alias for FIELD or CHARGE_LAW', () => {
  assert.equal(getLawExecutionStatus('ELECTRIC_FIELD'), 'metadata-only');
  assert.equal(isLawExecutable('ELECTRIC_FIELD'), false);
  assert.equal(isLawExecutable('FIELD'), true);
  assert.equal(isLawExecutable('CHARGE_LAW'), true);
  assert.deepEqual(LAW_RELATIONSHIPS.ELECTRIC_FIELD.runtimeConsumers, []);
  assert.ok(!Object.values(LAW_RELATIONSHIPS).some(record =>
    ['dependsOn', 'synergizesWith', 'antagonizes'].some(type => (record[type] || []).includes('ELECTRIC_FIELD'))));
  assert.match(LAW_HELP_PATCHES.ELECTRIC_FIELD.hint, /metadata-only/i);
  assert.match(LAW_HELP_PATCHES.ELECTRIC_FIELD.explanation, /no solver dispatch/i);
  const lawPanel = readFileSync(new URL('../../../src/ui/lawPanel.js', import.meta.url), 'utf8');
  const worldPanel = readFileSync(new URL('../../../src/ui/worldPanel.js', import.meta.url), 'utf8');
  assert.match(lawPanel, /isLawExecutable/);
  assert.match(worldPanel, /metadata-only/);
  assert.match(worldPanel, /isLawExecutable/);
});

test('DRAG returns bounded damping acceleration and zero friction is inert', () => {
  assert.deepEqual(applyDrag(2, -1, 0.5, 0), { ax: 0, ay: 0, az: 0 });
  const force = applyDrag(2, -1, 0.5, 0.25);
  assert.ok(force.ax < 0 && force.ay > 0 && force.az < 0);
  assert.ok(Math.abs(force.ax + 0.5) < 1e-12);
});

test('GRAV pair force is antisymmetric under particle exchange', () => {
  const view = new Float32Array(2 * PARTICLE_STRIDE);
  view[S.MASS] = 2;
  view[PARTICLE_STRIDE + S.MASS] = 3;
  setBuffer(view);
  const forward = applyGravity(0, PARTICLE_STRIDE, 1, 0, 0, 1, 1);
  const reverse = applyGravity(PARTICLE_STRIDE, 0, -1, 0, 0, 1, 1);
  assert.ok(Math.abs(forward.ax + reverse.ax) < 1e-12);
  assert.equal(forward.ay, 0);
  assert.equal(forward.az, 0);
});

test('CURRENT conserves total charge and clamps a transfer to equalization', () => {
  const view = new Float32Array(2 * PARTICLE_STRIDE);
  view[S.CHARGE] = 0;
  view[PARTICLE_STRIDE + S.CHARGE] = 1;
  view[S.DNA_CACHE_START + DNA_INDEXES.CONDUCTIVITY] = 0.5;
  view[PARTICLE_STRIDE + S.DNA_CACHE_START + DNA_INDEXES.CONDUCTIVITY] = 0.5;
  setBuffer(view);
  applyCurrentTransfer(0, PARTICLE_STRIDE, 10, 0.5);
  assert.ok(Math.abs(view[S.CHARGE] + view[PARTICLE_STRIDE + S.CHARGE] - 1) < 1e-7);
  assert.ok(Math.abs(view[S.CHARGE] - 0.25) < 1e-7);
  applyCurrentTransfer(0, PARTICLE_STRIDE, 10, 100);
  assert.ok(Math.abs(view[S.CHARGE] - 0.5) < 1e-7);
  assert.ok(Math.abs(view[PARTICLE_STRIDE + S.CHARGE] - 0.5) < 1e-7);
  const before = [view[S.CHARGE], view[PARTICLE_STRIDE + S.CHARGE]];
  applyCurrentTransfer(0, PARTICLE_STRIDE, 10, Infinity);
  assert.deepEqual([view[S.CHARGE], view[PARTICLE_STRIDE + S.CHARGE]], before);
});

test('RESISTANCE damps velocity and converts the response into heat without non-finite writes', () => {
  const view = new Float32Array(PARTICLE_STRIDE);
  view[S.TEMPERATURE] = 0;
  view[S.DNA_CACHE_START + DNA_INDEXES.CONDUCTIVITY] = 0;
  setBuffer(view);
  const force = applyResistance(0, 2, 0, 0, 0.1);
  assert.ok(force.ax < 0);
  assert.ok(view[S.TEMPERATURE] > 0);
  const before = view[S.TEMPERATURE];
  assert.equal(applyResistance(0, Infinity, 0, 0, 0.1), null);
  assert.equal(view[S.TEMPERATURE], before);
});

test('MAGNETISM is antisymmetric for equal moments and rejects non-finite controls', () => {
  const view = new Float32Array(2 * PARTICLE_STRIDE);
  view[S.DNA_CACHE_START + DNA_INDEXES.MAGNETIC_MOMENT] = 0.5;
  view[PARTICLE_STRIDE + S.DNA_CACHE_START + DNA_INDEXES.MAGNETIC_MOMENT] = 0.5;
  setBuffer(view);
  const forward = applyMagneticForce(0, PARTICLE_STRIDE, 1, 0, 0, 1, 1);
  const reverse = applyMagneticForce(PARTICLE_STRIDE, 0, -1, 0, 0, 1, 1);
  assert.ok(Math.abs(forward.ax + reverse.ax) < 1e-12);
  assert.equal(applyMagneticForce(0, PARTICLE_STRIDE, 1, 0, 0, 1, Infinity), null);
});

test('high-risk parameter contracts match canonical DNA ranges and declare invariants', () => {
  assert.deepEqual(validateLawParameterContracts(), []);
  assert.ok(Object.keys(LAW_PARAMETER_CONTRACTS).length >= 14);
  for (const contract of Object.values(LAW_PARAMETER_CONTRACTS)) {
    assert.ok(contract.parameters.length > 0);
    assert.ok(contract.invariants.length > 0);
  }
});

test('priority ontology edges have direction, rationale and a concrete runtime consumer', () => {
  assert.deepEqual(validateLawOntology(), []);
  assert.ok(LAW_RELATIONSHIP_EVIDENCE.length >= 16);
  for (const edge of LAW_RELATIONSHIP_EVIDENCE) {
    assert.ok(LAW_RELATIONSHIPS[edge.source][edge.type].includes(edge.target));
    assert.ok(edge.rationale.length >= 12);
    assert.ok(edge.runtimeConsumer.length > 0);
  }
});
