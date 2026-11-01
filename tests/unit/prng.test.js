import { describe, it, expect } from 'vitest';
import { SplitMix32 } from '../../src/core/prng.js';

describe('SplitMix32 PRNG', () => {
    it('same seed produces same sequence', () => {
        const a = new SplitMix32(42);
        const b = new SplitMix32(42);
        for (let i = 0; i < 100; i++) {
            expect(a.next()).toBe(b.next());
        }
    });

    it('different seeds produce different sequences', () => {
        const a = new SplitMix32(1);
        const b = new SplitMix32(2);
        const seqA = Array.from({ length: 10 }, () => a.next());
        const seqB = Array.from({ length: 10 }, () => b.next());
        expect(seqA).not.toEqual(seqB);
    });

    it('next() returns values in [0, 1)', () => {
        const prng = new SplitMix32(123);
        for (let i = 0; i < 2000; i++) {
            const v = prng.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('nextInt returns integers in range', () => {
        const prng = new SplitMix32(456);
        for (let i = 0; i < 1000; i++) {
            const v = prng.nextInt(5, 15);
            expect(v).toBeGreaterThanOrEqual(5);
            expect(v).toBeLessThanOrEqual(15);
            expect(Number.isInteger(v)).toBe(true);
        }
    });

    it('nextFloat returns values in [min, max)', () => {
        const prng = new SplitMix32(789);
        for (let i = 0; i < 1000; i++) {
            const v = prng.nextFloat(-10, 20);
            expect(v).toBeGreaterThanOrEqual(-10);
            expect(v).toBeLessThan(20);
        }
    });
});
