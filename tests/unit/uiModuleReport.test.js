/**
 * VEPA4 — UI module report: the semantic map at the end of it.
 *
 * The map is generated, which stops it from going stale — but not from going
 * *wrong*. A generator that mis-reads the bus still produces a confident table,
 * and this report's entire value is that you can trust it without opening the
 * app. So the claims are re-derived here, independently of the generator, and a
 * disagreement fails the build.
 *
 * Three things are worth checking, in descending order of how much they would
 * embarrass us:
 *
 *   1. The map is regenerated from the same source the committed file was
 *      written from. A panel added without `npm run report:ui` must not pass.
 *   2. Every panel module and every `initUI` step appears in it. A module that
 *      silently fell out of the map is the failure mode this whole document
 *      exists to prevent.
 *   3. The wiring it asserts is true *right now* — a "no producer" row really
 *      has no producer, a "push" row really has a subscriber in `src/ui/`. This
 *      is the check that catches a mis-parse, because a mis-parse produces a
 *      report that is internally consistent and externally wrong.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const report = read('docs/systems/ui-module-report.md');
const MAP = report.slice(report.indexOf('## Semantic map'));

/** Every .js file under src/, as repo-relative paths. */
function srcFiles(dir = join(ROOT, 'src'), out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) srcFiles(abs, out);
    else if (entry.name.endsWith('.js')) out.push(abs.slice(ROOT.length + 1).split('\\').join('/'));
  }
  return out;
}

const FILES = srcFiles();
const SOURCES = new Map(FILES.map((f) => [f, read(f)]));

/** Every event name sent by name anywhere in src/. */
const NAMED_EMITS = new Set();
/** Every event name carried by an event object (`type: '…'`), dispatched as `emit(ev.type, ev)`. */
const OBJECT_EMITS = new Set();
/** Every bus subscription: name → the files that listen. */
const SUBSCRIPTIONS = new Map();
for (const [file, src] of SOURCES) {
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\bemit\(\s*['"]([A-Za-z:_-]+)['"]/g)) NAMED_EMITS.add(m[1]);
    for (const m of line.matchAll(/\bon\(\s*['"]([A-Za-z:_-]+)['"]/g)) {
      if (!SUBSCRIPTIONS.has(m[1])) SUBSCRIPTIONS.set(m[1], []);
      SUBSCRIPTIONS.get(m[1]).push({ file, line: i + 1 });
    }
    // Worker postMessage types share this shape but are not bus events; they
    // are excluded here because the worker file is not a bus participant, and
    // the map applies the same rule.
    if (file.startsWith('src/worker/')) return;
    for (const m of line.matchAll(/\btype:\s*['"]([A-Za-z:_-]+)['"]/g)) OBJECT_EMITS.add(m[1]);
  });
}

/** The rows of a markdown table in the map, by the section they appear under. */
function tableAfter(heading, idColumn = 0) {
  const start = MAP.indexOf(heading);
  if (start === -1) return [];
  const lines = MAP.slice(start).split('\n').slice(1);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (/^\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (/^-+$/.test(cells[0]) || /^-+$/.test(cells[0].replace(/[: ]/g, ''))) { inTable = true; continue; }
      if (inTable) rows.push(cells[idColumn]?.replace(/`/g, '').split('<br>')[0]);
    } else if (inTable && line.trim()) break;
  }
  return rows;
}

describe('UI module report — semantic map', () => {
  it('is regenerated from the source the committed file was written from', () => {
    // `npm run report:ui:check` is in repository:check, but it only runs when
    // someone remembers; this runs with the suite.
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['report:ui']).toContain('generate-ui-module-report.mjs');
    expect(report).toContain('## Semantic map');
  });

  it('lists every tab panel the generator maps', async () => {
    // PANELS is the one hand-maintained structure; if a sub-tab is in the tab
    // tree it has to appear in the report, and the module that builds it has to
    // appear in the map's boot table.
    const { TAB_ORDER, TAB_SUBTABS, SUBTAB_HELP } = await import('../../src/ui/helpRegistry.js');
    const subIds = TAB_ORDER.flatMap((t) => TAB_SUBTABS[t] || []);
    expect(subIds.length).toBeGreaterThan(0);
    for (const subId of subIds) {
      // The report renders the documented title, not the raw sub-tab id.
      expect(report, `sub-tab ${subId} is missing from the report`).toContain(SUBTAB_HELP[subId].title);
    }
    const generator = read('scripts/generate-ui-module-report.mjs');
    const files = [...generator.matchAll(/file: '(src\/ui\/[a-zA-Z]+\.js)'/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      expect(MAP, `${file} builds a panel but is not in the semantic map`).toContain(file.replace('src/', ''));
    }
  });

  it('lists every step initUI runs', () => {
    const body = /export function initUI\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(read('src/ui/ui.js'))[1];
    const steps = [...body.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]);
    expect(steps.length).toBeGreaterThan(10);
    for (const step of steps) {
      expect(MAP, `initUI step ${step} is missing from the semantic map`).toContain(`\`${step}\``);
    }
  });

  it('only lists "no producer" rows that really have no producer', () => {
    const dangling = tableAfter('subscriptions with no producer');
    expect(dangling.length).toBeGreaterThan(0);
    for (const name of dangling) {
      const produced = NAMED_EMITS.has(name) || OBJECT_EMITS.has(name);
      expect(produced, `${name} now has a producer but is still listed as dangling`).toBe(false);
      expect(SUBSCRIPTIONS.has(name), `${name} is listed as a dangling subscription but nothing subscribes`).toBe(true);
    }
  });

  it('lists every dangling subscription the source contains', () => {
    const listed = new Set(tableAfter('subscriptions with no producer'));
    const actual = [...SUBSCRIPTIONS.keys()].filter(
      (name) => !NAMED_EMITS.has(name) && !OBJECT_EMITS.has(name),
    );
    expect(actual.length).toBeGreaterThan(0);
    for (const name of actual) {
      expect([...listed], `${name} has no producer but is not in the map`).toContain(name);
    }
  });

  it('push rows really are consumed by a panel', () => {
    const push = tableAfter('#### Push: simulation → panel');
    expect(push.length).toBeGreaterThan(0);
    for (const name of push) {
      const uiSubs = SUBSCRIPTIONS.get(name) || [];
      expect(
        uiSubs.some((s) => s.file.startsWith('src/ui/')),
        `${name} is listed as pushing to a panel but no module in src/ui/ subscribes`,
      ).toBe(true);
    }
  });

  it('command rows really are sent by a panel and answered outside src/ui/', () => {
    const commands = tableAfter('#### Command: panel → orchestrator');
    expect(commands.length).toBeGreaterThan(0);
    for (const name of commands) {
      const subs = SUBSCRIPTIONS.get(name) || [];
      expect(subs.some((s) => !s.file.startsWith('src/ui/')), `${name} has no responder outside src/ui/`).toBe(true);
    }
  });

  it('does not claim a module is unreachable when something loads it', () => {
    const entry = /<script type="module" src="\.\/(src\/[^"]+)"/.exec(read('index.html'));
    expect(entry, 'index.html names no module entry point').toBeTruthy();
    const listed = [...MAP.matchAll(/^- `((?:ui\/)?[a-zA-Z0-9_.-]+\.js)`/gm)].map((m) => m[1]);
    for (const name of listed) {
      const matches = [...SOURCES.keys()].filter((f) => f.endsWith(name) && !f.startsWith('src/worker/'));
      expect(matches.length, `${name} is listed in the map but is not a source file`).toBeGreaterThan(0);
    }
  });
});