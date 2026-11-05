/**
 * VEPA4 — the LOGS sub-tab's queue, filters and follow indicator.
 *
 * `narrative:batch` had a listener and no producer for the whole life of the
 * panel. These tests pin the producer down: entries are batched, nothing is
 * lost or reordered, and the filter chips apply to the whole ring rather than
 * only to what arrived after they were pressed.
 */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

import { installDom } from '../helpers/domStub.js';
import { EventBus } from '../../src/core/eventBus.js';
import { createLogQueue, DEFAULT_MAX_PENDING } from '../../src/core/logQueue.js';
import { createNarrativePanel, entryCategory, categoryCounts } from '../../src/ui/narrativePanel.js';

describe('log queue', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('emits nothing until the flush window closes', () => {
    const batches = [];
    bus.on('narrative:batch', (b) => batches.push(b));
    const queue = createLogQueue(bus);

    bus.emit('narrative:entry', { voice: 'Observer', text: 'one' });
    expect(batches).toHaveLength(0);

    vi.advanceTimersByTime(300);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([{ voice: 'Observer', text: 'one' }]);
    expect(queue.pending()).toBe(0);
  });

  it('flushes early once enough entries pile up', () => {
    const batches = [];
    bus.on('narrative:batch', (b) => batches.push(b));
    createLogQueue(bus, { maxPending: 3 });

    for (let i = 0; i < 3; i++) bus.emit('narrative:entry', { voice: 'System', text: `n${i}` });
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.text)).toEqual(['n0', 'n1', 'n2']);
    expect(DEFAULT_MAX_PENDING).toBeGreaterThan(1);
  });

  it('files system messages in the same batch, in order', () => {
    const batches = [];
    bus.on('narrative:batch', (b) => batches.push(b));
    createLogQueue(bus);

    bus.emit('narrative:entry', { voice: 'Observer', text: 'a' });
    bus.emit('narrative:system', { text: 'b' });
    bus.emit('narrative:entry', { voice: 'Diverger', text: 'c' });
    vi.advanceTimersByTime(300);

    expect(batches[0].map((e) => e.text)).toEqual(['a', 'b', 'c']);
    expect(batches[0][1].voice).toBe('System');
  });

  it('loses nothing across many flushes', () => {
    const seen = [];
    bus.on('narrative:batch', (b) => seen.push(...b.map((e) => e.text)));
    const queue = createLogQueue(bus, { flushMs: 10 });

    for (let i = 0; i < 50; i++) {
      bus.emit('narrative:entry', { voice: 'System', text: `e${i}` });
      if (i % 7 === 0) queue.flush();
      vi.advanceTimersByTime(10);
    }
    queue.flush();
    expect(seen).toHaveLength(50);
    expect(new Set(seen).size).toBe(50);
  });

  it('stop() drops pending work and unsubscribes both source channels', () => {
    const batches = [];
    bus.on('narrative:batch', (batch) => batches.push(...batch));
    const queue = createLogQueue(bus);
    bus.emit('narrative:entry', { voice: 'System', text: 'queued' });
    queue.stop();

    expect(queue.pending()).toBe(0);
    expect(bus.listeners['narrative:entry']).toHaveLength(0);
    expect(bus.listeners['narrative:system']).toHaveLength(0);
    bus.emit('narrative:entry', { voice: 'System', text: 'after stop' });
    bus.emit('narrative:system', { text: 'after stop too' });
    vi.advanceTimersByTime(1000);
    expect(batches).toEqual([]);
  });
});

describe('log categories', () => {
  it('files an unknown voice under SYSTEM rather than dropping it', () => {
    expect(entryCategory({ voice: 'Observer' })).toBe('Observer');
    expect(entryCategory({ voice: 'Oracle' })).toBe('System');
    expect(entryCategory({})).toBe('System');
    expect(entryCategory(null)).toBe('System');
  });

  it('counts every entry exactly once, including under ALL', () => {
    const entries = [
      { voice: 'Observer' }, { voice: 'Observer' }, { voice: 'System' },
      { voice: 'Oracle' }, { voice: 'Dissolver' },
    ];
    const counts = categoryCounts(entries);
    expect(counts.ALL).toBe(5);
    expect(counts.Observer).toBe(2);
    expect(counts.System).toBe(2);   // the explicit System and the unknown Oracle
    expect(counts.Dissolver).toBe(1);
    expect(counts.Stabilizer).toBe(0);
  });
});

describe('the LOGS panel', () => {
  let doc;
  let bus;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = installDom();
    const mount = doc.createElement('div');
    mount.setAttribute('id', 'narrative-panel');
    doc.body.appendChild(mount);
    bus = new EventBus();
  });

  afterEach(() => vi.useRealTimers());

  it('renders entries that arrive through the queue', () => {
    createNarrativePanel(bus);
    bus.emit('narrative:entry', { voice: 'Observer', text: 'the tide turned' });
    vi.advanceTimersByTime(300);

    const scroll = doc.getElementById('narrative-panel').querySelector('#narrative-scroll');
    expect(scroll.textContent).toContain('the tide turned');
  });

  it('shows a count on every chip and disables the empty ones', () => {
    createNarrativePanel(bus);
    bus.emit('narrative:entry', { voice: 'Observer', text: 'a' });
    vi.advanceTimersByTime(300);

    const chips = doc.getElementById('narrative-panel').querySelectorAll('.narrative-chip');
    const byVoice = Object.fromEntries(chips.map((c) => [c.dataset.voice, c]));
    expect(byVoice.ALL.textContent).toBe('ALL 1');
    expect(byVoice.Observer.textContent).toBe('OBSERVER 1');
    expect(byVoice.Stabilizer.disabled).toBe(true);
  });

  it('filters the whole ring, including entries that predate the filter', () => {
    createNarrativePanel(bus);
    bus.emit('narrative:entry', { voice: 'Observer', text: 'keep me' });
    bus.emit('narrative:entry', { voice: 'Diverger', text: 'hide me' });
    vi.advanceTimersByTime(300);

    const panel = doc.getElementById('narrative-panel');
    const observerChip = panel.querySelectorAll('.narrative-chip').find((c) => c.dataset.voice === 'Observer');
    observerChip.dispatch('click', {});

    const scroll = panel.querySelector('#narrative-scroll');
    expect(scroll.textContent).toContain('keep me');
    expect(scroll.textContent).not.toContain('hide me');
    // The chips re-render on every change, so the marked one is a fresh node.
    const active = panel.querySelector('.narrative-chip.active');
    expect(active.dataset.voice).toBe('Observer');
  });

  it('marks the view paused when you scroll away, and follows again at the top', () => {
    createNarrativePanel(bus);
    const panel = doc.getElementById('narrative-panel');
    const scroll = panel.querySelector('#narrative-scroll');
    const pin = panel.querySelector('#narrative-pin');
    expect(pin.textContent).toBe('FOLLOWING');

    scroll.scrollTop = 400;
    scroll.dispatch('scroll', {});
    expect(pin.textContent).toBe('HOLD');
    expect(pin.classList.contains('paused')).toBe(true);

    scroll.scrollTop = 0;
    scroll.dispatch('scroll', {});
    expect(pin.textContent).toBe('FOLLOWING');
  });

  it('clears the current view but retains searchable history', () => {
    createNarrativePanel(bus);
    bus.emit('narrative:entry', { voice: 'Observer', text: 'reef survived' });
    vi.advanceTimersByTime(300);

    const panel = doc.getElementById('narrative-panel');
    panel.querySelector('#narrative-clear-btn').dispatch('click', {});
    expect(panel.querySelector('#narrative-scroll').textContent).toBe('');

    const search = panel.querySelector('#narrative-search');
    search.value = 'reef survived';
    search.dispatch('input', {});
    expect(panel.querySelector('#narrative-scroll').textContent).toContain('reef survived');
    expect(panel.querySelector('.narrative-chip.active').dataset.voice).toBe('ALL');
  });

  it('searches retained text independently of voice and event-type filters', () => {
    createNarrativePanel(bus);
    bus.emit('narrative:entry', { voice: 'Observer', text: 'the reef changed' });
    bus.emit('narrative:system', { text: 'the tide changed' });
    vi.advanceTimersByTime(300);

    const panel = doc.getElementById('narrative-panel');
    const search = panel.querySelector('#narrative-search');
    search.value = 'reef';
    search.dispatch('input', {});
    expect(panel.querySelector('#narrative-scroll').textContent).toContain('reef changed');
    expect(panel.querySelector('#narrative-scroll').textContent).not.toContain('tide changed');
    expect(panel.querySelectorAll('.narrative-type-chip').some((chip) => chip.dataset.type === 'narrative')).toBe(true);
  });

  it('holds position, counts new items, and resumes on demand', () => {
    createNarrativePanel(bus);
    const panel = doc.getElementById('narrative-panel');
    panel.querySelector('#narrative-pin').dispatch('click', {});
    bus.emit('narrative:entry', { voice: 'Observer', text: 'new while held' });
    vi.advanceTimersByTime(300);

    expect(panel.querySelector('#narrative-pin').textContent).toBe('HOLD · 1 NEW');
    const resume = panel.querySelector('#narrative-resume');
    expect(resume.hidden).toBe(false);
    resume.dispatch('click', {});
    expect(panel.querySelector('#narrative-pin').textContent).toBe('FOLLOWING');
    expect(resume.hidden).toBe(true);
  });

  it('restores history and does not duplicate listeners when recreated on the same bus', () => {
    createNarrativePanel(bus);
    bus.emit('narrative:entry', { voice: 'Observer', text: 'remembered current' });
    vi.advanceTimersByTime(300);

    createNarrativePanel(bus);
    expect(doc.getElementById('narrative-panel').querySelector('#narrative-scroll').textContent).toContain('remembered current');
    expect(bus.listeners['narrative:entry']).toHaveLength(1);
    expect(bus.listeners['narrative:system']).toHaveLength(1);
    expect(bus.listeners['narrative:batch']).toHaveLength(1);

    bus.emit('narrative:entry', { voice: 'Observer', text: 'only once' });
    vi.advanceTimersByTime(300);
    const saved = JSON.parse(localStorage.getItem('vepa4-narrative-history'));
    expect(saved.filter((entry) => entry.text === 'only once')).toHaveLength(1);
    expect(doc.getElementById('narrative-panel').querySelector('#narrative-scroll').textContent.match(/only once/g)).toHaveLength(1);
  });
});
