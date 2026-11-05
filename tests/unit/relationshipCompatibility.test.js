import { describe, expect, it } from 'vitest';
import { DNA_INDEXES as D, PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../src/constants.js';
import { compatibilityForViews, evaluateCompatibility, projectRelationshipGenome } from '../../src/physics/relationshipCompatibility.js';
import {
  applyRelationshipStress,
  closeRelationship,
  createRelationshipState,
  shouldBreakRelationship,
  updateRelationshipState,
} from '../../src/physics/relationshipState.js';

function particle(speciesId, overrides = {}) {
  const dna = new Array(42).fill(0.5);
  dna[D.STIFFNESS] = 2;
  dna[D.ELASTICITY] = 0.5;
  dna[D.SYMMETRY] = 1;
  dna[D.BOND_ANGLE] = 90;
  dna[D.SPECIES_AFFINITY] = 1;
  Object.assign(dna, overrides.dna || {});
  return { speciesId, mass: 1, energy: 50, radius: 2, dna };
}

describe('relationship compatibility', () => {
  it('returns independent dimensions derived from both participants', () => {
    const compatible = evaluateCompatibility(particle(1), particle(1));
    const incompatible = evaluateCompatibility(particle(1, { dna: { [D.STIFFNESS]: 0, [D.BOND_ANGLE]: 270 } }), particle(2));

    expect(compatible.dimensions).toEqual(expect.objectContaining({
      physical: expect.any(Number),
      energetic: expect.any(Number),
      genetic: expect.any(Number),
      geometric: expect.any(Number),
      resource: expect.any(Number),
      behavioral: expect.any(Number),
      reproductive: expect.any(Number),
    }));
    expect(compatible.overall).toBeGreaterThan(incompatible.overall);
  });

  it('reads both particle rows without changing the 100-float stride', () => {
    const view = new Float32Array(PARTICLE_STRIDE * 2);
    view[S.SPECIES_ID] = 1;
    view[PARTICLE_STRIDE + S.SPECIES_ID] = 2;
    view[S.RADIUS] = 2;
    view[PARTICLE_STRIDE + S.RADIUS] = 2;
    for (let d = 0; d < 42; d++) {
      view[S.DNA_CACHE_START + d] = 0.5;
      view[PARTICLE_STRIDE + S.DNA_CACHE_START + d] = 0.5;
    }
    const result = compatibilityForViews(view, 0, PARTICLE_STRIDE, {});
    expect(result.sameSpecies).toBe(false);
    expect(result.dimensions.physical).toBeGreaterThan(0);
  });

  it('projects the relationship genome from existing DNA loci', () => {
    const genome = projectRelationshipGenome(new Array(42).fill(0.25));
    expect(genome.R05_ATTACHMENT_PROBABILITY).toBe(0.25);
    expect(Object.isFrozen(genome)).toBe(true);
  });
});

describe('relationship state', () => {
  it('tracks age, stress, repair, and closure without mutating the prior record', () => {
    const state = createRelationshipState({ a: 4, b: 2, type: 'structural', integrity: 0.8, tick: 10 });
    const stressed = applyRelationshipStress(state, 0.4);
    const repaired = applyRelationshipStress(stressed, 0.1, { repair: true });
    const aged = updateRelationshipState(repaired, { tick: 15, dt: 0.5, energyFlow: 2 });
    const closed = closeRelationship(aged, 20);

    expect(state.a).toBe(2);
    expect(state.integrity).toBe(0.8);
    expect(aged.age).toBe(2.5);
    expect(aged.energyFlow).toBe(2);
    expect(shouldBreakRelationship(stressed, { integrity: 0.5 })).toBe(true);
    expect(closed.active).toBe(false);
    expect(closed.breakCount).toBe(1);
  });
});
