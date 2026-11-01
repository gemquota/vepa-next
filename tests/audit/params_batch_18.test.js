import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

describe('Batch 18 — DNA.TUNING_CH2 / DNA.TUNING_CH3 / DNA.TUNING_CH4 / DNA.MEMORY_DECAY', () => {
  // Emitter/receiver pair: receiver tuned to `receiverCh`, emitter tuned via `emitterTuning`.
  const transferSignal = (receiverCh, emitterTuning) => {
    const { view, dna } = makeWorld(2, (v, d, b) => {
      if (b === 0) {
        v[b + S.POS_X] = 950;
        v[b + S.DNA_CACHE_START + 13] = 0.8;   // SIGNAL_RESP
        v[b + S.DNA_CACHE_START + 21] = 1;     // PROPAGATION_SPEED
        v[b + S.DNA_CACHE_START + 22] = receiverCh === 1 ? 1 : 0;
        v[b + S.DNA_CACHE_START + 23] = receiverCh === 2 ? 1 : 0;
        v[b + S.DNA_CACHE_START + 24] = receiverCh === 3 ? 1 : 0;
        v[b + S.DNA_CACHE_START + 25] = receiverCh === 4 ? 1 : 0;
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

  it('TUNING_CH2: channel-2 tuned pairs pass signal; mismatched channels block it', () => {
    expect(transferSignal(2, [0, 1, 0, 0])).toBeGreaterThan(0.01);
    expect(transferSignal(2, [1, 0, 0, 0])).toBeCloseTo(0, 3);
  });

  it('TUNING_CH3: channel-3 tuned pairs pass signal; mismatched channels block it', () => {
    expect(transferSignal(3, [0, 0, 1, 0])).toBeGreaterThan(0.01);
    expect(transferSignal(3, [0, 1, 0, 0])).toBeCloseTo(0, 3);
  });

  it('TUNING_CH4: channel-4 tuned pairs pass signal; mismatched channels block it', () => {
    expect(transferSignal(4, [0, 0, 0, 1])).toBeGreaterThan(0.01);
    expect(transferSignal(4, [0, 0, 1, 0])).toBeCloseTo(0, 3);
  });

  it('MEMORY_DECAY: low persistence erases memory traces faster (COMMS)', () => {
    const run = (memDecay) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.MEMORY] = 1;
        v[b + S.DNA_CACHE_START + 14] = 0;     // PULSE_RATE → no new memory
        v[b + S.DNA_CACHE_START + 40] = memDecay; // MEMORY_DECAY
      });
      const laws = lawsWith(LAW_INDEXES.COMMS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 40; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.MEMORY];
    };
    expect(run(1.0)).toBeGreaterThan(run(0.9));
    expect(run(0.9)).toBeLessThan(0.5);
  });
});
