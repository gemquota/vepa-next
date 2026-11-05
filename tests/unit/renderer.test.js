import { describe, it, expect } from 'vitest';
import { asParticleView } from '../../src/render/renderer.js';

describe('Renderer particle view (zero-copy hot path)', () => {
  it('returns the same instance for an existing Float32Array (no per-frame copy)', () => {
    const view = new Float32Array(16);
    expect(asParticleView(view)).toBe(view);
  });

  it('wraps a raw ArrayBuffer into a live Float32Array view (no data copy)', () => {
    const buf = new ArrayBuffer(16 * 4);
    const view = asParticleView(buf);
    expect(view).toBeInstanceOf(Float32Array);
    expect(view.byteLength).toBe(16 * 4);
    new Float32Array(buf)[0] = 42;
    expect(view[0]).toBe(42);
  });

  it('wraps a SharedArrayBuffer into a Float32Array view', () => {
    if (typeof SharedArrayBuffer === 'undefined') return;
    const sab = new SharedArrayBuffer(16 * 4);
    const view = asParticleView(sab);
    expect(view).toBeInstanceOf(Float32Array);
    expect(view[0]).toBe(0);
  });
});
