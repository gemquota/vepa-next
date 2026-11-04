import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SplitMix32 } from '../../src/core/prng.js';
import { createWorldParams, WORLD_PARAM_DEFS } from '../../src/state/worldParams.js';
import { DNA_COUNT, DNA_RANGES, DEFAULT_DNA_STRIDE } from '../../src/constants.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { readDNAParam } from '../../src/dna/codec.js';
import { randomizeChaosSettings } from '../../src/state/chaosSettings.js';

describe('default full Chaos settings', () => {
  it('reproducibly samples full WORLD ranges and slider steps plus active DNA without mutating inputs', () => {
    const world = createWorldParams();
    const dna = createDNABuffer();
    loadDefaults(dna, DNA_RANGES);
    const before = dna.slice();
    const first = randomizeChaosSettings(world, dna, 5, new SplitMix32(42));
    expect(first).toEqual(randomizeChaosSettings(world, dna, 5, new SplitMix32(42)));
    expect(first).not.toEqual(randomizeChaosSettings(world, dna, 5, new SplitMix32(43)));
    expect(dna).toEqual(before);
    expect(world).toEqual(createWorldParams());

    for (const def of WORLD_PARAM_DEFS) {
      const value = first.worldParams[def.key];
      expect(value).toBeGreaterThanOrEqual(def.min);
      expect(value).toBeLessThanOrEqual(def.max);
      if (def.group === 'PERFORMANCE') {
        expect(value).toBe(world[def.key]);
      } else {
        const stepPosition = (value - def.min) / def.step;
        expect(value === def.max || Math.abs(stepPosition - Math.round(stepPosition)) < 1e-8).toBe(true);
      }
    }

    expect(first.worldParams.INITIAL_POP).toBeLessThanOrEqual(first.worldParams.MAX_POP);
    expect(first.worldParams.MAX_POP).toBeLessThanOrEqual(first.worldParams.PARTICLE_COUNT);
    const upper = randomizeChaosSettings(world, dna, 0, { next: () => 0.999999999999 }).worldParams;
    expect(upper.WORLD_SIZE).toBe(20000);
    expect(upper.PARTICLE_COUNT).toBe(10000);
    expect(upper.MAX_POP).toBe(10000);
    expect(upper.INITIAL_POP).toBe(10000);
    expect(upper.TIME_SPEED).toBe(10);
    expect(upper.SPAWN_RATE).toBe(100);
    const lower = randomizeChaosSettings(world, dna, 0, { next: () => 0 }).worldParams;
    expect(lower.WORLD_SIZE).toBe(50);
    expect(lower.PARTICLE_COUNT).toBe(100);
    expect(lower.MAX_POP).toBe(100);
    expect(lower.INITIAL_POP).toBe(0);
    expect(lower.TIME_SPEED).toBe(0.1);
    expect(lower.SPAWN_RATE).toBe(0);
    for (let seed = 1; seed <= 32; seed++) {
      const generated = randomizeChaosSettings(world, dna, 0, new SplitMix32(seed)).worldParams;
      expect(generated.INITIAL_POP).toBeLessThanOrEqual(generated.MAX_POP);
      expect(generated.MAX_POP).toBeLessThanOrEqual(generated.PARTICLE_COUNT);
      for (const key of ['WORLD_SIZE', 'PARTICLE_COUNT', 'MAX_POP', 'INITIAL_POP']) {
        const def = WORLD_PARAM_DEFS.find((item) => item.key === key);
        expect(generated[key]).toBeGreaterThanOrEqual(def.min);
        expect(generated[key]).toBeLessThanOrEqual(def.max);
      }
    }

    for (let s = 0; s < 5; s++) for (let p = 0; p < DNA_COUNT; p++) {
      const value = readDNAParam(first.dna, s, p);
      expect(value).toBeGreaterThanOrEqual(DNA_RANGES[p].min);
      expect(value).toBeLessThanOrEqual(DNA_RANGES[p].max);
      expect(first.dna[s * DEFAULT_DNA_STRIDE + p]).not.toBe(before[s * DEFAULT_DNA_STRIDE + p]);
    }
    expect(first.dna.slice(5 * DEFAULT_DNA_STRIDE)).toEqual(before.slice(5 * DEFAULT_DNA_STRIDE));
  });

  it('default tap stages all settings then restarts, with genome adoption after worker stop', () => {
    const ui = readFileSync(new URL('../../src/ui/ui.js', import.meta.url), 'utf8');
    expect(ui).toMatch(/bus.emit\('sim:chaos'\);\s*bus.emit\('sim:restart'/);
    const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    const restart = main.slice(main.indexOf("bus.on('sim:restart', (opts"), main.indexOf("bus.on('species:changed'"));
    expect(restart.indexOf('stopPhysicsWorker()')).toBeLessThan(restart.indexOf('dnaBuffer.set(pendingChaosDNA)'));
    expect(restart.indexOf('dnaBuffer.set(pendingChaosDNA)')).toBeLessThan(restart.indexOf('spawnDefaultPopulation'));
    const chaos = main.slice(main.indexOf("bus.on('sim:chaos', () => {"), main.indexOf("bus.on('sim:chaosClear'"));
    expect(chaos).toContain('randomizeChaosSettings(worldParams, dnaBuffer, speciesCount, prng)');
    expect(chaos).not.toContain('Math.random');
    expect(chaos).toContain('lawIndex === LAW_INDEXES.CONTACT');
  });
});
