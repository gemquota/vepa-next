import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/eventBus.js';
import { createHUD, formatTickStats } from '../../src/ui/hud.js';
import { installDom } from '../helpers/domStub.js';

let restoreNow;
let savedRaf;
let savedCancelRaf;

afterEach(() => {
  restoreNow?.();
  restoreNow = null;
  if (savedRaf === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = savedRaf;
  if (savedCancelRaf === undefined) delete globalThis.cancelAnimationFrame;
  else globalThis.cancelAnimationFrame = savedCancelRaf;
  savedRaf = undefined;
  savedCancelRaf = undefined;
});

describe('HUD telemetry', () => {
  it('keeps total tick, tick rate, and frame rate visible together', () => {
    expect(formatTickStats(1234, 59.96, 42.25)).toBe('1,234\n42.3 TPS · 60.0 FPS');
  });

  it('normalizes an uninitialized tick value and empty rates', () => {
    expect(formatTickStats(-1, 0)).toBe('0\n0.0 TPS · 0.0 FPS');
  });

  it('updates visible particle, species, tick and tick-rate telemetry from events', () => {
    const doc = installDom();
    doc.body.innerHTML = '<span id="hud-particles"></span><span id="hud-species"></span><span id="hud-tick"></span>';
    let now = 0;
    restoreNow = vi.spyOn(performance, 'now').mockImplementation(() => now);
    savedRaf = globalThis.requestAnimationFrame;
    savedCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    const bus = new EventBus();
    createHUD(bus);

    bus.emit('physics:tick', { tick: 12, particleCount: 1200, speciesCount: 5 });
    now = 1000;
    bus.emit('physics:tick', { tick: 32, particleCount: 1190, speciesCount: 6 });

    expect(doc.querySelector('#hud-particles').dataset.count).toBe('1,190');
    expect(doc.querySelector('#hud-particles').getAttribute('aria-label')).toBe('1,190 particles alive');
    expect(doc.querySelector('#hud-species').textContent).toBe('SPECIES 6');
    expect(doc.querySelector('#hud-tick').textContent).toBe('32\n20.0 TPS · 0.0 FPS');
  });
});
