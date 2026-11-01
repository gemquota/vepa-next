import { describe, it, expect } from 'vitest';
import { makeWorld, withWorldParam, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve, drainOffspring, resetOffspringRing } from '../../src/physics/solver.js';
import { setDNAFloat } from '../../src/dna/dnaBuffer.js';

describe('Batch 15 — DNA.MUTATION / DNA.ENERGY_EFFICIENCY / DNA.SEX_CHANCE / DNA.PREDATION_BIAS', () => {
  it('MUTATION: offspring DNA deviates more with a high mutation rate (REPRO)', () => {
    const run = (mutation) => {
      resetOffspringRing();
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 10] = 1.0;      // BIRTH_RATE
        v[b + S.DNA_CACHE_START + 12] = mutation; // MUTATION
        v[b + S.REPRO_DRIVE] = 60; // drive gate satisfied (REPRO)
        v[b + S.AGE] = 200;
        v[b + S.ENERGY] = 100;
      });
      const laws = lawsWith(LAW_INDEXES.REPRO, LAW_INDEXES.WRAP);
      solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.001);
      const off = drainOffspring();
      if (!off.length) return 0;
      let dev = 0;
      for (let d = 0; d < 42; d++) dev += Math.abs(off[0].dna[d] - view[S.DNA_CACHE_START + d]);
      return dev;
    };
    expect(run(0.9)).toBeGreaterThan(run(0.1));
  });

  it('ENERGY_EFFICIENCY: high efficiency slows metabolic decay (LIFE)', () => {
    const run = (eff) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 34] = eff;    // ENERGY_EFFICIENCY
        v[b + S.DNA_CACHE_START + 12] = 1e-6;   // MUTATION → no bio-pulse
      });
      const laws = lawsWith(LAW_INDEXES.LIFE, LAW_INDEXES.WRAP);
      withWorldParam('LIGHT_LEVEL', 0, () => {
        for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      });
      return view[S.ENERGY];
    };
    expect(run(10)).toBeGreaterThan(run(0));
    expect(run(0)).toBeLessThan(100);
  });

  it('SEX_CHANCE: boosts two-parent crossover probability (REPRO)', () => {
    const run = (sexChance) => {
      resetOffspringRing();
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 10] = 1.0; // BIRTH_RATE
        v[b + S.DNA_CACHE_START + 12] = 0;   // MUTATION → isolate crossover
        if (b === 0) {
          v[b + S.AGE] = 200;
          v[b + S.ENERGY] = 100;
          v[b + S.REPRO_DRIVE] = 60;          // drive gate satisfied (REPRO)
          v[b + S.BOND_PARTNER_1] = 1;        // partner present
          v[b + S.DNA_CACHE_START + 0] = 1;   // FORCE differs from partner
          v[b + S.DNA_CACHE_START + 35] = sexChance; // SEX_CHANCE
        } else {
          v[b + S.DNA_CACHE_START + 0] = 2;
        }
      });
      // Zero the genetic noise sources so the asexual control is a pure clone.
      setDNAFloat(dna, 0, 44, 0, 0, 0.1); // EPIGENETIC_DRIFT → 0
      setDNAFloat(dna, 0, 46, 0, 0, 1);   // GENE_FLOW → 0
      setDNAFloat(dna, 0, 50, 0, 0, 1);   // HGT_RATE → 0 (new genetics batch: default 0.05 would seed a 0.001 gene-flow gate that the deterministic PRNG hits)
      const laws = lawsWith(LAW_INDEXES.REPRO, LAW_INDEXES.WRAP);
      // repro gate (0.001) → crossover gate (0.6) → sexual blend (0.2, 0.2) → noiseless rest
      const seq = [0.001, 0.6, 0.2, 0.2, 0.5, 0.5, 0.5, 0.5];
      let i = 0;
      const prng = () => seq[i++ % seq.length];
      solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, prng);
      const off = drainOffspring();
      if (!off.length) return 0;
      let dev = 0;
      for (let d = 0; d < 42; d++) dev = Math.max(dev, Math.abs(off[0].dna[d] - view[S.DNA_CACHE_START + d]));
      return dev;
    };
    // sexChance 10 → crossover gate 0.6 < 0.25·(1+5) → two-parent blend (FORCE 1 vs 2 → 1.5)
    expect(run(10)).toBeGreaterThan(0.1);
    // sexChance 0 → crossover gate 0.6 < 0.25 fails → asexual clone
    expect(run(0)).toBeLessThan(0.05);
  });

  it('PREDATION_BIAS: predators pursue prey harder with higher bias (PREDATION)', () => {
    const run = (bias) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.MASS] = 5;
          v[b + S.DNA_CACHE_START + 36] = bias; // PREDATION_BIAS
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.MASS] = 1;
          v[b + S.SPECIES_ID] = 1; // prey is a different species (predation is cross-species only)
        }
      });
      const laws = lawsWith(LAW_INDEXES.PREDATION, LAW_INDEXES.WRAP);
      for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(5)).toBeGreaterThan(run(0));
    expect(run(0)).toBeCloseTo(990, 3);
  });
});
