/**
 * VEPA4 — WRAP and TOROIDAL EDGES are one switch with two faces.
 *
 * WRAP became a law again at mechanics index 130 (it had lost its toggle and
 * become the TOROIDAL EDGES world param). The param survived, because that is
 * how a saved world records its own topology. Two owners of one bit is exactly
 * how a UI ends up showing opposite answers, so the mirroring is specified here
 * rather than left to whoever wires it next.
 */
import { describe, expect, it } from 'vitest';

import { LAW_INDEXES } from '../../src/constants.js';
import { createWorldParams, applyWorldParam, syncWrapLaw, syncToroidalParam } from '../../src/state/worldParams.js';
import { createLawState, isSet } from '../../src/state/lawState.js';

describe('WRAP / TOROIDAL EDGES mirroring', () => {
  it('seeds the bit from the param, defaulting to toroidal', () => {
    const law = createLawState();
    expect(isSet(law, LAW_INDEXES.WRAP)).toBe(false);

    const params = createWorldParams();
    expect(params.TOROIDAL).toBe(1);
    expect(syncWrapLaw(params, law)).toBe(true);
    expect(isSet(law, LAW_INDEXES.WRAP)).toBe(true);
  });

  it('treats a missing or non-zero TOROIDAL as toroidal, because that is what the world did before', () => {
    for (const value of [1, 2, undefined, null, NaN]) {
      const law = createLawState();
      syncWrapLaw({ TOROIDAL: value }, law);
      expect(isSet(law, LAW_INDEXES.WRAP), String(value)).toBe(true);
    }
  });

  it('clears the bit only for an explicit 0', () => {
    const law = createLawState();
    syncWrapLaw({ TOROIDAL: 1 }, law);
    expect(syncWrapLaw({ TOROIDAL: 0 }, law)).toBe(true);
    expect(isSet(law, LAW_INDEXES.WRAP)).toBe(false);
  });

  it('reports no change when the bit already agrees, so callers can skip a sync broadcast', () => {
    const law = createLawState();
    expect(syncWrapLaw({ TOROIDAL: 1 }, law)).toBe(true);
    expect(syncWrapLaw({ TOROIDAL: 1 }, law)).toBe(false);
  });

  it('mirrors the law back onto the param', () => {
    const law = createLawState();
    const toroidal = createWorldParams();

    // WRAP starts clear while the param defaults to toroidal: flipping the law
    // is what turns the world into a box.
    const walled = syncToroidalParam(toroidal, law);
    expect(walled.TOROIDAL).toBe(0);

    // And the other direction: a param change seeds the bit.
    const back = syncWrapLaw({ TOROIDAL: 1 }, law);
    expect(back).toBe(true);
    expect(isSet(law, LAW_INDEXES.WRAP)).toBe(true);
    // No-op when they already agree — the same object comes back.
    expect(syncToroidalParam(applyWorldParam(createWorldParams(), 'TOROIDAL', 1), law))
      .toEqual(applyWorldParam(createWorldParams(), 'TOROIDAL', 1));
  });
});
