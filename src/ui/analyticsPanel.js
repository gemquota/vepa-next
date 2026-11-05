// ============================================================================
// VEPA4 — Analytics panel shell
//
// The intelligence dashboards (ECO, CIVILIZATIONS, DNA ANALYTICS, …) all had
// the same shape: mount a container, render an `intel-grid` of label/value
// cells, subscribe to a bus event, throttle redraws to ~2 Hz, and write values
// into the cells. Only the metrics and the canvas drawing actually differ, and
// those are the parts that should stay bespoke.
//
// This module owns the shell. Panels supply their cells and a draw function.
//
// See docs/CODEBASE-AUDIT-2026-09-30.md §2.2 (P-4).
// ============================================================================

import { escapeHtml as esc } from './html.js';

/** Default redraw throttle for analytics panels (~2 Hz). */
export const PANEL_THROTTLE_MS = 500;


/**
 * Write a value into an intel-value cell inside `host`. Null-safe.
 * Exported so panels that need extra controls (and so cannot adopt the full
 * shell) still share the setter.
 */
export function setCellValue(host, id, text) {
  const el = host && host.querySelector('#' + id);
  if (el) el.textContent = String(text);
}

/**
 * Mount an analytics panel shell.
 *
 * @param {EventBus} bus
 * @param {object} opts
 * @param {string} opts.mountId       element id of the dashboard container
 * @param {string} opts.title         header text (e.g. 'ECOSYSTEM')
 * @param {Array<{id: string, label: string, value?: string}>} opts.cells
 *        label/value cells rendered in the intel-grid
 * @param {Array<{id: string, w: number, h: number, className?: string}>} [opts.canvases]
 *        canvas surfaces to create below the grid
 * @param {string[]} [opts.logs]      element ids for extra `intel-log` regions
 * @param {(bus: EventBus, deliver: (payload: any) => void) => void} opts.subscribe
 *        wires the panel to its bus event, calling `deliver(payload)` on each
 *        event; the shell applies the throttle before `deliver`
 * @param {(ctx: {host: HTMLElement, setVal: (id: string, v: any) => void}) => void} opts.draw
 *        called on each (throttled) payload; use `ctx.setVal` to write cells
 * @param {number} [opts.throttleMs]
 * @returns {{host: HTMLElement, setVal: Function} | null} null if the mount
 *   element is absent
 */
export function mountAnalyticsPanel(bus, opts) {
  const {
    mountId,
    title,
    cells = [],
    canvases = [],
    logs = [],
    subscribe,
    draw,
    throttleMs = PANEL_THROTTLE_MS,
  } = opts;

  const target = document.getElementById(mountId);
  if (!target) return null;
  const host = target;

  const cellHtml = cells
    .map((c) => `<div class="intel-cell"><span class="intel-label">${esc(c.label)}</span>`
      + `<span id="${esc(c.id)}" class="intel-value">${esc(c.value ?? 0)}</span></div>`)
    .join('\n    ');

  const canvasHtml = canvases
    .map((c) => `<canvas id="${esc(c.id)}" class="${esc(c.className || 'ga-canvas')}" `
      + `width="${c.w}" height="${c.h}"></canvas>`)
    .join('\n    ');

  const logHtml = logs
    .map((id) => `<div id="${esc(id)}" class="intel-log"></div>`)
    .join('\n    ');

  host.innerHTML = `
    <div class="intel-header">${esc(title)}</div>
    <div class="intel-grid">
    ${cellHtml}
    </div>
    ${canvasHtml}
    ${logHtml}
  `;

  const setVal = (id, text) => setCellValue(host, id, text);

  const ctx = { host, setVal };

  // Seeded negative-infinity, not 0: `performance.now()` is also relative to
  // process/page start, so a literal 0 made the shell compare `now - 0` against
  // the throttle and swallow every payload that arrived in the first 500 ms of
  // the page's life. The first payload a panel receives is always drawn.
  let lastDraw = -Infinity;
  subscribe(bus, (payload) => {
    const now = performance.now();
    if (now - lastDraw < throttleMs) return;
    lastDraw = now;
    draw(ctx, payload);
  });

  return ctx;
}
