import { describe, it, expect } from 'vitest';
import { createLawState, toggle, set, clear, isSet, getActiveCount, getStateVector, serialize, deserialize } from '../../src/state/lawState.js';

describe('LawState', () => {
    it('starts with all laws off', () => {
        const state = createLawState();
        expect(getActiveCount(state)).toBe(0);
    });

    it('set and isSet work for low-range laws (0-31)', () => {
        const state = createLawState();
        set(state, 0);
        expect(isSet(state, 0)).toBe(true);
        set(state, 15);
        expect(isSet(state, 15)).toBe(true);
        expect(getActiveCount(state)).toBe(2);
    });

    it('set and isSet work for high-range laws (32-63)', () => {
        const state = createLawState();
        set(state, 35);
        expect(isSet(state, 35)).toBe(true);
        set(state, 63);
        expect(isSet(state, 63)).toBe(true);
        expect(getActiveCount(state)).toBe(2);
    });

    it('set and isSet work for extended-range laws (64-95) without collisions', () => {
        const state = createLawState();
        set(state, 64);
        set(state, 78);
        expect(isSet(state, 64)).toBe(true);
        expect(isSet(state, 78)).toBe(true);
        expect(isSet(state, 32)).toBe(false); // no overlap with the old high word
        expect(isSet(state, 46)).toBe(false);
        expect(getActiveCount(state)).toBe(2);
        clear(state, 64);
        expect(isSet(state, 64)).toBe(false);
        expect(isSet(state, 78)).toBe(true);
    });

    it('toggle flips state', () => {
        const state = createLawState();
        toggle(state, 5);
        expect(isSet(state, 5)).toBe(true);
        toggle(state, 5);
        expect(isSet(state, 5)).toBe(false);
    });

    it('clear removes a law', () => {
        const state = createLawState();
        set(state, 10);
        expect(isSet(state, 10)).toBe(true);
        clear(state, 10);
        expect(isSet(state, 10)).toBe(false);
    });

    it('getStateVector returns correct boolean array', () => {
        const state = createLawState();
        set(state, 0);
        set(state, 35);
        const vec = getStateVector(state);
        expect(vec).toHaveLength(128);
        expect(vec[0]).toBe(true);
        expect(vec[35]).toBe(true);
        expect(vec[1]).toBe(false);
        set(state, 78);
        const vec2 = getStateVector(state);
        expect(vec2[78]).toBe(true);
    });

    it('serialize/deserialize round-trip', () => {
        const state = createLawState();
        set(state, 0);
        set(state, 35);
        set(state, 63);
        set(state, 78);
        const data = serialize(state);
        expect(data.ext).toBeGreaterThan(0);
        const restored = deserialize(data);
        expect(isSet(restored, 0)).toBe(true);
        expect(isSet(restored, 35)).toBe(true);
        expect(isSet(restored, 63)).toBe(true);
        expect(isSet(restored, 78)).toBe(true);
        expect(isSet(restored, 1)).toBe(false);

        // legacy {low, high} payloads (saved before the third word) still load
        const legacy = deserialize({ low: data.low, high: data.high });
        expect(isSet(legacy, 0)).toBe(true);
        expect(isSet(legacy, 78)).toBe(false);
    });
});
