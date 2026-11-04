import { describe, expect, it } from 'vitest';
import { LAW_INDEXES } from '../../src/constants.js';
import { WORLD_PARAM_DEFS } from '../../src/state/worldParams.js';
import {
  BUILTIN_LAUNCH_PRESETS,
  ROADMAP_STARTER_PRESET_IDS,
  ROADMAP_STARTER_PRESETS,
  deriveTextSeed,
  normaliseLaunchSettings,
  presetFor,
} from '../../src/state/launchSettings.js';

describe('roadmap launch foundation', () => {
  it('derives a stable bounded seed and retains the exact source text', () => {
    const original = 'quiet blue dawn';
    const first = deriveTextSeed(original);
    expect(deriveTextSeed(original)).toEqual(first);
    expect(first.text).toBe(original);
    expect(first.seed).toBeGreaterThanOrEqual(1);
    expect(first.seed).toBeLessThanOrEqual(2147483647);
    expect(deriveTextSeed('quiet blue dusk').seed).not.toBe(first.seed);
  });

  it('normalizes text seed provenance and derives the same numeric seed', () => {
    const text = '  keep this exact text  ';
    const normalized = normaliseLaunchSettings({ launchSeedText: text, launchSeed: 42 });
    expect(normalized.launchSeedText).toBe(text);
    expect(normalized.launchSeed).toBe(deriveTextSeed(text).seed);
  });

  it('exposes exactly the five named roadmap starter scenarios', () => {
    expect(ROADMAP_STARTER_PRESETS.map(({ id }) => id)).toEqual(ROADMAP_STARTER_PRESET_IDS);
    expect(ROADMAP_STARTER_PRESETS.map(({ name }) => name)).toEqual([
      'PRIMORDIAL SOUP', 'HEAD START', 'ASHEN FRONT', 'PEACEFUL', 'CHAOS',
    ]);
    for (const starter of ROADMAP_STARTER_PRESETS) {
      expect(BUILTIN_LAUNCH_PRESETS).toContain(starter);
      expect(presetFor({ presetId: starter.id })).toBe(starter.preset);
    }
  });

  it('uses only known laws and in-range world parameters in starter presets', () => {
    const params = new Map(WORLD_PARAM_DEFS.map((definition) => [definition.key, definition]));
    for (const starter of ROADMAP_STARTER_PRESETS) {
      for (const law of starter.preset.laws) expect(LAW_INDEXES[law], `${starter.id}:${law}`).toBeDefined();
      for (const [key, value] of Object.entries(starter.preset.worldParams)) {
        const definition = params.get(key);
        if (!definition) continue;
        expect(value, `${starter.id}:${key} below minimum`).toBeGreaterThanOrEqual(definition.min);
        expect(value, `${starter.id}:${key} above maximum`).toBeLessThanOrEqual(definition.max);
      }
    }
  });
});
