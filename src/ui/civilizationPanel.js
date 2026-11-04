/**
 * VEPA4 — Civilization analytics panel
 *
 * Renders the culture / kin / federation / polity ontology produced by
 * src/state/civilization.js. Built entirely on the shared analytics panel
 * shell (src/ui/analyticsPanel.js) — the same abstraction the ECO and
 * CIVILIZATIONS dashboards use, so there is no per-panel scaffolding left.
 */

import { mountAnalyticsPanel } from './analyticsPanel.js';
import { setCellValue } from './analyticsPanel.js';
import { escapeHtml as esc } from './html.js';

let host = null;
let selection = null;


export function createCivilizationPanel(bus, selectionContext = null) {
  selection = selectionContext;
  const ctx = mountAnalyticsPanel(bus, {
    mountId: 'civilization-dashboard',
    title: 'CIVILIZATION',
    cells: [
      { id: 'civ-cultures', label: 'CULTURES' },
      { id: 'civ-federations', label: 'TRIBES' },
      { id: 'civ-polities', label: 'POLITIES' },
      { id: 'civ-kin', label: 'KIN EDGES' },
      { id: 'civ-structures', label: 'STRUCTURES' },
      { id: 'civ-regime', label: 'REGIME' },
      { id: 'civ-confidence', label: 'CONFIDENCE' },
      { id: 'civ-households', label: 'HOUSEHOLDS' },
      { id: 'civ-citizens', label: 'CITIZENS' },
      { id: 'civ-generations', label: 'FED GEN' },
    ],
    logs: ['civ-detail'],
    subscribe: (b, deliver) => b.on('civilization:analytics', ({ report }) => deliver(report)),
    draw: (c, report) => draw(c, report),
  });
  if (!ctx) return ctx;
  host = ctx.host;

  // The codex used to be one more number in the grid ("1/2"), squeezed into a
  // cell the width of CULTURES, with its statement buried in the detail log.
  // It is the only thing on this panel that says what the world *is*, so it
  // gets its own full-width block with a "last changed" stamp — without one,
  // a stale codex reads exactly like a current one.
  const block = document.createElement('div');
  block.id = 'civ-codex-block';
  block.className = 'civ-codex-block';
  host.appendChild(block);
  return ctx;
}

/**
 * Build the detail-log lines for a civilization report.
 *
 * Split out from `draw` so the formatting can be tested without a DOM. This
 * module previously inlined all of it, and a block-scoped `const` leaked one
 * line past its `if` — a ReferenceError that `node --check` cannot see and
 * that the suite missed because nothing ever called `draw`. Keeping the string
 * building pure means that class of bug now fails a test.
 *
 * @param {object} report a `civilizationReport()` payload plus the sequel
 *   sub-reports (`structures`, `latestRegime`, `codex`)
 * @returns {string[]} HTML fragments, in display order
 */
export function formatCivilizationLines(report) {
  const lines = [];
  const detail = (report && report.detail) || {};

  for (const culture of detail.cultures || []) {
    lines.push(`<div>· ${culture.name || culture.ownerGroupId} — ${culture.symbols} symbols, `
      + `${culture.norms} norms, cohesion ${(culture.cohesion ?? 1).toFixed(2)}, `
      + `${culture.events || 0} transmission event(s)</div>`);
  }
  for (const fed of detail.federations || []) {
    lines.push(`<div>· ${fed.name} (${fed.kind}) — ${fed.members} groups, ${fed.edges} bonds, gen ${fed.generation}</div>`);
  }
  for (const polity of detail.polities || []) {
    lines.push(`<div>· ${polity.name} — ${polity.citizens} citizens, ${polity.provinces} provinces, `
      + `${polity.institutions.length} institution(s), term ${polity.term}, `
      + `${polity.eligible || 0} eligible heir(s), `
      + `stability ${(polity.stability ?? 1).toFixed(2)}, legitimacy ${(polity.legitimacy ?? 0).toFixed(2)}</div>`);
  }
  if (report.households) lines.push(`<div>· ${report.households} households</div>`);

  // Sequel Phases 4-6. Each sub-report is optional: a save written before a
  // phase existed simply omits it, and "not measured yet" must not render as
  // a measured zero.
  const structures = report.structures;
  if (structures) {
    // A kind breakdown is what tells you whether a society built walls or just
    // nests; the bare standing/total counts cannot distinguish the two.
    const kinds = Object.entries(structures.kinds || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${n} ${k.toLowerCase()}`)
      .join(', ');
    lines.push(`<div>· structures — ${structures.standing} standing, ${structures.dormant} dormant, ${structures.collapsed} collapsed`
      + `${kinds ? ` (${kinds})` : ''}</div>`);
  }

  // The codex line is the observer's own statement about the world, rendered
  // with its evidence count so a reader can see how much is actually behind
  // it rather than having to take the regime name on trust.
  const codex = report.codex;
  if (codex) {
    const tag = codex.wellEvidenced ? '' : ' (not enough evidence)';
    lines.push(`<div>· codex — ${esc(codex.statement)}${tag}</div>`);
    lines.push(`<div>· evidence — ${codex.evidence} item(s), confidence ${codex.confidence.toFixed(2)}, `
      + `${codex.asserted} stated / ${codex.admitted} uncertain</div>`);
    // A refusal is surfaced rather than swallowed: silence would read as
    // "nothing to report" when it actually means "the guard declined".
    if (codex.refused) {
      lines.push(`<div>· codex declined to explain — ${esc(codex.refused)}</div>`);
    }
  }

  return lines;
}

/**
 * The codex block's markup.
 *
 * Pure and exported for the same reason `formatCivilizationLines` is: the
 * block that used to be a number has to be testable in full, including the
 * refusal case and the empty case, without a DOM.
 *
 * @param {object|null} codex a `codexReport()` payload
 * @returns {string} an HTML fragment
 */
export function formatCodexBlock(codex) {
  if (!codex) {
    return '<div class="civ-codex-empty">No codex yet — the observer states something once it has '
      + 'measured an era boundary.</div>';
  }
  const stamp = Number.isFinite(codex.tick)
    ? `last changed at tick ${codex.tick}`
    : 'last changed: unknown tick';
  const regime = codex.latest ? `<span class="civ-codex-regime">${esc(codex.latest)}</span>` : '';
  const caveat = codex.wellEvidenced ? '' : ' <em>— not enough evidence</em>';
  const lines = [
    '<div class="civ-codex-head">',
    '<span class="civ-codex-title">CODEX</span>',
    regime,
    `<span class="civ-codex-stamp">${stamp}</span>`,
    '</div>',
    `<div class="civ-codex-statement">${esc(codex.statement)}${caveat}</div>`,
    `<div class="civ-codex-meta">confidence ${codex.confidence.toFixed(2)} · ${codex.evidence} evidence `
      + `item(s) · ${codex.asserted} stated / ${codex.admitted} uncertain${codex.rejected ? ` · ${codex.rejected} declined` : ''}</div>`,
  ];
  // A refusal is surfaced rather than swallowed: silence would read as
  // "nothing to report" when it actually means "the guard declined to say".
  if (codex.refused) {
    lines.push(`<div class="civ-codex-refused">codex declined to explain — ${esc(codex.refused)}</div>`);
  }
  return lines.join('');
}

function draw(ctx, report) {
  host = ctx.host;
  const setVal = ctx.setVal;
  setVal('civ-cultures', report.cultures);
  setVal('civ-federations', report.federations);
  setVal('civ-polities', report.polities);
  setVal('civ-kin', report.kinEdges);

  const structures = report.structures;
  setVal('civ-structures', structures ? `${structures.standing}/${structures.total}` : '—');
  const regime = report.latestRegime;
  setVal('civ-regime', regime ? regime.regime : '—');
  setVal('civ-confidence', regime ? regime.confidence.toFixed(2) : '—');
  setVal('civ-households', report.households ?? '—');
  setVal('civ-citizens', report.citizens ?? '—');
  const gens = (report.detail && report.detail.federations ? report.detail.federations : [])
    .map((f) => f.generation || 0);
  setVal('civ-generations', gens.length ? Math.max(...gens) : '—');

  const block = host.querySelector('#civ-codex-block');
  if (block) block.innerHTML = formatCodexBlock(report.codex || null);

  const log = host.querySelector('#civ-detail');
  if (!log) return;

  const lines = formatCivilizationLines(report);
  log.innerHTML = lines.length ? lines.join('') : '<div>no civilization entities yet</div>';
}

export { setCellValue };
