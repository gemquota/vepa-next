import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createCivilizationRegistry,
  foundCulture,
  stepCivilization,
  civilizationReport,
  serializeCivilization,
  restoreCivilization,
} from '../../src/state/civilization.js';
import { captureWorldState, restoreWorldState } from '../../src/state/worldSave.js';
import { PARTICLE_STRIDE } from '../../src/constants.js';
import { createLawState } from '../../src/state/lawState.js';

const MAIN = readFileSync('src/main.js', 'utf8');

describe('civilization ontology runtime wiring', () => {
  // The lifecycle substrate (systemLifecycle.js) shipped 464 lines and 24
  // exports that no runtime code imported — it was exercised only by tests.
  // These assertions pin it to the app so the gap cannot silently reopen.
  it('is imported and instantiated by the application orchestrator', () => {
    expect(MAIN).toMatch(/from '\.\/state\/civilization\.js'/);
    expect(MAIN).toMatch(/createCivilizationRegistry\(\)/);
  });

  it('steps the ontology on the social cadence, not only in tests', () => {
    expect(MAIN).toMatch(/stepCivilization\(/);
    // ...inside the same guarded block as the other social systems
    expect(MAIN).toMatch(/if \(civilization\)\s*\{/);
  });

  it('emits analytics so the state is observable at runtime', () => {
    expect(MAIN).toMatch(/civilization:analytics/);
  });

  it('participates in world save and restore', () => {
    expect(MAIN).toMatch(/serializeCivilization\(/);
    expect(MAIN).toMatch(/restoreCivilization\(/);
  });

  it('is reset with the rest of the per-world intelligence state', () => {
    const reset = MAIN.slice(MAIN.indexOf('function resetIntelligence'));
    expect(reset).toMatch(/civilization = createCivilizationRegistry\(\)/);
  });
});

describe('civilization persistence through the world save contract', () => {
  function fixture() {
    const view = new Float32Array(PARTICLE_STRIDE * 2);
    const registry = createCivilizationRegistry();
    foundCulture(registry, 'g1', { name: 'Ashmark', symbols: ['ember'] });
    return { view, registry };
  }

  it('round-trips civilization state through capture and restore', () => {
    const { view, registry } = fixture();
    const state = captureWorldState({
      view, count: 2, speciesCount: 1, dna: null,
      laws: createLawState(), worldSize: 100, tick: 3,
      civilization: serializeCivilization(registry),
    });
    expect(state.civilization).not.toBeNull();

    const out = restoreWorldState(state);
    const back = restoreCivilization(out.civilization);
    expect(civilizationReport(back).cultures).toBe(1);
    expect(civilizationReport(back).detail.cultures[0].ownerGroupId).toBe('g1');
  });

  it('is backward compatible: a save with no civilization key yields an empty registry', () => {
    const { view } = fixture();
    const state = captureWorldState({
      view, count: 2, speciesCount: 1, dna: null,
      laws: createLawState(), worldSize: 100, tick: 1,
    });
    expect(state.civilization).toBeNull();
    const out = restoreWorldState(state);
    expect(out.civilization).toBeNull();
    expect(civilizationReport(restoreCivilization(out.civilization)).cultures).toBe(0);
  });

  it('stays bounded across many steps', () => {
    const { registry } = fixture();
    for (let t = 0; t < 500; t++) stepCivilization(registry, { tick: t });
    const rep = civilizationReport(registry);
    expect(rep.tick).toBe(499);
    expect(rep.cultures).toBe(1);
  });
});
