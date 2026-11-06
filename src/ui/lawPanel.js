/** Legacy SETTINGS law surface; uses the same staged commands as LAWS. */
import { LAW_INDEXES, LAW_CATEGORIES } from '../constants.js';
import { isSet } from '../state/lawState.js';
import { getLawExecutionStatus, isLawExecutable } from '../state/lawOntology.js';

const NAMES = new Map(Object.entries(LAW_INDEXES).map(([name, index]) => [index, name]));

export function createLawPanel(bus, lawStateObj) {
  const panel = document.getElementById('laws-panel');
  if (!panel) return;
  let pending = new Map();
  let html = '<p>Law edits are staged until restart. Review or discard them in LAWS. WRAP uses WORLD TOROIDAL.</p>';
  for (const [name, category] of Object.entries(LAW_CATEGORIES)) {
    html += `<div class="panel-section"><h3 class="law-category-header">${name}</h3><div class="law-grid">`;
    for (const idx of category.laws) {
      const name = NAMES.get(idx);
      const executable = isLawExecutable(name);
      const status = getLawExecutionStatus(name);
      html += `<button type="button" class="law-btn${executable ? '' : ' metadata-only'}" data-law="${idx}"${executable ? '' : ' disabled aria-disabled="true"'}>${name}${executable ? '' : ' · META'}</button>`;
    }
    html += '</div></div>';
  }
  panel.insertAdjacentHTML('beforeend', html);
  const refresh = () => {
    for (const btn of panel.querySelectorAll('.law-btn')) {
      const idx = Number(btn.dataset.law);
      const executable = isLawExecutable(NAMES.get(idx));
      const active = executable && (pending.get(idx) ?? isSet(lawStateObj, idx));
      btn.classList.toggle('active', active);
      btn.classList.toggle('pending-law', pending.has(idx));
      btn.setAttribute('aria-pressed', String(active));
      btn.title = executable ? `${NAMES.get(idx)}${pending.has(idx) ? ' — pending restart' : ''}` : `${NAMES.get(idx)} — metadata-only; no solver dispatch`;
      btn.disabled = idx === LAW_INDEXES.WRAP || !executable;
    }
  };
  for (const btn of panel.querySelectorAll('.law-btn')) {
    const lawIndex = Number(btn.dataset.law);
    btn.addEventListener('click', () => {
      if (lawIndex === LAW_INDEXES.WRAP || !isLawExecutable(NAMES.get(lawIndex))) return;
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
