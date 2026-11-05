/** Legacy SETTINGS law surface; uses the same staged commands as LAWS. */
import { LAW_INDEXES, LAW_CATEGORIES } from '../constants.js';
import { isSet } from '../state/lawState.js';

const NAMES = new Map(Object.entries(LAW_INDEXES).map(([name, index]) => [index, name]));

export function createLawPanel(bus, lawStateObj) {
  const panel = document.getElementById('laws-panel');
  if (!panel) return;
  let pending = new Map();
  let html = '<p>Law edits are staged until restart. Review or discard them in LAWS. WRAP uses WORLD TOROIDAL.</p>';
  for (const [name, category] of Object.entries(LAW_CATEGORIES)) {
    html += `<div class="panel-section"><h3 class="law-category-header">${name}</h3><div class="law-grid">`;
    for (const idx of category.laws) {
      html += `<button type="button" class="law-btn" data-law="${idx}">${NAMES.get(idx)}</button>`;
    }
    html += '</div></div>';
  }
  panel.insertAdjacentHTML('beforeend', html);
  const refresh = () => {
    for (const btn of panel.querySelectorAll('.law-btn')) {
      const idx = Number(btn.dataset.law);
      const active = pending.get(idx) ?? isSet(lawStateObj, idx);
      btn.classList.toggle('active', active);
      btn.classList.toggle('pending-law', pending.has(idx));
      btn.setAttribute('aria-pressed', String(active));
      btn.title = `${NAMES.get(idx)}${pending.has(idx) ? ' — pending restart' : ''}`;
      btn.disabled = idx === LAW_INDEXES.WRAP;
    }
  };
  for (const btn of panel.querySelectorAll('.law-btn')) {
    const lawIndex = Number(btn.dataset.law);
    btn.addEventListener('click', () => {
      if (lawIndex === LAW_INDEXES.WRAP) return;
      bus.emit('law:editRequested', { changes: [{ lawIndex, active: !(pending.get(lawIndex) ?? isSet(lawStateObj, lawIndex)) }] });
    });
  }
  bus.on('law:pending', ({ changes }) => {
    pending = new Map(changes.map(({ lawIndex, active }) => [lawIndex, active]));
    refresh();
  });
  bus.on('law:sync', refresh);
  refresh();
  bus.emit('law:pendingRequested');
  window.toggleLaw = (idx) => panel.querySelector(`[data-law="${idx}"]`)?.click();
}
