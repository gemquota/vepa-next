import { describe, it, expect } from 'vitest';
import { LAW_INDEXES, LAW_COUNT } from '../../src/constants/laws.js';
import { PARTICLE_STRIDE as PRODUCT_PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants/stride.js';
import {
  STABLE_LAW_INVENTORY,
  STABLE_LAW_COMPATIBILITY,
} from '../../sim-foundation/src/sim/stable-law-inventory.js';
import {
  PARTICLE_LAYOUT_VERSION,
  PARTICLE_STRIDE as SIM_PARTICLE_STRIDE,
  PARTICLE_SLOTS,
} from '../../sim-foundation/src/sim/particle-layout.js';

describe('product ↔ SIM compatibility contracts', () => {
  it('keeps the product law index space dense, unique, and exactly 136 entries', () => {
    const entries = Object.entries(LAW_INDEXES);
    const indexes = entries.map(([, index]) => index);

    expect(LAW_COUNT).toBe(136);
    expect(entries).toHaveLength(LAW_COUNT);
    expect(new Set(indexes).size).toBe(LAW_COUNT);
    expect([...indexes].sort((a, b) => a - b)).toEqual(
      Array.from({ length: LAW_COUNT }, (_, index) => index),
    );
  });

  it('maps every unchanged product law name to its stable ID at the same index', () => {
    const stableByName = new Map(STABLE_LAW_INVENTORY.map(law => [law.stableName, law]));

    for (const [name, index] of Object.entries(LAW_INDEXES)) {
      if (name === 'WRAP') continue; // Explicit compatibility exception tested below.
      const stable = stableByName.get(name);
      expect(stable, `missing stable law identity for product law ${name}`).toBeDefined();
      expect(stable.stableIndex, `index drift for product law ${name}`).toBe(index);
    }
  });

  it('does not alias the product WRAP law to the historical INERTIA identity', () => {
    const legacyInertia = STABLE_LAW_INVENTORY.find(law => law.stableName === 'INERTIA');
    const wrapCompatibility = STABLE_LAW_COMPATIBILITY.WRAP;

    expect(LAW_INDEXES.WRAP).toBe(130);
    expect(LAW_INDEXES.INERTIA).toBeUndefined();
    expect(legacyInertia).toMatchObject({ stableIndex: 130, canonicalId: 'law.inertia' });
    expect(wrapCompatibility).toMatchObject({
      canonicalTarget: 'boundaryMode',
      status: 'v5-compatibility-alias',
    });
    expect(wrapCompatibility.canonicalTarget).not.toBe(legacyInertia.canonicalId);
  });

  it('keeps the product and SIM particle layouts byte-for-byte slot compatible', () => {
    expect(PRODUCT_PARTICLE_STRIDE).toBe(100);
    expect(SIM_PARTICLE_STRIDE).toBe(PRODUCT_PARTICLE_STRIDE);
    expect(PARTICLE_LAYOUT_VERSION).toBeGreaterThanOrEqual(1);
    expect(Object.keys(PARTICLE_SLOTS).sort()).toEqual(Object.keys(STRIDE_INDEXES).sort());
    expect(PARTICLE_SLOTS).toEqual(STRIDE_INDEXES);

    for (const [field, offset] of Object.entries(STRIDE_INDEXES)) {
      expect(Number.isInteger(offset), `${field} offset must be an integer`).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(PRODUCT_PARTICLE_STRIDE);
    }
  });
});
