import { describe, it, expect } from 'vitest';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import {
  PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES, LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';

const WORLD = 2000;
const DT = 0.25;
const rng = () => 0.5;

function makeWorld(count, setup) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 1000;
    view[b + S.POS_Y] = 1000;
    view[b + S.POS_Z] = 1000;
    view[b + S.VEL_X] = 0; view[b + S.VEL_Y] = 0; view[b + S.VEL_Z] = 0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = 0;
    view[b + S.DEAD] = 0;
    view[b + S.AGE] = 0;
    view[b + S.ENERGY] = 100;
    view[b + S.SIGNAL] = 0;
    view[b + S.HUNGER] = 0;
    view[b + S.ARMOR] = 0;
    view[b + S.TEMPERATURE] = 0;
    view[b + S.RADIUS] = 0.6;
    view[b + S.MITOSIS_TIMER] = 0;
    view[b + S.PARTNER_ID] = -1;
    view[b + S.BOND_PARTNER_1] = -1;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = r.default ?? 0;
    }
    if (setup) setup(view, dna, b, i);
  }
  return { view, dna };
}

describe('Batch 02 — COLL / ACCR / PLANETARY / LIFE (indices 4-7)', () => {
  it('COLL: approaching particles bounce — momentum exchange along the normal', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; v[b + S.VEL_X] = 1; }
      else { v[b + S.POS_X] = 1002; v[b + S.VEL_X] = -1; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.COLL);
    expect(isSet(laws, LAW_INDEXES.COLL)).toBe(true);
    for (let t = 0; t < 16; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    // Closing speed (v_i − v_j = 2.0) must be reduced by the bounce impulse.
    const closing = view[S.VEL_X] - view[PARTICLE_STRIDE + S.VEL_X];
    expect(closing).toBeLessThan(2.0);
    // Pair must not have crossed: i stays left of j, near contact.
    const sep = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    expect(sep).toBeGreaterThan(0);
    expect(sep).toBeLessThan(2.0);
  });

  it('COLL gate: without COLL, overlapping particles pass through each other', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; v[b + S.VEL_X] = 1; }
      else { v[b + S.POS_X] = 1002; v[b + S.VEL_X] = -1; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeLessThan(0); // crossed
  });

  it('ACCR (v8.0.0): fusing pair merges into ONE body — combined mass, weighted-average colour, momentum conserved', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; v[b + S.MASS] = 10; v[b + S.COLOR_R] = 255; }
      else { v[b + S.POS_X] = 1000.5; v[b + S.MASS] = 1.5; v[b + S.COLOR_B] = 255; v[b + S.VEL_X] = -4; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.COLL);
    set(laws, LAW_INDEXES.ACCR);
    // FUSION_TIME DNA (17): 0 → sub-threshold pairs fuse on first contact
    // (proximity dwell is instantaneous).
    view[S.DNA_CACHE_START + 17] = 0;
    expect(isSet(laws, LAW_INDEXES.ACCR)).toBe(true);
    const mBig0 = view[S.MASS];
    const mSmall0 = view[PARTICLE_STRIDE + S.MASS];
    const total = mBig0 + mSmall0;
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    // True merger: one survivor of combined mass, neighbour absorbed.
    expect(view[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(view[S.MASS]).toBeCloseTo(total, 5); // default FUSION (0.5) → efficiency 1.0
    // Mass-weighted colour: R = 255·mBig/total, B = 255·mSmall/total.
    expect(view[S.COLOR_R]).toBeCloseTo(255 * (mBig0 / total), 3);
    expect(view[S.COLOR_B]).toBeCloseTo(255 * (mSmall0 / total), 3);
    // Momentum conserved: (m1·v1 + m2·v2) / (m1 + m2).
    expect(view[S.VEL_X]).toBeCloseTo((mSmall0 * -4) / total, 5);
    // Centre of mass (subject at 1000, neighbour at 1000.5 → ~1000.065)
    // then the writeback integrates the merged body for one step: +vx·DT.
    const comX = 1000 + 0.5 * (mSmall0 / total);
    const mergedVelX = (mSmall0 * -4) / total;
    expect(view[S.POS_X]).toBeCloseTo(comX + mergedVelX * DT, 3);
  });

  it('ACCR gate: without ACCR, overlapping particles do not exchange mass', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; v[b + S.MASS] = 10; }
      else { v[b + S.POS_X] = 1000.5; v[b + S.MASS] = 1.5; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.COLL);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBe(10);
    expect(view[PARTICLE_STRIDE + S.MASS]).toBe(1.5);
    expect(view[PARTICLE_STRIDE + S.DEAD]).toBe(0);
  });

  it('ACCR (v8.0.0): molecular bonds hold — a bonded pair does not accrete into one body', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) v[b + S.POS_X] = 1000;
      else v[b + S.POS_X] = 1000.5;
    });
    // Register a bilateral bond exactly as applyBond / applyPolymer do.
    view[S.BOND_PARTNER_1] = 1;
    view[PARTICLE_STRIDE + S.BOND_PARTNER_1] = 0;
    view[S.BOND_COUNT] = 1;
    view[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
    const laws = createLawState();
    set(laws, LAW_INDEXES.ACCR);
    set(laws, LAW_INDEXES.BOND);
    view[S.DNA_CACHE_START + 17] = 0; // instant fuse — the bond must block it
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    // Both survive as separate attached orbs — no accretion.
    expect(view[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    expect(view[S.MASS]).toBeCloseTo(1.5, 5);
    expect(view[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(1.5, 5);
    // The bond itself survives the contact.
    expect(view[S.BOND_PARTNER_1]).toBe(1);
    expect(view[PARTICLE_STRIDE + S.BOND_PARTNER_1]).toBe(0);
  });

  it('ACCR: FUSION_MOMENTUM is the MINIMUM momentum to fuse — fast pairs merge, slow pairs do not', () => {
    const run = (fusionMom) => {
      const { view, dna } = makeWorld(2, (v, dna, b, i) => {
        v[b + S.MASS] = i === 0 ? 10 : 1;
        v[b + S.DNA_CACHE_START + 16] = fusionMom; // FUSION_MOMENTUM on both (each gates its own fusion)
        v[b + S.DNA_CACHE_START + 17] = 1000; // FUSION_TIME: dwell path never triggers
        if (i === 0) {
          v[b + S.POS_X] = 999;
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.VEL_X] = -2; // 2.0 relative approach speed → 2.0 relative momentum
        }
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.ACCR);
      set(laws, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      return { mass: view[S.MASS], deadNeighbor: view[PARTICLE_STRIDE + S.DEAD] };
    };
    const fused = run(0.5);   // above min momentum → full merger
    expect(fused.mass).toBeGreaterThan(10);
    expect(fused.deadNeighbor).toBe(1);
    const bounced = run(50);  // below min momentum → bounces, no fusion
    expect(bounced.mass).toBe(10);
    expect(bounced.deadNeighbor).toBe(0);
  });

  it('ACCR: FUSION_TIME — sub-threshold pairs fuse after dwelling in close proximity', () => {
    const run = (ticks) => {
      const { view, dna } = makeWorld(2, (v, dna, b, i) => {
        v[b + S.MASS] = i === 0 ? 10 : 1;
        v[b + S.DNA_CACHE_START + 16] = 100; // FUSION_MOMENTUM: momentum path never triggers
        v[b + S.DNA_CACHE_START + 17] = 3;   // FUSION_TIME: 3 seconds of proximity
        if (i === 0) v[b + S.POS_X] = 999;
        else v[b + S.POS_X] = 1000;
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.ACCR);
      set(laws, LAW_INDEXES.WRAP);
      for (let t = 0; t < ticks; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      return { mass: view[S.MASS], deadNeighbor: view[PARTICLE_STRIDE + S.DEAD] };
    };
    const early = run(11);    // 11 × 0.25 = 2.75 s < 3 s → not yet fused
    expect(early.mass).toBe(10);
    expect(early.deadNeighbor).toBe(0);
    const fused = run(13);    // 13 × 0.25 = 3.25 s ≥ 3 s → full merger
    expect(fused.mass).toBeGreaterThan(10);
    expect(fused.deadNeighbor).toBe(1);
  });

  it('ACCR: sub-threshold ACCR-only contacts bounce instead of passing through', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.MASS] = i === 0 ? 10 : 1;
      v[b + S.DNA_CACHE_START + 16] = 100; // below min momentum
      v[b + S.DNA_CACHE_START + 17] = 1000; // dwell never completes
      if (i === 0) v[b + S.POS_X] = 1000;
      else { v[b + S.POS_X] = 1001; v[b + S.VEL_X] = -2; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ACCR); // COLL off — bounce must come from ACCR itself
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBe(10);                      // no fusion
    expect(view[PARTICLE_STRIDE + S.MASS]).toBe(1);     // no fusion
    // Closing speed reduced by the sub-threshold elastic bounce.
    const closing = view[S.VEL_X] - view[PARTICLE_STRIDE + S.VEL_X];
    expect(closing).toBeLessThan(2.0);
  });

  it('PLANETARY: constant downward gravity pulls particles toward the ground (z → 0)', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 100; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.PLANETARY);
    expect(isSet(laws, LAW_INDEXES.PLANETARY)).toBe(true);
    for (let t = 0; t < 200; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.POS_Z]).toBeLessThan(100);  // falling toward the ground
    expect(view[S.VEL_Z]).toBeLessThan(0);    // downward drift
    expect(view[S.POS_X]).toBe(100);          // no lateral drift
    expect(view[S.POS_Y]).toBe(100);
  });

  it('PLANETARY: gravity acceleration is mass-independent — heavy and light fall alike', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = 1000; v[b + S.POS_Y] = 1000; v[b + S.POS_Z] = 1000;
      v[b + S.MASS] = i === 0 ? 1 : 10;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.PLANETARY);
    for (let t = 0; t < 50; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Z]).toBeCloseTo(view[PARTICLE_STRIDE + S.VEL_Z], 6);
  });

  it('PLANETARY gate: without PLANETARY, no downward pull', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 100; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 200; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Z]).toBe(0);
    expect(view[S.POS_Z]).toBe(100);
  });

  it('LIFE: metabolic energy decay (ENERGY_EFFICIENCY=0 ⇒ −0.01/tick)', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 34] = 0; // ENERGY_EFFICIENCY
      v[b + S.DNA_CACHE_START + 12] = 1e-6; // MUTATION → negligible bio-pulse noise
      v[b + S.ENERGY] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);
    expect(isSet(laws, LAW_INDEXES.LIFE)).toBe(true);
    runtimeConfig.worldParams.LIGHT_LEVEL = 0; // isolate metabolic decay from photosynthesis
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.ENERGY]).toBeLessThan(100);
    expect(view[S.ENERGY]).toBeCloseTo(99.0, 3);
    runtimeConfig.worldParams.LIGHT_LEVEL = 0.5; // restore default
  });

  it('LIFE: metabolic energy hitting 0 kills (energy-depletion death)', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 34] = 0; // ENERGY_EFFICIENCY → full decay
      v[b + S.DNA_CACHE_START + 12] = 1e-6; // negligible bio-pulse noise
      v[b + S.ENERGY] = 0.05; // barely above the metabolic floor
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);
    runtimeConfig.worldParams.LIGHT_LEVEL = 0; // no photosynthesis subsidy
    for (let t = 0; t < 20; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.DEAD]).toBe(1);
    runtimeConfig.worldParams.LIGHT_LEVEL = 0.5; // restore default
  });

  it('LIFE: starvation kills when HUNGER exceeds the cap', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.HUNGER] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.DEAD]).toBe(1);
  });

  it('LIFE gate: without LIFE, energy is untouched', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 20; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.ENERGY]).toBe(100);
  });
});
