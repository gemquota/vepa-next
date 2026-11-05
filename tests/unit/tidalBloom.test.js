import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TIDAL_BLOOM, PRIME_DEFAULT, DEFAULT_PRESET } from '../../src/state/defaultPresets.js';
import { DEFAULT_LAUNCH_PRESET_ID, defaultLaunchSettings, presetFor } from '../../src/state/launchSettings.js';
import { LAW_INDEXES, DNA_INDEXES, DNA_RANGES, LAW_CATEGORIES } from '../../src/constants.js';
import { WORLD_PARAM_DEFS } from '../../src/state/worldParams.js';
import { MAX_SPECIES } from '../../src/constants.js';

const MAIN = readFileSync('src/main.js', 'utf8');

// This preset was authored by hand and the first draft contained six
// out-of-range parameters and nine DNA trait names that do not exist. Neither
// kind of mistake throws at author time: `applyWorldParam` ignores an unknown
// key and returns the state unchanged, and `setDNAFromProfile` skipped anything
// it could not map. Both failures would have been invisible — a parameter
// quietly left at its default, a species trait quietly left unset. These tests
// make both loud.

const PARAM_DEFS = new Map(WORLD_PARAM_DEFS.map((d) => [d.key, d]));
const LEGACY_PRESET_KEYS = new Set(['worldSize', 'entropy', 'gravity', 'dt']);

describe('TIDAL_BLOOM — law declarations', () => {
  it('declares only laws that exist', () => {
    for (const law of TIDAL_BLOOM.laws) {
      expect(LAW_INDEXES[law], `${law} is not a real law`).toBeDefined();
    }
  });

  it('declares no duplicate laws', () => {
    expect(new Set(TIDAL_BLOOM.laws).size).toBe(TIDAL_BLOOM.laws.length);
  });

  it('is a substantial world, not a token set', () => {
    expect(TIDAL_BLOOM.laws.length).toBeGreaterThanOrEqual(30);
  });

  it('covers several categories rather than piling into one', () => {
    const byIndex = new Map(Object.entries(LAW_INDEXES));
    const covered = new Set();
    for (const law of TIDAL_BLOOM.laws) {
      const idx = byIndex.get(law);
      for (const [cat, def] of Object.entries(LAW_CATEGORIES)) {
        if (def.laws.includes(idx)) covered.add(cat);
      }
    }
    // physics, biology, chemistry, thermodynamics, information at minimum.
    for (const cat of ['physics', 'biology', 'chemistry', 'thermodynamics', 'information']) {
      expect(covered.has(cat), `${cat} not represented in TIDAL_BLOOM`).toBe(true);
    }
  });

  it('includes the laws the social stack needs to be observable', () => {
    // Without these the culture / tribe / polity layers have nothing to read.
    for (const law of ['COMMS', 'STIGMERGY', 'CULTURE', 'MEMORY', 'LEARN', 'REPRO']) {
      expect(TIDAL_BLOOM.laws, `${law} missing`).toContain(law);
    }
  });

  it('keeps the laws PRIME_DEFAULT relied on for basic motion', () => {
    for (const law of ['GRAV', 'DRAG', 'COLL', 'LIFE']) {
      expect(TIDAL_BLOOM.laws).toContain(law);
    }
  });
});

describe('TIDAL_BLOOM — world parameters', () => {
  it('declares only real WORLD_PARAM_DEF keys', () => {
    for (const key of Object.keys(TIDAL_BLOOM.worldParams)) {
      if (LEGACY_PRESET_KEYS.has(key)) continue;
      expect(PARAM_DEFS.has(key), `${key} is not a real world parameter`).toBe(true);
    }
  });

  it('keeps every declared parameter inside its own min/max', () => {
    for (const [key, value] of Object.entries(TIDAL_BLOOM.worldParams)) {
      const def = PARAM_DEFS.get(key);
      if (!def) continue;
      expect(typeof value, `${key} must be numeric`).toBe('number');
      expect(value, `${key}=${value} below min ${def.min}`).toBeGreaterThanOrEqual(def.min);
      expect(value, `${key}=${value} above max ${def.max}`).toBeLessThanOrEqual(def.max);
    }
  });

  it('uses the same four legacy keys PRIME_DEFAULT used', () => {
    for (const key of LEGACY_PRESET_KEYS) {
      expect(TIDAL_BLOOM.worldParams[key], `legacy key ${key} missing`).toBeDefined();
    }
  });

  it('actually tunes something — the point of a parameter config', () => {
    // A preset whose parameters are all defaults is a law list with extra steps.
    const defs = Object.entries(TIDAL_BLOOM.worldParams)
      .filter(([k]) => PARAM_DEFS.has(k));
    const changed = defs.filter(([k, v]) => v !== PARAM_DEFS.get(k).default);
    expect(changed.length).toBeGreaterThanOrEqual(10);
  });

  it('tunes the families it turns on', () => {
    // Enabling TIDE and CONVECTION without moving their parameters is how a
    // preset ends up looking inert.
    const w = TIDAL_BLOOM.worldParams;
    expect(w.TIDAL_SCALE).toBeGreaterThan(1);
    expect(w.CONVECTION_RATE).toBeGreaterThan(0.5);
    expect(w.AUTOCATALYSIS_GAIN).toBeGreaterThan(1);
    expect(w.HEBBIAN_LEARNING_RATE).toBeGreaterThan(0.5);
    expect(w.SPAWN_CENTRE_BIAS).toBeGreaterThan(0.2);
  });

  it('shortens the era so the continuity and codex layers get sampled', () => {
    // EPOCH_LENGTH governs how often recordEraContinuity runs. At the 600-tick
    // default a reader would wait a long time to ever see a regime name.
    expect(TIDAL_BLOOM.worldParams.EPOCH_LENGTH).toBeLessThan(600);
  });
});

describe('TIDAL_BLOOM — species', () => {
  it('declares no more species than the world has slots', () => {
    expect(TIDAL_BLOOM.species.length).toBeLessThanOrEqual(MAX_SPECIES);
  });

  it('declares the count it claims', () => {
    expect(TIDAL_BLOOM.species.length).toBe(TIDAL_BLOOM.speciesCount);
  });

  it('gives every species a name and a colour', () => {
    for (const s of TIDAL_BLOOM.species) {
      expect(s.name).toBeTruthy();
      expect(Array.isArray(s.color)).toBe(true);
      expect(s.color).toHaveLength(3);
    }
  });

  it('uses only real DNA trait names', () => {
    for (const s of TIDAL_BLOOM.species) {
      for (const key of Object.keys(s.dna)) {
        expect(DNA_INDEXES[key], `${s.name}.${key} is not a real DNA trait`).toBeDefined();
      }
    }
  });

  it('keeps every trait value inside its range', () => {
    for (const s of TIDAL_BLOOM.species) {
      for (const [key, value] of Object.entries(s.dna)) {
        const idx = DNA_INDEXES[key];
        const r = DNA_RANGES[idx];
        expect(value, `${s.name}.${key}=${value} below ${r.min}`).toBeGreaterThanOrEqual(r.min);
        expect(value, `${s.name}.${key}=${value} above ${r.max}`).toBeLessThanOrEqual(r.max);
      }
    }
  });

  it('declares no duplicate trait within a species', () => {
    for (const s of TIDAL_BLOOM.species) {
      const keys = Object.keys(s.dna);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('gives every species the traits it needs to play its role', () => {
    const bloom = TIDAL_BLOOM.species.find((s) => s.name === 'Bloom');
    // HEAT_OUTPUT and ALPHA are both bounded 0..1 by DNA_RANGES, so the roles
    // are expressed at the extremes of the real range rather than past it.
    expect(bloom.dna.HEAT_OUTPUT, 'Bloom must drive the thermal layer').toBeGreaterThan(0.8);
    const chorus = TIDAL_BLOOM.species.find((s) => s.name === 'Chorus');
    expect(chorus.dna.SIGNAL_RESP, 'Chorus must drive the information layer').toBeGreaterThan(1.5);
    const stalker = TIDAL_BLOOM.species.find((s) => s.name === 'Stalker');
    expect(stalker.dna.PREDATION_BIAS).toBeGreaterThan(1);
    const anchor = TIDAL_BLOOM.species.find((s) => s.name === 'Anchor');
    // ALPHA is transparency clamped at 0 — "cold" is expressed as no heat at
    // all plus mass, not as a negative heat output.
    expect(anchor.dna.HEAT_OUTPUT, 'Anchor must emit no heat for convection to be visible').toBe(0);
    expect(anchor.dna.HIDDEN_MASS, 'Anchor must be the dense counterweight').toBeGreaterThan(2);
  });
});

describe('boot wiring', () => {
  it('boots the default preset, not PRIME_DEFAULT', () => {
    // The launch modal now chooses the preset, so the default lives in
    // state/launchSettings.js rather than as a hard-coded read of
    // DEFAULT_PRESET in main.js. What still matters is that TIDAL_BLOOM is the
    // world you get when you do not choose one.
    expect(DEFAULT_PRESET).toBe(TIDAL_BLOOM);
    expect(DEFAULT_LAUNCH_PRESET_ID).toBe('TIDAL_BLOOM');
    expect(presetFor(defaultLaunchSettings())).toBe(TIDAL_BLOOM);
    // main.js reads the chosen preset rather than pinning one at module scope.
    expect(MAIN).toMatch(/let ACTIVE_PRESET = DEFAULT_PRESET/);
    expect(MAIN).toMatch(/ACTIVE_PRESET = presetFor\(settings\)/);
    expect(MAIN).toMatch(/applyDefaultWorldConfig\(\)/);
    expect(MAIN).not.toMatch(/applyPrimeWorldConfig/);
  });

  it('derives the boot species from the preset instead of a second copy', () => {
    // A hand-maintained duplicate of the species list in main.js meant editing
    // the preset's species did not change what actually spawned. The launch
    // modal refills the same array rather than reassigning it, because the
    // closures that read it captured it at module scope.
    expect(MAIN).toMatch(/SPECIES_PROFILES = DEFAULT_PRESET\.species\.map/);
    expect(MAIN).toMatch(/SPECIES_PROFILES\.length = 0/);
    expect(MAIN).toMatch(/SPECIES_PROFILES\.push\(/);
  });

  it('accepts canonical DNA names in a profile', () => {
    // The old 10-key MAP silently discarded every trait outside it, which is
    // why the first TIDAL_BLOOM draft would have spawned default DNA.
    expect(MAIN).toMatch(/DNA_INDEXES\[key\] !== undefined \? key : LEGACY_PROFILE_KEYS\[key\]/);
    expect(MAIN).toMatch(/LEGACY_PROFILE_KEYS/);
  });

  it('routes the preset timestep to runtimeConfig, not a world param', () => {
    expect(MAIN).toMatch(/runtimeConfig\.simSpeed = value/);
  });

  it('still layers the shared substrate param the preset omits', () => {
    expect(MAIN).toMatch(/WELL_COUNT: 3/);
  });

  it('leaves PRIME_DEFAULT exported and intact', () => {
    expect(PRIME_DEFAULT.name).toBe('PRIME_DEFAULT');
    expect(PRIME_DEFAULT.laws.length).toBeGreaterThan(0);
    expect(PRIME_DEFAULT.species.length).toBe(5);
  });
});