import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '../../src/core/eventBus.js';
import { DNA_COUNT, DNA_RANGES, MAX_SPECIES } from '../../src/constants.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { readDNAParam } from '../../src/dna/codec.js';
import { wirePendingDNA } from '../../src/state/pendingDNA.js';

describe('restart-staged DNA slider edits', () => {
  function fixture() {
    const bus = new EventBus();
    const live = createDNABuffer();
    loadDefaults(live, DNA_RANGES);
    const updates = [];
    bus.on('dna:pending', (state) => updates.push(state));
    const controller = wirePendingDNA(bus, { getLive: () => live });
    return { bus, live, updates, controller };
  }

  it('keeps slider proposals out of the live genome during running and paused states', () => {
    const f = fixture();
    const original = readDNAParam(f.live, 0, 0);
    const requested = DNA_RANGES[0].max;
    const sync = vi.fn();
    f.bus.on('dna:changed', sync);
    f.bus.on('dna:editApplied', sync);
    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: requested });
    f.bus.emit('sim:pause');
    f.bus.emit('sim:resume');
    expect(readDNAParam(f.live, 0, 0)).toBe(original);
    expect(sync).not.toHaveBeenCalled();
    expect(f.updates.at(-1).changes).toMatchObject([{ species: 0, param: 0, value: requested, liveValue: original }]);
  });

  it('validates edits, clamps values, coalesces proposals and removes reversions', () => {
    const f = fixture();
    const rejected = vi.fn();
    f.bus.on('dna:editRejected', rejected);
    for (const invalid of [
      { species: -1, param: 0, value: 1 },
      { species: MAX_SPECIES, param: 0, value: 1 },
      { species: 0, param: -1, value: 1 },
      { species: 0, param: DNA_COUNT, value: 1 },
      { species: 0, param: 0, value: Infinity },
    ]) f.bus.emit('dna:editRequested', invalid);
    expect(rejected).toHaveBeenCalledTimes(5);
    const original = readDNAParam(f.live, 0, 0);
    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: 1e9 });
    expect(f.updates.at(-1).changes[0].value).toBe(DNA_RANGES[0].max);
    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: DNA_RANGES[0].min });
    expect(f.updates.at(-1).changes).toHaveLength(1);
    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: original });
    expect(f.updates.at(-1).changes).toEqual([]);
    f.bus.emit('dna:editRequested', { species: 1, param: 0, value: DNA_RANGES[0].max });
    f.live[64] = 65535;
    f.bus.emit('dna:changed', { species: 1, param: 0 });
    expect(f.updates.at(-1).changes).toEqual([]);
  });

  it('commits only explicitly and clears proposals on discard or world restore', () => {
    const f = fixture();
    const oldA = readDNAParam(f.live, 0, 0);
    const oldB = readDNAParam(f.live, 2, 42);
    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: DNA_RANGES[0].max });
    f.bus.emit('dna:editRequested', { species: 2, param: 42, value: DNA_RANGES[42].max });
    expect(readDNAParam(f.live, 0, 0)).toBe(oldA);
    expect(readDNAParam(f.live, 2, 42)).toBe(oldB);
    expect(f.controller.commit()).toHaveLength(2);
    expect(readDNAParam(f.live, 0, 0)).toBe(DNA_RANGES[0].max);
    expect(readDNAParam(f.live, 2, 42)).toBe(DNA_RANGES[42].max);
    expect(f.controller.commit()).toEqual([]);

    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: DNA_RANGES[0].min });
    f.bus.emit('dna:discardPending');
    expect(f.controller.commit()).toEqual([]);
    f.bus.emit('dna:editRequested', { species: 0, param: 0, value: DNA_RANGES[0].min });
    f.bus.emit('world:restored');
    expect(f.controller.commit()).toEqual([]);
    expect(readDNAParam(f.live, 0, 0)).toBe(DNA_RANGES[0].max);
  });

  it('commits the genome batch after stopping compute and before spawning/reinitializing', () => {
    const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    const restart = main.slice(main.indexOf("bus.on('sim:restart', (opts"), main.indexOf("bus.on('species:changed'"));
    const ordered = ['stopPhysicsWorker()', 'pendingLaws.commit()', 'pendingWorldParams.commit()', 'pendingDNA.commit()', 'spawnDefaultPopulation', 'startPhysicsWorker()'];
    for (let i = 1; i < ordered.length; i++) {
      expect(restart.indexOf(ordered[i - 1])).toBeGreaterThanOrEqual(0);
      expect(restart.indexOf(ordered[i - 1])).toBeLessThan(restart.indexOf(ordered[i]));
    }
  });
});
