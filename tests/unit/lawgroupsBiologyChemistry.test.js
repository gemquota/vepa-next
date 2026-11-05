import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../src/constants.js';
import {
  applySymbiosis,
  applyParasite,
  applyHibernation,
  applyImmunity,
} from '../../src/physics/lawgroups/biologyLaws.js';
import {
  applyElectrolysis,
  applyPhotolysis,
  applyPrecipitation,
  applyNeutralization,
  applyStoichiometry,
  applyAutocatalysis,
} from '../../src/physics/lawgroups/chemistryLaws.js';

const view = (n) => new Float32Array(n * PARTICLE_STRIDE);

function seed(buf, n) {
  for (let i = 0; i < n; i++) {
    const b = i * PARTICLE_STRIDE;
    buf[b + S.POS_X] = 100;
    buf[b + S.POS_Y] = 100;
    buf[b + S.POS_Z] = 100;
    buf[b + S.VEL_X] = 0;
    buf[b + S.VEL_Y] = 0;
    buf[b + S.VEL_Z] = 0;
    buf[b + S.MASS] = 1.5;
    buf[b + S.RADIUS] = 0.6;
    buf[b + S.ENERGY] = 100;
    buf[b + S.TEMPERATURE] = 0;
    buf[b + S.CHARGE] = 0;
    buf[b + S.SIGNAL] = 0;
    buf[b + S.DEAD] = 0;
  }
}

describe('biology lawgroups', () => {
  it('applySymbiosis transfers energy from the richer to the poorer partner', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.SPECIES_ID] = 0;
    buf[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    buf[S.ENERGY] = 100;
    buf[PARTICLE_STRIDE + S.ENERGY] = 40;
    expect(applySymbiosis(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
    expect(buf[S.ENERGY]).toBeLessThan(100);
    expect(buf[PARTICLE_STRIDE + S.ENERGY]).toBeGreaterThan(40);
  });

  it('applyParasite drains energy from the larger host into the smaller parasite', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.MASS] = 1;
    buf[PARTICLE_STRIDE + S.MASS] = 5;
    buf[PARTICLE_STRIDE + S.ENERGY] = 100;
    applyParasite(buf, 0, PARTICLE_STRIDE, 1);
    expect(buf[S.ENERGY]).toBeGreaterThan(100);
    expect(buf[PARTICLE_STRIDE + S.ENERGY]).toBeLessThan(100);
  });

  it('applyHibernation damps velocity and regenerates energy when starving', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.ENERGY] = 20;
    buf[S.VEL_X] = 5;
    const result = applyHibernation(buf, 0, 1);
    expect(result).not.toBeNull();
    expect(result.ax).toBe(-1);
    expect(buf[S.ENERGY]).toBeCloseTo(20.05, 5);
  });

  it('applyHibernation is a no-op at or above the energy threshold', () => {
    const buf = view(1);
    seed(buf, 1);
    expect(applyHibernation(buf, 0, 1)).toBeNull();
    expect(buf[S.ENERGY]).toBe(100);
  });

  it('applyImmunity regenerates armor toward the cap and restores energy', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.ARMOR] = 0;
    expect(applyImmunity(buf, 0, 1)).toBeNull();
    expect(buf[S.ARMOR]).toBeCloseTo(0.02, 6);
    expect(buf[S.ENERGY]).toBeCloseTo(100.01, 5);
  });
});

describe('chemistry lawgroups', () => {
  it('applyElectrolysis converts mass into energy and signal on strong charge imbalance', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.CHARGE] = 1;
    buf[PARTICLE_STRIDE + S.CHARGE] = 0;
    // Electrolysis needs an electrolyte: CONDUCTIVITY DNA scales the reaction.
    buf[S.DNA_CACHE_START + D.CONDUCTIVITY] = 1;
    expect(applyElectrolysis(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
    expect(buf[S.MASS]).toBeLessThan(1.5);
    expect(buf[S.ENERGY]).toBeGreaterThan(100);
    expect(buf[S.SIGNAL]).toBeGreaterThan(0);
    // No electrolyte → no decomposition.
    const inert = view(2);
    seed(inert, 2);
    inert[S.CHARGE] = 1;
    inert[PARTICLE_STRIDE + S.CHARGE] = 0;
    applyElectrolysis(inert, 0, PARTICLE_STRIDE, 1);
    expect(inert[S.MASS]).toBe(1.5);
  });

  it('applyPhotolysis splits mass into energy when signal is high', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.SIGNAL] = 1;
    expect(applyPhotolysis(buf, 0, 1)).toBeNull();
    expect(buf[S.MASS]).toBeLessThan(1.5);
    expect(buf[S.ENERGY]).toBeGreaterThan(100);
    expect(buf[S.SIGNAL]).toBeCloseTo(0.9, 6);
  });

  it('applyPrecipitation condenses mass, shrinks radius, and spends energy', () => {
    const buf = view(2);
    seed(buf, 2);
    expect(applyPrecipitation(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
    expect(buf[S.MASS]).toBeGreaterThan(1.5);
    expect(buf[S.RADIUS]).toBeLessThan(0.6);
    expect(buf[S.ENERGY]).toBeLessThan(100);
  });

  it('applyNeutralization cancels opposite charges and releases heat', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.CHARGE] = 0.5;
    buf[PARTICLE_STRIDE + S.CHARGE] = -0.5;
    expect(applyNeutralization(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
    expect(Math.abs(buf[S.CHARGE])).toBeLessThan(0.5);
    expect(Math.abs(buf[PARTICLE_STRIDE + S.CHARGE])).toBeLessThan(0.5);
    expect(buf[S.TEMPERATURE]).toBeGreaterThan(0);
    expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeGreaterThan(0);
  });

  it('applyStoichiometry redistributes mass while conserving the total', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.MASS] = 1;
    buf[PARTICLE_STRIDE + S.MASS] = 2;
    expect(applyStoichiometry(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
    expect(buf[S.MASS]).toBeGreaterThan(1);
    expect(buf[PARTICLE_STRIDE + S.MASS]).toBeLessThan(2);
    expect(buf[S.MASS] + buf[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(3, 6);
  });

  it('applyAutocatalysis boosts energy for same-species pairs scaled by CATALYSIS DNA', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.SPECIES_ID] = 7;
    buf[PARTICLE_STRIDE + S.SPECIES_ID] = 7;
    buf[S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
    buf[PARTICLE_STRIDE + S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
    expect(applyAutocatalysis(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
    expect(buf[S.ENERGY]).toBeCloseTo(100.15, 5);
    expect(buf[PARTICLE_STRIDE + S.ENERGY]).toBeCloseTo(100.15, 5);
  });
});
