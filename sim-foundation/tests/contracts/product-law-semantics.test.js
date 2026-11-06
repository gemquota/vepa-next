import test from 'node:test';
import assert from 'node:assert/strict';
import { LAW_INDEXES, DNA_INDEXES, PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../../src/constants.js';
import { createLawState, set } from '../../../src/state/lawState.js';
import { applyBuoyancy, applyLifeCycle, applySenescence } from '../../../src/physics/laws.js';
import { LAW_HELP_PATCHES } from '../../../src/state/lawHelpPatches.js';
import {
  LAW_RELATIONSHIPS, LAW_RELATIONSHIP_EVIDENCE, validateLawOntology,
  getLawExecutionStatus, isLawExecutable,
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

test('priority ontology edges have direction, rationale and a concrete runtime consumer', () => {
  assert.deepEqual(validateLawOntology(), []);
  assert.ok(LAW_RELATIONSHIP_EVIDENCE.length >= 16);
  for (const edge of LAW_RELATIONSHIP_EVIDENCE) {
    assert.ok(LAW_RELATIONSHIPS[edge.source][edge.type].includes(edge.target));
    assert.ok(edge.rationale.length >= 12);
    assert.ok(edge.runtimeConsumer.length > 0);
  }
});
