import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

describe('Batch 17 — DNA.SIGNAL_STRENGTH / DNA.SIGNAL_DECAY / DNA.PROPAGATION_SPEED / DNA.TUNING_CH1', () => {
  it('SIGNAL_STRENGTH: stronger emitters deliver more signal (COMMS)', () => {
    const run = (strength) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 950;
          v[b + S.DNA_CACHE_START + 13] = 0.8;   // SIGNAL_RESP
          v[b + S.DNA_CACHE_START + 21] = 1;     // PROPAGATION_SPEED
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.SIGNAL] = 1;
          v[b + S.DNA_CACHE_START + 18] = 200;   // NEIGHBORHOOD_RADIUS
          v[b + S.DNA_CACHE_START + 19] = strength; // SIGNAL_STRENGTH
        }
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run(1)).toBeGreaterThan(run(0.2));
  });

  it('SIGNAL_DECAY: higher persistence keeps the signal alive longer (COMMS)', () => {
    const run = (decay) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.SIGNAL] = 1;
        v[b + S.DNA_CACHE_START + 14] = 0;    // PULSE_RATE → no re-emission
        v[b + S.DNA_CACHE_START + 20] = decay; // SIGNAL_DECAY
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 30; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run(0.99)).toBeGreaterThan(run(0.1));
    expect(run(0.99)).toBeGreaterThan(0.5);
  });

  it('PROPAGATION_SPEED: faster receiver propagation amplifies delivered signal (COMMS)', () => {
    const run = (prop) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 950;
          v[b + S.DNA_CACHE_START + 13] = 0.8;   // SIGNAL_RESP
          v[b + S.DNA_CACHE_START + 21] = prop;  // PROPAGATION_SPEED
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.SIGNAL] = 1;
          v[b + S.DNA_CACHE_START + 18] = 200;   // NEIGHBORHOOD_RADIUS
          v[b + S.DNA_CACHE_START + 19] = 1;     // SIGNAL_STRENGTH
        }
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run(1)).toBeGreaterThan(run(0.1));
  });

  it('TUNING_CH1: matched channel passes signal; mismatched tuning blocks it (COMMS)', () => {
    const run = (emitterTuning) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 950;
          v[b + S.DNA_CACHE_START + 13] = 0.8;   // SIGNAL_RESP
          v[b + S.DNA_CACHE_START + 21] = 1;     // PROPAGATION_SPEED
          v[b + S.DNA_CACHE_START + 22] = 1;     // TUNING_CH1 (receiver)
          v[b + S.DNA_CACHE_START + 23] = 0;
          v[b + S.DNA_CACHE_START + 24] = 0;
          v[b + S.DNA_CACHE_START + 25] = 0;
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.SIGNAL] = 1;
          v[b + S.DNA_CACHE_START + 18] = 200;   // NEIGHBORHOOD_RADIUS
          v[b + S.DNA_CACHE_START + 19] = 1;     // SIGNAL_STRENGTH
          v[b + S.DNA_CACHE_START + 22] = emitterTuning[0];
          v[b + S.DNA_CACHE_START + 23] = emitterTuning[1];
          v[b + S.DNA_CACHE_START + 24] = emitterTuning[2];
          v[b + S.DNA_CACHE_START + 25] = emitterTuning[3];
        }
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run([1, 0, 0, 0])).toBeGreaterThan(0.01); // aligned on channel 1
    expect(run([0, 0, 0, 1])).toBeCloseTo(0, 3);      // orthogonal tuning → blocked
  });
});
