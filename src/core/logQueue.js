/**
 * VEPA4 — narrative log queue.
 *
 * `narrative:batch` had a listener in the LOGS panel and no producer, for as
 * long as the panel has existed: the batching it was written for never arrived.
 * On a long run that matters — the panel appends one DOM node per entry and
 * reads `scrollHeight` to keep its scroll position, so a world that narrates
 * every few ticks spends real time on layout for text nobody is reading yet.
 *
 * This is the producer, and it lives with the only consumer: pacing a DOM log
 * is a rendering concern, not a simulation one, so the queue belongs to the
 * panel rather than to main.js's event wiring.
 *
 * Entries are flushed whole, in order, either when enough have piled up or when
 * the flush window elapses — whichever comes first. Nothing is dropped and
 * nothing is reordered: this changes when the panel hears about an entry, not
 * what it hears.
 */

/** Flush immediately once this many entries are waiting. */
export const DEFAULT_MAX_PENDING = 24;

/** Longest an entry waits before the panel hears about it. */
export const DEFAULT_FLUSH_MS = 250;

/**
 * @param {import('./eventBus.js').EventBus} bus
 * @param {object} [opts]
 * @param {number} [opts.maxPending]
 * @param {number} [opts.flushMs]
 * @returns {{flush: () => number, pending: () => number, stop: () => void}}
 */
export function createLogQueue(bus, opts = {}) {
  const maxPending = opts.maxPending ?? DEFAULT_MAX_PENDING;
  const flushMs = opts.flushMs ?? DEFAULT_FLUSH_MS;

  let pending = [];
  let timer = null;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending.length) return 0;
    const batch = pending;
    pending = [];
    bus.emit('narrative:batch', batch);
    return batch.length;
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(flush, flushMs);
    // A pending flush must never hold a Node process open in tests or in a
    // headless run; browsers ignore this.
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  function push(entry) {
    if (!entry) return;
    pending.push(entry);
    if (pending.length >= maxPending) {
      flush();
      return;
    }
    schedule();
  }

  // The channels the LOGS panel used to render one node at a time.
  const unsubscribeEntry = bus.on('narrative:entry', push);
  const unsubscribeSystem = bus.on('narrative:system', ({ text, timestamp } = {}) => {
    push({ voice: 'System', text: text || '', timestamp: timestamp || Date.now() });
  });

  return {
    flush,
    pending: () => pending.length,
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      unsubscribeEntry();
      unsubscribeSystem();
      pending = [];
    },
  };
}
