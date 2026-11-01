import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../src/constants.js';
import { applyAntenna, applyShielding, applyPolarization } from '../../src/physics/lawgroups/emLaws.js';
import { applyNavigation, applyEncryption } from '../../src/physics/lawgroups/infoLaws.js';
import { applyConsciousness, applyPerception, applySynchronicity } from '../../src/physics/lawgroups/metaLaws.js';

const view = (n) => new Float32Array(n * PARTICLE_STRIDE);

function seed(buf) {
  const count = buf.length / PARTICLE_STRIDE;
  for (let i = 0; i < count; i++) {
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
    buf[b + S.SIGNAL] = 0;
    buf[b + S.MEMORY] = 0;
    buf[b + S.CHARGE] = 0;
    buf[b + S.PHASE_1] = 0;
    buf[b + S.DEAD] = 0;
  }
}

function setDNA(buf, index, dnaIndex, value) {
  buf[index * PARTICLE_STRIDE + S.DNA_CACHE_START + dnaIndex] = value;
}

describe('EM law group', () => {
  it('applyAntenna boosts SIGNAL for a moving emitter with active signal', () => {
    const buf = view(1);
    seed(buf);
    buf[S.SIGNAL] = 1;
    buf[S.VEL_X] = 100; // speed >= 5, so boost uses the min(|v|, 5) cap
    const before = buf[S.SIGNAL];
    const result = applyAntenna(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.SIGNAL]).toBeGreaterThan(before);
    expect(buf[S.SIGNAL]).toBeLessThanOrEqual(10);
  });

  it('applyShielding drains CHARGE at an ENERGY cost', () => {
    const buf = view(1);
    seed(buf);
    buf[S.CHARGE] = 2;
    const chargeBefore = buf[S.CHARGE];
    const energyBefore = buf[S.ENERGY];
    const result = applyShielding(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.CHARGE]).toBeLessThan(chargeBefore);
    expect(buf[S.ENERGY]).toBeLessThan(energyBefore);
  });

  it('applyPolarization exchanges equal-channel SIGNAL and damps mismatch', () => {
    const buf = view(2);
    seed(buf);
    setDNA(buf, 0, D.TUNING_CH1, 0.5);
    setDNA(buf, 1, D.TUNING_CH1, 0.5);
    buf[S.SIGNAL] = 0;
    buf[PARTICLE_STRIDE + S.SIGNAL] = 2;
    const totalBefore = buf[S.SIGNAL] + buf[PARTICLE_STRIDE + S.SIGNAL];
    applyPolarization(buf, 0, PARTICLE_STRIDE, 0.5);
    const s0 = buf[S.SIGNAL];
    const s1 = buf[PARTICLE_STRIDE + S.SIGNAL];
    expect(s0).toBeGreaterThan(0);            // weaker partner gains
    expect(s1).toBeLessThan(2);               // stronger partner gives
    expect(s0 + s1).toBeCloseTo(totalBefore); // exchange conserves total

    // Mismatched channels damp both signals instead.
    const buf2 = view(2);
    seed(buf2);
    setDNA(buf2, 0, D.TUNING_CH1, 0.5);
    setDNA(buf2, 1, D.TUNING_CH1, 0.8);
    buf2[S.SIGNAL] = 1;
    buf2[PARTICLE_STRIDE + S.SIGNAL] = 1;
    applyPolarization(buf2, 0, PARTICLE_STRIDE, 1);
    expect(buf2[S.SIGNAL]).toBeLessThan(1);
    expect(buf2[PARTICLE_STRIDE + S.SIGNAL]).toBeLessThan(1);
  });
});

describe('INFO law group', () => {
  it('applyNavigation produces a force toward a higher-MEMORY neighbor', () => {
    const buf = view(2);
    seed(buf);
    buf[S.MEMORY] = 0.2;
    buf[PARTICLE_STRIDE + S.MEMORY] = 0.8;
    const result = applyNavigation(buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.5);
    expect(result).not.toBeNull();
    expect(result.ax).toBeCloseTo(0.18); // dx/dist * (memJ - memI) * k
    expect(result.ay).toBeCloseTo(0.24);
    expect(result.az).toBe(0);

    // No memory gradient -> no force.
    buf[S.MEMORY] = 0.9;
    expect(applyNavigation(buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.5)).toBeNull();
  });

  it('applyEncryption decays active SIGNAL slowly and never below the floor', () => {
    const buf = view(1);
    seed(buf);
    buf[S.SIGNAL] = 2;
    const before = buf[S.SIGNAL];
    const result = applyEncryption(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.SIGNAL]).toBeLessThan(before);
    expect(buf[S.SIGNAL]).toBeGreaterThanOrEqual(0.05);

    // Silent particles stay silent.
    buf[S.SIGNAL] = 0;
    expect(applyEncryption(buf, 0, 1)).toBeNull();
    expect(buf[S.SIGNAL]).toBe(0);
  });
});

describe('META law group', () => {
  it('applyConsciousness regenerates ENERGY and MEMORY up to their caps', () => {
    const buf = view(1);
    seed(buf);
    const energyBefore = buf[S.ENERGY];
    const memoryBefore = buf[S.MEMORY];
    const result = applyConsciousness(buf, 0, 1);
    expect(result).toBeNull();
    // Low prediction error (stationary, model matches) → self-maintenance:
    // ENERGY regens, MEMORY is untouched.
    expect(buf[S.ENERGY]).toBeGreaterThan(energyBefore);
    expect(buf[S.MEMORY]).toBe(memoryBefore);
    expect(buf[S.ENERGY]).toBeLessThanOrEqual(200);
    expect(buf[S.MEMORY]).toBeLessThanOrEqual(1);
  });

  it('applyConsciousness attends when prediction error is high (MEMORY/SIGNAL up, ENERGY down)', () => {
    const buf = view(1);
    seed(buf);
    buf[S.VEL_X] = 10; // speed 10 vs self-model 0 → error ≈ 9.5
    applyConsciousness(buf, 0, 1);
    expect(buf[S.MEMORY]).toBeCloseTo(0.19, 5); // 9.5 · 0.02
    expect(buf[S.SIGNAL]).toBeCloseTo(0.095, 5); // 9.5 · 0.01
    expect(buf[S.ENERGY]).toBeCloseTo(99.525, 5); // 100 − 9.5 · 0.05
  });

  it('applyPerception aligns velocity toward a neighbor within extended range', () => {
    const buf = view(2);
    seed(buf);
    setDNA(buf, 0, D.NEIGHBORHOOD_RADIUS, 60);
    buf[S.VEL_X] = 1;
    buf[PARTICLE_STRIDE + S.VEL_X] = 2;
    const result = applyPerception(buf, 0, PARTICLE_STRIDE, 50, 1);
    expect(result).not.toBeNull();
    expect(result.ax).toBeGreaterThan(0); // (vJ - vI) * 0.01 * k

    // Beyond extended range -> no force.
    expect(applyPerception(buf, 0, PARTICLE_STRIDE, 200, 1)).toBeNull();
  });

  it('applySynchronicity aligns similar-phase particles and merges their phases', () => {
    const buf = view(2);
    seed(buf);
    buf[S.PHASE_1] = 0.1;
    buf[PARTICLE_STRIDE + S.PHASE_1] = 0.2;
    buf[PARTICLE_STRIDE + S.VEL_X] = 1;
    const result = applySynchronicity(buf, 0, PARTICLE_STRIDE, 1);
    expect(result).not.toBeNull();
    expect(result.ax).toBeCloseTo(0.02); // (vJ - vI) * 0.02 * k
    expect(buf[S.PHASE_1]).toBeCloseTo(0.15);
    expect(buf[PARTICLE_STRIDE + S.PHASE_1]).toBeCloseTo(0.15);

    // Phases too far apart -> no interaction.
    buf[S.PHASE_1] = 0;
    buf[PARTICLE_STRIDE + S.PHASE_1] = 0.5;
    expect(applySynchronicity(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
  });
});
