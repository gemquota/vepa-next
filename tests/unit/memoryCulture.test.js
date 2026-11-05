import { describe, it, expect } from 'vitest';
import {
  createMemoryBuffers,
  speciesMemory,
  groupMemory,
  blendMemory,
  adaptMemory,
  decayMemory,
  pruneGroupMemory,
  resetMemoryBuffers,
  memorySnapshot,
  MEMORY_DIM,
  MEM,
} from '../../src/state/memoryBuffers.js';

describe('memoryBuffers — persistent species/group memory (Set G.1)', () => {
  it('lazily allocates stable per-species and per-group vectors', () => {
    const b = createMemoryBuffers();
    const s = speciesMemory(b, 3);
    expect(s).toBeInstanceOf(Float32Array);
    expect(s.length).toBe(MEMORY_DIM);
    expect(speciesMemory(b, 3)).toBe(s); // same vector on repeat access
    const g = groupMemory(b, 7);
    expect(g).toBeInstanceOf(Float32Array);
    expect(b.speciesMem.size).toBe(1);
    expect(b.groupMem.size).toBe(1);
    expect(MEM).toEqual({ ACTIVITY: 0, COHESION: 1, EXPLORATION: 2, THREAT: 3 });
  });

  it('blends dst toward src by rate (clamped)', () => {
    const b = createMemoryBuffers();
    const dst = speciesMemory(b, 0);
    const src = new Float32Array([1, 1, 1, 1]);
    blendMemory(dst, src, 0.5);
    expect(dst[0]).toBeCloseTo(0.5);
    blendMemory(dst, src, 1);
    expect(dst[0]).toBeCloseTo(1);
    blendMemory(dst, new Float32Array([0, 0, 0, 0]), 5); // rate > 1 clamps to 1
    expect(dst[0]).toBeCloseTo(0);
  });

  it('supports cultural inheritance: child blends from parent', () => {
    const b = createMemoryBuffers();
    speciesMemory(b, 0).fill(1); // parent culture
    const child = speciesMemory(b, 1);
    blendMemory(child, speciesMemory(b, 0), 0.5);
    expect(child[0]).toBeCloseTo(0.5);
  });

  it('adapts toward finite signals and skips non-finite channels', () => {
    const b = createMemoryBuffers();
    const mem = speciesMemory(b, 0);
    adaptMemory(mem, [1, undefined, NaN, 0.5], 1);
    expect(mem[0]).toBeCloseTo(1);
    expect(mem[1]).toBeCloseTo(0); // undefined → skipped
    expect(mem[2]).toBeCloseTo(0); // NaN → skipped
    expect(mem[3]).toBeCloseTo(0.5);
  });

  it('decays every buffer and prunes dead group memory only', () => {
    const b = createMemoryBuffers();
    const s = speciesMemory(b, 1); s.fill(1);
    const live = groupMemory(b, 2); live.fill(1);
    const dead = groupMemory(b, 3); dead.fill(1);
    decayMemory(b, 0.5);
    expect(s[0]).toBeCloseTo(0.5);
    expect(live[0]).toBeCloseTo(0.5);
    pruneGroupMemory(b, new Set([2]));
    expect(b.groupMem.has(2)).toBe(true);
    expect(b.groupMem.has(3)).toBe(false);
    expect(b.speciesMem.has(1)).toBe(true); // species memory is never group-pruned
  });

  it('resets all memory and snapshots compactly', () => {
    const b = createMemoryBuffers();
    speciesMemory(b, 1).fill(1);
    groupMemory(b, 2).fill(1);
    const snap = memorySnapshot(b);
    expect(snap.species.length).toBe(1);
    expect(snap.groups.length).toBe(1);
    resetMemoryBuffers(b);
    expect(b.speciesMem.size).toBe(0);
    expect(b.groupMem.size).toBe(0);
  });
});
