/**
 * VEPA4 — Long-press help overlay for tabs, graphs and analytics cells.
 *
 * One delegated gesture serves two surfaces, because the two kinds of "what is
 * this?" answer different questions:
 *
 *   - A tab or sub-tab opens a MODAL. Tabs carry whole subsystems with several
 *     interacting parts; a tooltip the width of a 28px emoji cannot hold that,
 *     and a modal can be read at leisure without losing your place.
 *   - A graph or analytics cell shows a TOOLTIP anchored to the thing itself.
 *     You are looking *at* the graph while asking about it, so the answer has
 *     to sit next to it and then get out of the way.
 *
 * Gesture contract (matches the existing long-press idiom in paramHelp.js and
 * multiplexHelp.js — 500ms, cancelled by movement):
 *
 *   pointerdown → wait LONG_PRESS_MS → surface shown
 *   move > MOVE_TOLERANCE px → cancel (so a scroll or a drag never misfires)
 *   release → tooltip stays until dismissed; modal stays until closed
 *   right-click → same help, immediately
 *
 * The press is *not* swallowed for tabs: a long-press that turns into a help
 * modal must not also switch tabs behind the modal, so the synthetic click is
 * suppressed — but only when a help surface actually opened.
 *
 * Clicking the overlay backdrop, pressing Escape, or clicking ✕ closes it. The
 * modal also carries a switcher — arrows at each end and a square per top-level
 * tab — so a reader can move between tabs without closing anything, and the tab
 * currently open is expanded to show its title. All listeners are registered
 * once at init and are idempotent.
 */

import { helpForTab, helpForGraph, subtabsForTab, tabSwitcher, cycleTabId, owningTabId, TAB_SUBTABS, TAB_ORDER } from './helpRegistry.js';
import { registerTooltip } from './tooltipDismiss.js';
import { escapeHtml as esc } from './html.js';

/** Hold duration that counts as a long press. */
export const HELP_LONG_PRESS_MS = 500;
/** Movement in px that cancels a pending long press. */
export const HELP_MOVE_TOLERANCE = 10;
/** Delay before an unfocused tooltip dismisses itself. */
export const HELP_TOOLTIP_LINGER_MS = 1600;

let modalEl = null;
let tooltipEl = null;
let initialised = false;
let pressTimer = null;
let pressX = 0;
let pressY = 0;
let suppressNextClick = false;
let lingerTimer = null;
let unregisterTooltip = null;


function sectionHtml(entry) {
  if (!entry.sections || !entry.sections.length) return '';
  return entry.sections
    .map(([label, body]) => (
      `<div class="help-drone-section"><strong>${esc(label)}</strong><span>${esc(body)}</span></div>`
    ))
    .join('');
}

/**
 * Resolve what a pointer hit means for help purposes.
 * Tabs win over graphs: a sub-tab button is not inside a chart.
 */
function resolve(target) {
  if (!target || !target.closest) return null;
  const tabBtn = target.closest('#main-panel .tab-btn[data-tab]');
  if (tabBtn) {
    const entry = helpForTab(tabBtn.dataset.tab);
    return entry ? { entry, surface: 'modal', target: tabBtn, id: tabBtn.dataset.tab } : null;
  }
  const subTabBtn = target.closest('#main-panel .sub-tab-btn[data-sub]');
  if (subTabBtn) {
    const entry = helpForTab(subTabBtn.dataset.sub);
    return entry
      ? { entry, surface: 'modal', target: subTabBtn, scope: 'subtab', id: subTabBtn.dataset.sub }
      : null;
  }
  const graph = helpForGraph(target);
  // Anchor the tooltip to the element the help is about, not to whatever
  // child of it happened to be under the pointer.
  const anchor = graph && graph.scope === 'cell'
    ? (target.closest('.intel-cell') || target)
    : (target.closest('canvas') || target.closest('.chart-section') || target);
  return graph ? { entry: graph, surface: 'tooltip', target: anchor } : null;
}

/* ── Modal ────────────────────────────────────────────────────────────── */

/** Close the help modal if one is open. */
export function closeHelpModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
    document.removeEventListener('keydown', onModalKey);
  }
}

/** True when a help modal is currently open. */
export function isHelpModalOpen() {
  return modalEl !== null;
}

function onModalKey(event) {
  if (event.key === 'Escape') { closeHelpModal(); return; }
  // Arrows cycle the modal from the keyboard too, so the switcher is not a
  // touch-and-mouse-only affordance.
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  // Never steal the arrow keys from a control that is actually using them.
  const active = document.activeElement;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
  const el = modalEl;
  if (!el) return;
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const current = el.querySelector('.tab-switch-btn.current');
  event.preventDefault();
  const nextId = cycleTabId(current ? current.dataset.helpId : TAB_ORDER[0], step);
  const next = helpForTab(nextId);
  if (next) showHelpModal(next, { id: nextId, scope: 'tab' });
}

/**
 * The strip that switches between the three top-level tab help modals.
 *
 * A modal you can only leave by closing is a dead end, and a phone gives you
 * very little room to leave one by accident. So the switcher is always visible:
 * an arrow at each end cycles through the tabs, the other tabs' icons sit in
 * squares you can tap directly, and the tab you are actually reading is
 * expanded so it spells out its title. The expanded entry is the answer to
 * "which of these three am I looking at?" without reading the body.
 *
 * Arrows exist in addition to the squares rather than instead of them: cycling
 * three items is one gesture, but hunting for a specific icon is faster than
 * three taps on a small screen, and both cost nothing here.
 */
function switcherHtml(currentId) {
  const items = tabSwitcher(currentId);
  if (items.length < 2) return '';
  const squares = items
    .map((item) => {
      const cls = `tab-switch-btn${item.current ? ' current' : ''}${item.own ? ' own' : ''}`;
      const label = item.own ? `Back to ${item.title}` : item.title;
      return `<button type="button" class="${cls}" data-help-id="${esc(item.id)}"`
        + ` aria-pressed="${item.current ? 'true' : 'false'}"`
        + ` aria-label="${esc(label)}" title="${esc(label)}">`
        + `<span class="tab-switch-icon" aria-hidden="true">${esc(item.icon || '•')}</span>`
        + `<span class="tab-switch-label">${esc(item.title)}</span>`
        + '</button>';
    })
    .join('');
  return `<nav class="tab-switch" aria-label="Switch tab help">`
    + '<button type="button" class="tab-switch-arrow" data-help-step="-1" aria-label="Previous tab help">&#x25C0;</button>'
    + `<span class="tab-switch-squares">${squares}</span>`
    + '<button type="button" class="tab-switch-arrow" data-help-step="1" aria-label="Next tab help">&#x25B6;</button>'
    + '</nav>';
}

/**
 * Buttons that drill from a tab's help into one of its sub-tabs.
 *
 * A tab modal that only explains the tab is a dead end: the reader now knows
 * what SETUP is for but still have to close the modal and hunt for the button.
 * These route straight there, and the sub-tab view offers a way back up.
 */
function navHtml(currentId) {
  const isSub = Object.prototype.hasOwnProperty.call(TAB_SUBTABS, currentId);
  const parentId = isSub
    ? Object.keys(TAB_SUBTABS).find((t) => TAB_SUBTABS[t].includes(currentId))
    : currentId;
  const siblings = parentId ? subtabsForTab(parentId) : [];
  const crumbs = [];
  if (parentId) {
    const parent = helpForTab(parentId);
    if (parent) {
      crumbs.push({ id: parentId, label: `${parent.icon || ''} ${parent.title}`.trim(), current: parentId === currentId });
    }
  }
  for (const id of siblings) {
    const child = helpForTab(id);
    if (!child) continue;
    crumbs.push({ id, label: `${child.icon || ''} ${child.title}`.trim(), current: id === currentId });
  }
  if (crumbs.length <= 1) return '';
  return `<nav class="tab-help-nav" aria-label="Jump to a sub-tab">${crumbs
    .map((c) => `<button type="button" class="tab-help-nav-btn${c.current ? ' current' : ''}" data-help-id="${esc(c.id)}"${c.current ? ' aria-current="true"' : ''}>${esc(c.label)}</button>`)
    .join('')}</nav>`;
}

/**
 * Show a help modal for a tab or sub-tab.
 * @param {{title:string, icon?:string, summary:string, sections:Array}} entry
 * @param {{scope?:string, id?:string}} [meta] `id` enables sub-tab navigation
 */
export function showHelpModal(entry, meta = {}) {
  if (!entry) return null;
  closeHelpModal();
  hideHelpTooltip();

  const el = document.createElement('div');
  el.id = 'tab-help-overlay';
  // Reuses the help-drone shell so long-press help and the drone's own map
  // are visually one system rather than two competing ones.
  el.className = 'help-drone-overlay tab-help-overlay';
  const where = meta.scope === 'subtab' ? 'SUB-TAB' : 'TAB';
  const id = meta.id || '';
  el.innerHTML = `
    <section class="help-drone-panel" role="dialog" aria-modal="true" aria-labelledby="tab-help-title">
      <header class="help-drone-header">
        <div><span class="help-drone-signal">◉</span>
          <span id="tab-help-title">${esc(entry.icon || '')} ${esc(entry.title)}</span></div>
        <button class="help-drone-close" type="button" aria-label="Dismiss help">×</button>
      </header>
      <div class="help-drone-body">
        <span class="tab-help-kind">${esc(where)}</span>
        ${switcherHtml(id)}
        ${navHtml(id)}
        <p class="help-drone-lead">${esc(entry.summary)}</p>
        <div class="help-drone-mapping tab-help-sections">${sectionHtml(entry)}</div>
        <div class="help-drone-footer">VEPA4 · long-press a graph for its own help</div>
      </div>
    </section>`;
  document.body.appendChild(el);

  el.querySelector('.help-drone-close').addEventListener('click', closeHelpModal);
  el.addEventListener('click', (event) => {
    if (event.target === el) { closeHelpModal(); return; }
    // Re-render in place rather than stacking overlays, so drilling through
    // several sub-tabs — or cycling every tab — leaves exactly one modal on
    // screen.
    const open = (targetId) => {
      const next = helpForTab(targetId);
      if (!next) return;
      showHelpModal(next, {
        id: targetId,
        scope: Object.prototype.hasOwnProperty.call(TAB_SUBTABS, targetId) ? 'tab' : 'subtab',
      });
    };
    const arrow = event.target.closest('.tab-switch-arrow');
    if (arrow) {
      event.preventDefault();
      open(cycleTabId(owningTabId(id), Number(arrow.dataset.helpStep) || 1));
      return;
    }
    const switchBtn = event.target.closest('.tab-switch-btn');
    if (switchBtn) {
      event.preventDefault();
      // Tapping the expanded entry is a no-op rather than a re-render, so the
      // button does not read as broken when it is already the current tab.
      if (switchBtn.classList.contains('current')) return;
      open(switchBtn.dataset.helpId);
      return;
    }
    const navBtn = event.target.closest('.tab-help-nav-btn');
    if (navBtn) open(navBtn.dataset.helpId);
  });
  document.addEventListener('keydown', onModalKey);
  modalEl = el;
  return el;
}

/* ── Tooltip ──────────────────────────────────────────────────────────── */

/** Dismiss the graph tooltip. */
export function hideHelpTooltip() {
  if (lingerTimer) {
    clearTimeout(lingerTimer);
    lingerTimer = null;
  }
  if (unregisterTooltip) {
    unregisterTooltip();
    unregisterTooltip = null;
  }
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

/** True when a graph tooltip is currently shown. */
export function isHelpTooltipVisible() {
  return tooltipEl !== null;
}

/**
 * Show a tooltip anchored to a graph or analytics cell.
 *
 * @param {HTMLElement} target the element to point at
 * @param {{title:string, summary:string, sections:Array, kind?:string}} entry
 * @param {{sticky?:boolean}} [opts] sticky keeps it up until dismissed
 * @returns {HTMLElement|null}
 */
export function showHelpTooltip(target, entry, opts = {}) {
  if (!target || !entry) return null;
  hideHelpTooltip();
  // Anchored to the graph, so pressing the graph again re-opens/refreshes it
  // rather than dismissing it under the pointer; any other press closes it.
  unregisterTooltip = registerTooltip({
    name: 'graph-help',
    anchor: target,
    dismiss: () => hideHelpTooltip(),
  });

  const tip = document.createElement('div');
  tip.className = 'help-drone-tip tab-help-tip';
  tip.setAttribute('role', 'status');
  const sections = sectionHtml(entry);
  tip.innerHTML = `<strong>${esc(entry.title)}</strong>`
    + `<span>${esc(entry.summary)}</span>`
    + (sections ? `<div class="tab-help-tip-sections">${sections}</div>` : '');
  document.body.appendChild(tip);

  const rect = target.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  // Prefer above the element; flip below when there is no room.
  const preferAbove = rect.top > h + 16;
  tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, rect.left))}px`;
  tip.style.top = preferAbove
    ? `${Math.max(8, rect.top - h - 10)}px`
    : `${Math.min(window.innerHeight - h - 8, rect.bottom + 10)}px`;

  if (!opts.sticky) {
    lingerTimer = setTimeout(hideHelpTooltip, HELP_TOOLTIP_LINGER_MS);
  }
  tooltipEl = tip;
  return tip;
}

/* ── Wiring ───────────────────────────────────────────────────────────── */

function cancelPendingPress() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}

/**
 * Wire the long-press help gesture across the whole document.
 *
 * Delegated, so graphs and cells created later (every analytics panel builds
 * its DOM at mount time) are covered without being re-registered. Safe to call
 * more than once.
 */
export function initHelpLongPress(root = document.body) {
  if (initialised || !root) return false;
  initialised = true;

  root.addEventListener('pointerdown', (event) => {
    // Right-click is handled by its own event below.
    if (event.button === 2) return;
    cancelPendingPress();
    const hit = resolve(event.target);
    if (!hit) return;
    pressX = event.clientX;
    pressY = event.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      suppressNextClick = true;
      if (hit.surface === 'modal') showHelpModal(hit.entry, { scope: hit.scope || 'tab', id: hit.id });
      else showHelpTooltip(hit.target, hit.entry);
    }, HELP_LONG_PRESS_MS);
  });

  root.addEventListener('pointermove', (event) => {
    if (!pressTimer) return;
    const dx = event.clientX - pressX;
    const dy = event.clientY - pressY;
    if (dx * dx + dy * dy > HELP_MOVE_TOLERANCE * HELP_MOVE_TOLERANCE) cancelPendingPress();
  });

  for (const type of ['pointerup', 'pointercancel']) {
    root.addEventListener(type, cancelPendingPress);
  }

  // A long-press that opened help must not also perform the tap action, or the
  // tab switches out from under the modal that is explaining it.
  root.addEventListener('click', (event) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  // Right-click gives the same help immediately, matching paramHelp.js so the
  // two help surfaces are learnable as one gesture.
  root.addEventListener('contextmenu', (event) => {
    const hit = resolve(event.target);
    if (!hit) return;
    event.preventDefault();
    cancelPendingPress();
    if (hit.surface === 'modal') showHelpModal(hit.entry, { scope: hit.scope || 'tab', id: hit.id });
    else showHelpTooltip(hit.target, hit.entry, { sticky: true });
  });

  document.addEventListener('scroll', hideHelpTooltip, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideHelpTooltip();
  });

  return true;
}

/** Test seam: whether initHelpLongPress has already run. */
export function isHelpLongPressInitialised() {
  return initialised;
}