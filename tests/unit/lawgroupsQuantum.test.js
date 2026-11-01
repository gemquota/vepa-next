import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../src/constants.js';
import { applySuperposition } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyTunneling } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyDecoherence } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyWaveParticle } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyUncertainty } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyTeleport } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyObserver } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyPlanck } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyCoherence } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyBosonic } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyFermionic } from '../../src/physics/lawgroups/quantumLaws.js';
import { applySpin } from '../../src/physics/lawgroups/quantumLaws.js';
import { applySpectral } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyWavefunction } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyHyperplane } from '../../src/physics/lawgroups/quantumLaws.js';
import { applyAntimatter } from '../../src/physics/lawgroups/quantumLaws.js';

const view = (n) => new Float32Array(n * PARTICLE_STRIDE);
const base = (i) => i * PARTICLE_STRIDE;
const fixedPrng = (v) => () => v;

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

describe('Quantum law group', () => {
  it('applySuperposition returns interference drift, collapsing by the L2 Born rule', () => {
    // No collapse (prng 0.9 >= 0.02·k): gentle interference drift from the
    // rotating phase — amplitude state is untouched.
    const buf = view(1);
    seed(buf);
    const f = applySuperposition(buf, 0, 1, fixedPrng(0.9));
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(Math.sin(0.05) * 0.05, 6);
    expect(f.ay).toBeCloseTo(Math.cos(0.05) * 0.05, 6);
    expect(f.az).toBe(0);
    expect(buf[S.SUPER_PHASE]).toBeCloseTo(0.05, 6);
    expect(buf[S.SUPER_AMP_1]).toBeCloseTo(0.7, 6);

    // Collapse with unnormalised amplitudes (0.5, 0.5, 0, 0): the L2 Born
    // draw (p_b = |a_b|²/Σ|a|²) samples basis 0 for r = 0.25·0.5 — the old
    // L1 sum would have picked basis 1.
    const c = view(1);
    seed(c);
    c[S.SUPER_AMP_1] = 0.5;
    c[S.SUPER_AMP_2] = 0.5;
    c[S.SUPER_AMP_3] = 0;
    c[S.SUPER_AMP_4] = 0;
    let draw = 0;
    const seqPrng = () => (draw++ === 0 ? 0.01 : 0.5); // trigger, then r = 0.25
    const cf = applySuperposition(c, 0, 1, seqPrng);
    expect(cf.ax).toBe(0); // basis 0 = stay
    expect(cf.ay).toBe(0);
    expect(c[S.SUPER_AMP_1]).toBeCloseTo(0.85, 6); // 1 − 3·0.05 re-spread
    expect(c[S.SUPER_AMP_2]).toBeCloseTo(0.05, 6);
  });

  it('applyTunneling phase-shifts position when triggered', () => {
    const buf = view(1);
    seed(buf);
    const result = applyTunneling(buf, 0, 200, fixedPrng(0.9));
    expect(result).toBeNull();
    expect(buf[S.POS_X]).not.toBe(100);
    expect(buf[S.POS_X]).toBeCloseTo(103.6, 4);
    expect(buf[S.POS_Y]).toBeCloseTo(103.6, 4);
    expect(buf[S.POS_Z]).toBeCloseTo(103.6, 4);
  });

  it('applyTunneling is a no-op below the trigger threshold', () => {
    const buf = view(1);
    seed(buf);
    applyTunneling(buf, 0, 1, fixedPrng(0.9));
    expect(buf[S.POS_X]).toBe(100);
  });

  it('applyDecoherence damps velocity and radiates SIGNAL', () => {
    const buf = view(1);
    seed(buf);
    buf[S.VEL_X] = 5;
    const f = applyDecoherence(buf, 0, 1);
    expect(f.ax).toBeCloseTo(-0.05, 5);
    expect(f.ay).toBeCloseTo(0, 5);
    expect(buf[S.SIGNAL]).toBeCloseTo(0.001, 5);
    expect(buf[S.SIGNAL]).toBeLessThanOrEqual(10);
  });

  it('applyWaveParticle spreads unmeasured particles as waves and accelerates measured ones', () => {
    // Unmeasured (WAVE_MEASURED = 0): de Broglie perpendicular drift, λ ∝ 1/p.
    const wave = view(1);
    seed(wave);
    wave[S.VEL_X] = 0.2;
    wave[S.VEL_Y] = 0;
    const waveForce = applyWaveParticle(wave, 0, 1);
    expect(waveForce.ax).toBeCloseTo(0, 6); // perpendicular to (vx, vy)
    expect(waveForce.ay).toBeCloseTo(0.02, 6); // inv=2 · 0.02 · (0.5 + 0.5·sin 0)

    // Measured (WAVE_MEASURED > 0.1): localised particle accelerates along v.
    const particle = view(1);
    seed(particle);
    particle[S.VEL_X] = 5;
    particle[S.WAVE_MEASURED] = 1;
    const particleForce = applyWaveParticle(particle, 0, 1);
    expect(particleForce.ax).toBeCloseTo(0.05, 5);
    // The measurement flag decays ×0.95 per tick.
    expect(particle[S.WAVE_MEASURED]).toBeCloseTo(0.95, 6);
  });

  it('applyUncertainty trades position certainty for momentum certainty (speed-gated)', () => {
    // Fast (speed >= 0.5): position jitter only — no force, Heisenberg keeps p sharp.
    const fast = view(1);
    seed(fast);
    fast[S.VEL_X] = 5;
    expect(applyUncertainty(fast, 0, 1, fixedPrng(0.9))).toBeNull();
    expect(fast[S.POS_X]).toBeCloseTo(100.008, 5); // +0.4·0.02
    expect(fast[S.POS_Y]).toBeCloseTo(100.008, 5);

    // Slow (speed < 0.5): velocity kick only — position stays sharp.
    const slow = view(1);
    seed(slow);
    const f = applyUncertainty(slow, 0, 1, fixedPrng(0.9));
    expect(f.ax).toBeCloseTo(0.02, 5); // +0.4·0.05
    expect(f.ay).toBeCloseTo(0.02, 5);
    expect(f.az).toBeCloseTo(0.02, 5);
    expect(slow[S.POS_X]).toBe(100);
  });

  it('applyTeleport transfers state to an entangled partner when triggered', () => {
    const buf = view(2);
    seed(buf);
    buf[S.ENTANGLE_ID] = 1;
    buf[PARTICLE_STRIDE + S.ENTANGLE_ID] = 0;
    buf[S.ENTANGLE_PHASE] = 1;
    buf[PARTICLE_STRIDE + S.ENTANGLE_PHASE] = 1;
    buf[S.VEL_X] = 2;
    let draw = 0;
    const seqPrng = () => (draw++ === 0 ? 0.001 : 0.9); // trigger, then ground-state jitter
    const result = applyTeleport(buf, 0, 1, seqPrng);
    expect(result).toBeNull();
    // State moved to the partner; the sender collapsed — no clone remains.
    expect(buf[PARTICLE_STRIDE + S.VEL_X]).toBeCloseTo(2, 6);
    expect(buf[PARTICLE_STRIDE + S.ENERGY]).toBeCloseTo(130, 6); // 100 + 100·0.3
    expect(buf[S.ENERGY]).toBeCloseTo(95, 6); // 100 − 5 classical channel cost
    expect(buf[S.VEL_X]).toBeCloseTo(0.16, 6); // (0.9 − 0.5)·0.4
    // Positions never move; the link is consumed on both sides.
    expect(buf[S.POS_X]).toBe(100);
    expect(buf[S.ENTANGLE_ID]).toBe(-1);
    expect(buf[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(-1);
  });

  it('applyTeleport does nothing without a partner or with low ENERGY', () => {
    // No entangled partner.
    const lone = view(1);
    seed(lone);
    lone[S.ENTANGLE_ID] = -1;
    lone[S.ENERGY] = 100;
    expect(applyTeleport(lone, 0, 1, fixedPrng(0.001))).toBeNull();
    expect(lone[S.POS_X]).toBe(100);
    expect(lone[S.ENERGY]).toBe(100);

    // Partner exists but the sender lacks the 10 ENERGY gate.
    const buf = view(1);
    seed(buf);
    buf[S.ENTANGLE_ID] = 1;
    buf[PARTICLE_STRIDE + S.ENTANGLE_ID] = 0;
    buf[PARTICLE_STRIDE + S.ENTANGLE_PHASE] = 1;
    buf[S.ENERGY] = 5;
    applyTeleport(buf, 0, 1, fixedPrng(0.001));
    expect(buf[S.POS_X]).toBe(100);
    expect(buf[S.ENERGY]).toBe(5);
  });

  it('applyObserver collapses j velocity toward i and imprints MEMORY', () => {
    const buf = view(2);
    seed(buf);
    buf[base(0) + S.MEMORY] = 1;
    buf[base(0) + S.VEL_X] = 10;
    const result = applyObserver(buf, base(0), base(1), 1);
    expect(result).toBeNull();
    expect(buf[base(1) + S.VEL_X]).toBeCloseTo(0.1, 5);
    expect(buf[base(1) + S.MEMORY]).toBeCloseTo(0.1, 5);
  });

  it('applyObserver skips when observer MEMORY is low', () => {
    const buf = view(2);
    seed(buf);
    buf[base(0) + S.VEL_X] = 10;
    applyObserver(buf, base(0), base(1), 1);
    expect(buf[base(1) + S.VEL_X]).toBe(0);
  });

  it('applyPlanck quantizes velocity to fixed steps', () => {
    const buf = view(1);
    seed(buf);
    buf[S.VEL_X] = 0.17;
    buf[S.VEL_Y] = -0.23;
    const result = applyPlanck(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.VEL_X]).toBeCloseTo(0.2, 5);
    expect(buf[S.VEL_Y]).toBeCloseTo(-0.2, 5);
  });

  it('applyCoherence phase-locks similar velocities', () => {
    const buf = view(2);
    seed(buf);
    buf[base(1) + S.VEL_X] = 0.5;
    const f = applyCoherence(buf, base(0), base(1), 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(0.01, 5);
  });

  it('applyCoherence returns null for divergent velocities', () => {
    const buf = view(2);
    seed(buf);
    buf[base(1) + S.VEL_X] = 5;
    expect(applyCoherence(buf, base(0), base(1), 1)).toBeNull();
  });

  it('applyBosonic attracts within short range', () => {
    const buf = view(2);
    seed(buf);
    const f = applyBosonic(buf, base(0), base(1), 2, 0, 0, 2, 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(1, 5);
    expect(f.ay).toBeCloseTo(0, 5);
  });

  it('applyBosonic returns null beyond range', () => {
    const buf = view(2);
    seed(buf);
    expect(applyBosonic(buf, base(0), base(1), 4, 0, 0, 4, 1)).toBeNull();
  });

  it('applyFermionic pushes apart overlapping particles', () => {
    const buf = view(2);
    seed(buf);
    const f = applyFermionic(buf, base(0), base(1), 1, 0, 0, 1, 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeLessThan(0);
    expect(f.ax).toBeCloseTo(-(1 - 1 / 1.2) * 5, 5);
  });

  it('applyFermionic returns null when not overlapping', () => {
    const buf = view(2);
    seed(buf);
    expect(applyFermionic(buf, base(0), base(1), 2, 0, 0, 2, 1)).toBeNull();
  });

  it('applySpin applies a perpendicular wiggle with parity sign', () => {
    const buf = view(2);
    seed(buf);
    buf[base(0) + S.VEL_X] = 3;
    const fEven = applySpin(buf, base(0), 1, fixedPrng(0.9));
    expect(fEven.ay).toBeCloseTo(0.1, 5);
    expect(fEven.ax).toBeCloseTo(0, 5);

    const oddBase = PARTICLE_STRIDE + 1;
    buf[oddBase + S.VEL_X] = 3;
    buf[oddBase + S.VEL_Y] = 0;
    buf[oddBase + S.VEL_Z] = 0;
    const fOdd = applySpin(buf, oddBase, 1, fixedPrng(0.9));
    expect(fOdd.ay).toBeCloseTo(-0.1, 5);
  });

  it('applySpin uses a random axis when speed is negligible', () => {
    const buf = view(1);
    seed(buf);
    const f = applySpin(buf, 0, 1, fixedPrng(0.9));
    expect(f.ax).toBeCloseTo(0.08, 5);
  });

  it('applySpectral emits a species-tagged SIGNAL tone', () => {
    const buf = view(1);
    seed(buf);
    buf[S.SPECIES_ID] = 3;
    const result = applySpectral(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.SIGNAL]).toBeCloseTo(0.004, 5);
    expect(buf[S.SIGNAL]).toBeLessThanOrEqual(10);
  });

  it('applyWavefunction snaps position onto the wave grid', () => {
    const buf = view(1);
    seed(buf);
    buf[S.POS_X] = 100.3;
    const result = applyWavefunction(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.POS_X]).toBeCloseTo(100.5, 5);
    expect(buf[S.POS_Y]).toBe(100);
  });

  it('applyHyperplane returns a constant tiny shear force', () => {
    const buf = view(1);
    seed(buf);
    const f = applyHyperplane(buf, 0, 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(0.001, 6);
    expect(f.ay).toBeCloseTo(0.0005, 6);
    expect(f.az).toBeCloseTo(0.0002, 6);
  });

  it('applyAntimatter annihilates opposite-charge pairs', () => {
    const buf = view(2);
    seed(buf);
    buf[base(0) + S.CHARGE] = 1;
    buf[base(1) + S.CHARGE] = -1;
    const result = applyAntimatter(buf, base(0), base(1), 1);
    expect(result).toBeNull();
    expect(buf[base(0) + S.DEAD]).toBe(1);
    expect(buf[base(1) + S.DEAD]).toBe(1);
    expect(buf[base(0) + S.SIGNAL]).toBe(10);
    expect(buf[base(1) + S.SIGNAL]).toBe(10);
  });

  it('applyAntimatter ignores same-sign charges', () => {
    const buf = view(2);
    seed(buf);
    buf[base(0) + S.CHARGE] = 1;
    buf[base(1) + S.CHARGE] = 1;
    applyAntimatter(buf, base(0), base(1), 1);
    expect(buf[base(0) + S.DEAD]).toBe(0);
    expect(buf[base(1) + S.DEAD]).toBe(0);
  });
});
