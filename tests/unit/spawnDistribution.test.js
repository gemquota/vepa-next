import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES } from '../../src/constants.js';
import { createWorldParams, WORLD_PARAM_DEFS, spawnCaps } from '../../src/state/worldParams.js';
import { initialPopulationTarget, perSpeciesAllocation } from '../../src/spawn/distribution.js';

describe('particle population capacity', () => {
  it('defaults the initial population to zero', () => {
    const params = createWorldParams();
    expect(params.INITIAL_POP).toBe(0);
    expect(initialPopulationTarget(params, { hardCap: MAX_PARTICLES })).toBe(0);
    expect(perSpeciesAllocation(0, 5)).toBe(0);
  });

  it('keeps world population controls and spawn caps within the engine capacity', () => {
    for (const key of ['PARTICLE_COUNT', 'INITIAL_POP', 'MAX_POP']) {
      const definition = WORLD_PARAM_DEFS.find((param) => param.key === key);
      expect(definition.max).toBe(MAX_PARTICLES);
      expect(definition.default).toBeLessThanOrEqual(MAX_PARTICLES);
    }
    expect(spawnCaps({ ...createWorldParams(), PARTICLE_COUNT: MAX_PARTICLES, MAX_POP: MAX_PARTICLES }))
      .toEqual({ hardCap: MAX_PARTICLES, softCap: MAX_PARTICLES });
  });
});
