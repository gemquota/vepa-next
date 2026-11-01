import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

describe('Batch 16 — DNA.SPECIES_AFFINITY / DNA.SIGNAL_RESP / DNA.PULSE_RATE / DNA.NEIGHBORHOOD_RADIUS', () => {
  it('SPECIES_AFFINITY: same-species affinity pulls; zero affinity is inert (AFFINITY)', () => {
    const run = (affinity) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 41] = affinity; // SPECIES_AFFINITY
        }
      });
      const laws = lawsWith(LAW_INDEXES.AFFINITY, LAW_INDEXES.WRAP);
      for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(1)).toBeGreaterThan(990);
    expect(run(0)).toBeCloseTo(990, 3);
  });

  it('SIGNAL_RESP: receiver responsiveness gates signal delivery and homing force (COMMS)', () => {
    const run = (resp) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 950;
          v[b + S.DNA_CACHE_START + 13] = resp; // SIGNAL_RESP
          v[b + S.DNA_CACHE_START + 21] = 1;    // PROPAGATION_SPEED
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.SIGNAL] = 1;                   // emitter
          v[b + S.DNA_CACHE_START + 18] = 200;  // NEIGHBORHOOD_RADIUS
          v[b + S.DNA_CACHE_START + 19] = 1;    // SIGNAL_STRENGTH
        }
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run(0.8)).toBeGreaterThan(0.01);
    expect(run(0)).toBeCloseTo(0, 3);
  });

  it('PULSE_RATE: faster pulse emits more signal over time (COMMS)', () => {
    const run = (pulseRate) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 14] = pulseRate; // PULSE_RATE
        v[b + S.DNA_CACHE_START + 19] = 1;         // SIGNAL_STRENGTH
        v[b + S.DNA_CACHE_START + 20] = 0.95;      // SIGNAL_DECAY
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 120; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run(0.9)).toBeGreaterThan(run(0.1));
  });

  it('NEIGHBORHOOD_RADIUS: signals only reach neighbors inside the radius (COMMS)', () => {
    const run = (radius) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 900;                   // 100 away from emitter
          v[b + S.DNA_CACHE_START + 13] = 0.8;    // SIGNAL_RESP
          v[b + S.DNA_CACHE_START + 18] = radius; // NEIGHBORHOOD_RADIUS
          v[b + S.DNA_CACHE_START + 21] = 1;      // PROPAGATION_SPEED
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.SIGNAL] = 1;
          v[b + S.DNA_CACHE_START + 18] = radius;
          v[b + S.DNA_CACHE_START + 19] = 1;      // SIGNAL_STRENGTH
        }
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.SIGNAL];
    };
    expect(run(500)).toBeGreaterThan(0.01);
    expect(run(50)).toBeCloseTo(0, 3);
  });
});
