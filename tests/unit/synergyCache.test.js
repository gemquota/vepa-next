import { describe, it, expect } from 'vitest';
import { LAW_INDEXES, LAW_COUNT } from '../../src/constants.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { computeSynergy, createSynergyCache } from '../../src/physics/synergy.js';

const allLawKeys = Object.keys(LAW_INDEXES);

function stateWith(keys) {
  const state = createLawState();
  for (const k of keys) set(state, LAW_INDEXES[k]);
  return state;
}

describe('createSynergyCache', () => {
  it('returns one entry per law, matching computeSynergy for an empty state', () => {
    const cache = createSynergyCache(createLawState());
    expect(cache).toHaveLength(LAW_COUNT);
    for (let i = 0; i < LAW_COUNT; i++) {
      expect(cache[i]).toBe(computeSynergy(createLawState(), i));
      expect(cache[i]).toBe(1.0);
    }
  });

  it('matches computeSynergy for a full state (every law on)', () => {
    const full = stateWith(allLawKeys);
    const cache = createSynergyCache(full);
    for (let i = 0; i < LAW_COUNT; i++) {
      expect(cache[i]).toBe(computeSynergy(full, i));
      expect(cache[i]).toBeGreaterThanOrEqual(0);
      expect(cache[i]).toBeLessThanOrEqual(2);
    }
  });

  it('matches computeSynergy for mixed synergy-triggering states', () => {
    const states = [
      ['GRAV', 'PLANETARY'],
      ['COLL', 'ACCR'],
      ['LIFE', 'REPRO', 'ENERGY'],
      ['CHAOS', 'ORDER'],
      ['FATE', 'WILL'],
      ['MIND', 'COMMS', 'TELEPATHY', 'ENERGY'],
      ['CHARGE_LAW', 'MAGNETISM', 'SUPERCONDUCTIVITY', 'COLD'],
      ['SINGULARITY', 'GRAV', 'ACCR', 'ENTANGLEMENT', 'TELEPATHY'],
      ['MEMORY', 'FEEDBACK', 'HISTORY', 'PATTERN'],
      ['LANGUAGE', 'CODE', 'CULTURE', 'GENOTYPE'],
    ];
    for (const keys of states) {
      const state = stateWith(keys);
      const cache = createSynergyCache(state);
      for (let i = 0; i < LAW_COUNT; i++) {
        expect(cache[i]).toBe(computeSynergy(state, i));
      }
    }
  });

  it('is a plain number array (float64), not a typed array', () => {
    const cache = createSynergyCache(createLawState());
    expect(Array.isArray(cache)).toBe(true);
    expect(cache.constructor).toBe(Array);
  });
});
