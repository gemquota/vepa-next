import { describe, it, expect } from 'vitest';
import { LAW_INDEXES, LAW_COUNT } from '../../src/constants.js';
import { LAW_SET_PRESETS } from '../../src/ui/worldPanel.js';

describe('Law set presets', () => {
  it('has exactly 31 presets', () => {
    expect(LAW_SET_PRESETS.length).toBe(31);
  });

  it('every preset law name resolves to a valid index', () => {
    for (const preset of LAW_SET_PRESETS) {
      expect(typeof preset.name).toBe('string');
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.laws.length).toBeGreaterThan(0);
      for (const name of preset.laws) {
        const idx = LAW_INDEXES[name];
        expect(idx, `${preset.name}: ${name}`).toBeDefined();
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(LAW_COUNT);
      }
    }
  });

  it('preset names are unique', () => {
    const names = LAW_SET_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
