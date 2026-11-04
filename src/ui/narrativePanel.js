/**
 * VEPA4 — Narrative / Log Panel (DATA > 📜 LOGS)
 *
 * Scrollback for everything the world says about itself. Entries render newest
 * first and the view follows the newest entry until you scroll away from it,
 * at which point it stops yanking you back and keeps your reading position.
 *
 * New in v9.1.29:
 *
 *  - **Batched.** Entries arrive through `narrative:batch`, produced by
 *    `src/core/logQueue.js`. The panel used to build one node per
 *    `narrative:entry`, which on a chatty world meant a layout and a
 *    `scrollHeight` read per line.
 *  - **Filter chips with counts.** Every voice gets a chip that says how many
 *    entries it holds, and a filter that applies retroactively — the log is a
 *    ring of entries, not a wall of DOM.
 *  - **Paused autoscroll.** The pin state is visible rather than inferred.
 */

import { escapeHtml } from './html.js';
import { createLogQueue } from '../core/logQueue.js';

const MAX_ENTRIES = 1000;
const LOG_STORAGE_KEY = 'vepa4-narrative-history';
const DISPLAY_STORAGE_KEY = 'vepa4-narrative-display';
const FOLLOW_STORAGE_KEY = 'vepa4-narrative-follow';
let nextEntryId = 1;

const VOICE_COLORS = {
  Stabilizer: 'var(--accent-blue)',
  Diverger:   'var(--accent-red)',
  Observer:   'var(--accent-green)',
  Dissolver:  'var(--accent-purple)',
};

const DEFAULT_VOICE_COLOR = 'var(--text-secondary)';

/** Chip order. `ALL` is a view, not a voice, so it is prepended at render time. */
const VOICES = ['System', 'Observer', 'Stabilizer', 'Diverger', 'Dissolver'];

/** Entries within this many pixels of the newest are treated as "following". */
const PIN_THRESHOLD_PX = 24;

let container = null;
let chipsEl = null;
let typeChipsEl = null;
let searchEl = null;
let pinEl = null;
let resumeEl = null;
let entries = [];
let activeVoice = 'ALL';
let activeType = 'ALL';
let follow = true;
let newItems = 0;
let clearedThrough = 0;
let queue = null;
let unsubscribeBatch = null;
let unsubscribeScroll = null;
let unsubscribeFilterToggle = null;
let unsubscribeClear = null;
let unsubscribePin = null;
let unsubscribeResume = null;
let unsubscribeSearch = null;

/**
 * The category an entry belongs to.
 *
 * `voice` is the narrator's name; anything unrecognised is filed under SYSTEM
 * rather than dropped, because a log that silently discards entries it does
 * not recognise is worse than one that labels them badly.
 */
export function entryCategory(entry) {
  const voice = (entry && entry.voice) || 'System';
  return VOICES.includes(voice) ? voice : 'System';
}

/** How many entries each chip should show. */
export function categoryCounts(list) {
  const counts = { ALL: (list || []).length };
  for (const voice of VOICES) counts[voice] = 0;
  for (const entry of list || []) counts[entryCategory(entry)] += 1;
  return counts;
}

function scrollToNewest() {
  if (container) container.scrollTop = 0;
}

function eventCategory(entry) {
  return entry.eventType || entry.type || (entry.voice && entry.voice !== 'System' ? 'narrative' : 'system');
}

function loadEntries() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(LOG_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const valid = saved.filter((entry) => entry && typeof entry.text === 'string').slice(-MAX_ENTRIES);
    nextEntryId = valid.reduce((next, entry) => Math.max(next, (entry.id || 0) + 1), 1);
    return valid.map((entry) => ({ ...entry, id: entry.id || nextEntryId++ }));
  } catch { return []; }
}

function persistEntries() {
  try { globalThis.localStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify(entries)); } catch { /* Storage can be unavailable or full. */ }
}

function persistViewState() {
  try {
    globalThis.localStorage?.setItem(DISPLAY_STORAGE_KEY, String(clearedThrough));
    globalThis.localStorage?.setItem(FOLLOW_STORAGE_KEY, follow ? '1' : '0');
  } catch { /* Storage can be unavailable or full. */ }
}

function renderChips() {
  if (!chipsEl) return;
  const visibleHistory = entries.filter((entry) => entry.id > clearedThrough || (searchEl && searchEl.value.trim()));
  const counts = categoryCounts(visibleHistory);
  const chips = ['ALL', ...VOICES];
  chipsEl.innerHTML = chips.map((voice) => {
    const on = voice === activeVoice;
    const n = counts[voice] || 0;
    return `<button class="narrative-chip${on ? ' active' : ''}" data-voice="${voice}"`
      + ` aria-pressed="${on ? 'true' : 'false'}"`
      + `${n ? '' : ' disabled'}>${voice.toUpperCase()} ${n}</button>`;
  }).join('');
  for (const btn of chipsEl.querySelectorAll('.narrative-chip')) {
    btn.addEventListener('click', () => {
      activeVoice = btn.dataset.voice;
      render();
    });
  }
  if (typeChipsEl) {
    const types = [...new Set(visibleHistory.map(eventCategory))].sort();
    const options = ['ALL', ...types];
    typeChipsEl.innerHTML = options.map((type) => {
      const active = type === activeType;
      const count = type === 'ALL' ? visibleHistory.length : visibleHistory.filter((entry) => eventCategory(entry) === type).length;
      return `<button class="narrative-type-chip${active ? ' active' : ''}" data-type="${escapeHtml(type)}" aria-pressed="${active}">${escapeHtml(type.toUpperCase())} ${count}</button>`;
    }).join('');
    for (const btn of typeChipsEl.querySelectorAll('.narrative-type-chip')) {
      btn.addEventListener('click', () => { activeType = btn.dataset.type; render(); });
    }
  }
}

function render() {
  if (!container) return;
  const query = searchEl ? searchEl.value.trim().toLocaleLowerCase() : '';
  const visible = entries.filter((entry) => {
    const retainedByClear = entry.id > clearedThrough || !!query;
    return retainedByClear
      && (activeVoice === 'ALL' || entryCategory(entry) === activeVoice)
      && (activeType === 'ALL' || eventCategory(entry) === activeType)
      && (!query || `${entry.voice || 'System'} ${eventCategory(entry)} ${entry.text}`.toLocaleLowerCase().includes(query));
  }).slice().reverse();
  container.innerHTML = visible.map((entry) => {
    const voice = entry.voice || 'System';
    const color = VOICE_COLORS[voice] || DEFAULT_VOICE_COLOR;
    const ts = entry.timestamp
      ? new Date(entry.timestamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();
    return `<div class="narrative-entry">`
      + `<span class="narrative-voice" style="color:${color}">[${escapeHtml(voice)}]</span> `
      + `<span class="narrative-time">${ts}</span> `
      + `<span class="narrative-text">${escapeHtml(entry.text || '')}</span>`
      + `</div>`;
  }).join('');

  if (follow) scrollToNewest();
  renderChips();
  if (pinEl) {
    pinEl.textContent = follow ? 'FOLLOWING' : (newItems ? `HOLD · ${newItems} NEW` : 'HOLD');
    pinEl.setAttribute('aria-pressed', follow ? 'true' : 'false');
    pinEl.classList.toggle('paused', !follow);
  }
  if (resumeEl) resumeEl.hidden = follow || newItems === 0;
}

/**
 * Add a batch of entries to the ring and redraw.
 *
 * @param {Array<{voice?: string, text: string, timestamp?: number}>} batch
 */
export function pushEntries(batch) {
  if (!Array.isArray(batch) || !batch.length) return;
  const additions = batch.map((entry) => ({ ...entry, id: entry.id || nextEntryId++ }));
  entries = entries.concat(additions).slice(-MAX_ENTRIES);
  if (!follow) newItems += additions.length;
  persistEntries();
  render();
}

/**
 * Create the narrative panel in #narrative-panel.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 */
export function createNarrativePanel(bus) {
  const panel = document.getElementById('narrative-panel');
  if (!panel) return null;

  queue?.stop();
  unsubscribeBatch?.();
  unsubscribeScroll?.();
  unsubscribeFilterToggle?.();
  unsubscribeClear?.();
  unsubscribePin?.();
  unsubscribeResume?.();
  unsubscribeSearch?.();
  queue = null;
  unsubscribeBatch = null;
  unsubscribeScroll = null;

  panel.innerHTML = `
    <div class="narrative-header">
      <span class="narrative-title">Narrative Log</span>
      <div class="narrative-actions">
        <button id="narrative-pin" class="narrative-pin" type="button" aria-pressed="true">FOLLOWING</button>
        <button id="narrative-resume" class="narrative-resume" type="button" hidden>RESUME</button>
        <button id="narrative-clear-btn" class="narrative-clear-btn" title="Clear the current view; history remains searchable">CLEAR VIEW</button>
      </div>
    </div>
    <div class="narrative-controls">
      <label for="narrative-search">SEARCH</label>
      <input id="narrative-search" type="search" placeholder="Search retained history" autocomplete="off">
      <button id="narrative-filter-toggle" type="button" aria-expanded="false">FILTER</button>
    </div>
    <div id="narrative-filter-panel" class="narrative-filter-panel" hidden>
      <div id="narrative-chips" class="narrative-chips" aria-label="Filter by voice"></div>
      <div id="narrative-type-chips" class="narrative-chips" aria-label="Filter by event type"></div>
    </div>
    <div id="narrative-scroll" class="narrative-scroll"></div>
  `;

  container = document.getElementById('narrative-scroll');
  chipsEl = document.getElementById('narrative-chips');
  typeChipsEl = document.getElementById('narrative-type-chips');
  searchEl = document.getElementById('narrative-search');
  pinEl = document.getElementById('narrative-pin');
  resumeEl = document.getElementById('narrative-resume');
  entries = loadEntries();
  activeVoice = 'ALL';
  activeType = 'ALL';
  try {
    clearedThrough = Number(globalThis.localStorage?.getItem(DISPLAY_STORAGE_KEY)) || 0;
    follow = globalThis.localStorage?.getItem(FOLLOW_STORAGE_KEY) !== '0';
  } catch { clearedThrough = 0; follow = true; }
  newItems = 0;

  const filterToggle = document.getElementById('narrative-filter-toggle');
  const clearButton = document.getElementById('narrative-clear-btn');
  unsubscribeSearch = null;
  if (searchEl) {
    const onSearch = () => render();
    searchEl.addEventListener('input', onSearch);
    unsubscribeSearch = () => searchEl?.removeEventListener('input', onSearch);
  }
  unsubscribeFilterToggle = null;
  if (filterToggle) {
    const onFilterToggle = (event) => {
      const button = event.currentTarget;
      const panelEl = document.getElementById('narrative-filter-panel');
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panelEl.hidden = !expanded;
    };
    filterToggle.addEventListener('click', onFilterToggle);
    unsubscribeFilterToggle = () => filterToggle.removeEventListener('click', onFilterToggle);
  }
  unsubscribeClear = null;
  if (clearButton) {
    const onClear = () => {
      clearedThrough = nextEntryId - 1;
      activeVoice = 'ALL';
      activeType = 'ALL';
      if (searchEl) searchEl.value = '';
      persistViewState();
      render();
    };
    clearButton.addEventListener('click', onClear);
    unsubscribeClear = () => clearButton.removeEventListener('click', onClear);
  }
  unsubscribePin = null;
  if (pinEl) {
    const onPin = () => {
      follow = !follow;
      if (follow) { newItems = 0; scrollToNewest(); }
      persistViewState();
      render();
    };
    pinEl.addEventListener('click', onPin);
    unsubscribePin = () => pinEl.removeEventListener('click', onPin);
  }
  unsubscribeResume = null;
  if (resumeEl) {
    const onResume = () => {
      follow = true;
      newItems = 0;
      scrollToNewest();
      persistViewState();
      render();
    };
    resumeEl.addEventListener('click', onResume);
    unsubscribeResume = () => resumeEl.removeEventListener('click', onResume);
  }

  // Scrolling away from the newest entry stops the panel dragging you back.
  const onScroll = () => {
    const nowFollowing = container.scrollTop <= PIN_THRESHOLD_PX;
    if (nowFollowing !== follow) {
      follow = nowFollowing;
      if (follow) newItems = 0;
      persistViewState();
      render();
    }
  };
  container.addEventListener('scroll', onScroll);
  unsubscribeScroll = () => container?.removeEventListener('scroll', onScroll);

  // The queue is the only producer of `narrative:batch`, and this panel is its
  // only consumer, so both live here rather than in main.js's wiring.
  const panelQueue = createLogQueue(bus);
  queue = panelQueue;
  unsubscribeBatch = bus.on('narrative:batch', pushEntries);

  render();
  return { flush: () => panelQueue.flush(), pending: () => panelQueue.pending() };
}
