import { describe, expect, it } from 'vitest';
import { LAW_INDEXES } from '../../src/constants.js';
import {
  INTERACTION_PRESETS,
  getInteractionLawIndexes,
  getInteractionPreset,
  listInteractionPresets,
} from '../../src/physics/interactionSpace.js';

describe('interaction space', () => {
  it('maps named mechanisms to live law indexes without hardcoded indexes', () => {
    expect(getInteractionLawIndexes('ACCR')).toEqual([LAW_INDEXES.ACCR]);
    expect(getInteractionLawIndexes('ALLOY')).toEqual([LAW_INDEXES.ALLOY]);
    expect(getInteractionLawIndexes('SINGULARITY')).toEqual([
      LAW_INDEXES.SINGULARITY,
      LAW_INDEXES.HORIZON,
    ]);
  });

  it('keeps ACCR as a separate-particle composite and ALLOY as one-body fusion', () => {
    expect(getInteractionPreset('ACCR').semantics.identity).toBe('composite without identity merge');
    expect(getInteractionPreset('ACCR').semantics.geometry).toBe('edge-to-edge');
    expect(getInteractionPreset('ALLOY').semantics.identity).toBe('A+B→C');
    expect(getInteractionPreset('ALLOY').semantics.geometry).toBe('coincident');
  });

  it('covers the requested relationship dimensions for every joining mechanism', () => {
    const joining = listInteractionPresets().filter((preset) =>
      ['attachment', 'fusion', 'interaction', 'biological relationship', 'creation'].includes(preset.category),
    );
    expect(joining.length).toBeGreaterThanOrEqual(10);
    for (const preset of joining) {
      expect(preset.semantics).toEqual(expect.objectContaining({
        trigger: expect.any(Array),
        participants: expect.any(String),
        relation: expect.any(String),
        geometry: expect.anything(),
        persistence: expect.any(String),
        outcome: expect.any(Array),
      }));
      expect(preset.implementation.length).toBeGreaterThan(0);
    }
  });

  it('returns immutable registry data and handles unknown names', () => {
    expect(Object.isFrozen(INTERACTION_PRESETS)).toBe(true);
    expect(Object.isFrozen(getInteractionPreset('BOND'))).toBe(true);
    expect(getInteractionPreset('not-a-mechanism')).toBeNull();
    expect(getInteractionLawIndexes('not-a-mechanism')).toEqual([]);
  });
});
