import { describe, it, expect } from 'vitest';
import { captureProductGolden } from '../../scripts/capture-product-golden.mjs';

describe('product solver golden fixture', () => {
  it('repeats fixed-seed positions, velocities, energy, population and offspring at pinned ticks', () => {
    const record = captureProductGolden();
    expect(record.schema).toBe('vepa.product-golden-fixture');
    expect(record.seed).toBe(0x005eed31);
    expect(record.samples.map(sample => sample.tick)).toEqual([1, 2, 4, 8, 16]);
    expect(record.samples).toHaveLength(5);
    expect(record.samples.every(sample => /^[0-9a-f]{64}$/.test(sample.stateSha256))).toBe(true);
    expect(record.samples.every(sample => Number.isFinite(sample.kineticEnergy) &&
      sample.momentum.every(Number.isFinite) && sample.aliveCount === 4 && sample.offspringCount === 0)).toBe(true);
    expect(record.trajectorySha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
