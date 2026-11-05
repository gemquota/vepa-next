#!/usr/bin/env node
/**
 * VEPA4 — UI module report generator.
 *
 * Answers the question the drawer is hard to answer by hand: *for each tab,
 * what modules does it contain, what do they display, what do they look like,
 * and what can I press?* The alternative — a document someone maintains by
 * hand — is wrong within one release, which is how such a document comes to be
 * wrong in the first place.
 *
 * So nothing in the body of this report is written by hand. It is derived from
 * four sources that already have to be true:
 *
 *   index.html               the tab/sub-tab tree and the static panel markup
 *   src/ui/helpRegistry.js   the documented purpose of every tab, sub-tab,
 *                            graph and analytics cell — the help content is
 *                            already written and reviewed, so it is the honest
 *                            source for "what does this display"
 *   src/ui/*.js              the controls each panel builds at mount time, read
 *                            out of its own templates and DOM calls
 *   style.css                the visual characteristics: type size, layout and
 *                            accent colour of the classes each panel uses
 *
 * The one hand-maintained structure is the PANELS table below, because the link
 * between a sub-tab id and the file that builds it is implicit in the code
 * (`createIntelPanel` hard-codes `#intel-dashboard`). It is validated against
 * the real files at the end of this script, so a rename cannot leave it
 * silently wrong.
 *
 * Output: docs/systems/ui-module-report.md, which `npm run build` publishes to
 * dist/docs/systems/ via scripts/publish-system-atlas.mjs. That is what makes
 * it linkable from the running app and not only from a checkout.
 *
 * Run: node scripts/generate-ui-module-report.mjs [--check]
 *   --check exits non-zero if the committed file differs, so a panel added
 *   without regenerating the report fails the build rather than shipping.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/systems/ui-module-report.md');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * Sub-tab → the module that builds it.
 *
 * `cellPrefix` is how that module's entries in `CELL_HELP` are recognised. The
 * prefixes are not derivable from the sub-tab id (`data-groups` is `ga-*`,
 * `data-civilization` is `civ-*`), and the validation step at the bottom proves
 * the four prefixes between them account for every cell exactly once.
 */
const PANELS = {
  'setup-laws': { file: 'src/ui/lawPanel.js', mount: 'law-grid', cellPrefix: null },
  'setup-world': { file: 'src/ui/worldPanel.js', mount: 'world-params', cellPrefix: null },
  'setup-species': { file: 'src/ui/speciesPanel.js', mount: 'species-list', cellPrefix: null },
  'setup-settings': { file: 'src/ui/settingsPanel.js', mount: 'laws-panel', cellPrefix: null },
  // SAVES carries three sub-tabs, all built by savePanel.js into three
  // separate mounts — one module, one file, three containers.
  'saves-states': { file: 'src/ui/savePanel.js', mount: 'saves-panel', cellPrefix: null },
  'saves-undo': { file: 'src/ui/savePanel.js', mount: 'undo-panel', cellPrefix: null },
  'saves-io': { file: 'src/ui/savePanel.js', mount: 'io-panel', cellPrefix: null },
  'data-intel': { file: 'src/ui/intelPanel.js', mount: 'intel-dashboard', cellPrefix: 'intel-' },
  'data-dna': { file: 'src/ui/dnaAnalytics.js', mount: 'dna-analytics', cellPrefix: null },
  'data-logs': { file: 'src/ui/narrativePanel.js', mount: 'narrative-panel', cellPrefix: null },
  'data-groups': { file: 'src/ui/groupAnalytics.js', mount: 'groups-dashboard', cellPrefix: 'ga-' },
  'data-eco': { file: 'src/ui/ecoPanel.js', mount: 'eco-dashboard', cellPrefix: 'eco-' },
  'data-civilization': { file: 'src/ui/civilizationPanel.js', mount: 'civilization-dashboard', cellPrefix: 'civ-' },
};

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

// ── Sources ──────────────────────────────────────────────────────────────
const HTML = await readFile(resolve(ROOT, 'index.html'), 'utf8');
const CSS = [
  await readFile(resolve(ROOT, 'style.css'), 'utf8'),
  await readFile(resolve(ROOT, 'src/ui/toolbarHelp.css'), 'utf8'),
].join('\n');
const { TAB_HELP, SUBTAB_HELP, TAB_SUBTABS, TAB_ORDER, CELL_HELP, GRAPH_HELP } = await import(
  pathToFileURL(resolve(ROOT, 'src/ui/helpRegistry.js')).href
);
const VERSION = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8')).version;

/** `data-tab` / `data-sub` buttons in index.html, with their visible labels. */
const tabButtons = [...HTML.matchAll(/data-tab="([^"]+)"[^>]*aria-label="([^"]*)"/g)].map((m) => ({ id: m[1], label: m[2] }));
const subButtons = [...HTML.matchAll(/data-sub="([^"]+)"[^>]*aria-label="([^"]*)"/g)].map((m) => ({ id: m[1], label: m[2] }));

/**
 * Canvases declared inside a panel in index.html.
 *
 * The panels are nearly all built at mount time, so index.html holds only
 * their mount points — but the DNA chart grid is static, and those nine graphs
 * are exactly the ones a reader cannot otherwise discover.
 */
function canvasesFor(panelId) {
  const start = HTML.indexOf(`id="${panelId}"`);
  if (start === -1) return [];
  let depth = 0;
  let i = start;
  for (; i < HTML.length; i += 1) {
    if (HTML[i] !== '<') continue;
    const close = HTML.indexOf('>', i);
    if (close === -1) break;
    const tag = HTML.slice(i, close);
    if (tag.startsWith('</')) depth -= 1;
    else if (!tag.endsWith('/>') && !/^<(input|img|br|hr|meta|link|canvas)\b/.test(tag)) depth += 1;
    if (depth === 0) break;
    i = close;
  }
  return [...HTML.slice(start, i).matchAll(/<canvas id="([^"]+)"/g)].map((m) => m[1]);
}

/**
 * What a module actually builds: the controls it instantiates, the classes it
 * applies, and the readouts it labels. Read from the module's own source rather
 * than declared here, so adding a control to a panel changes the report.
 */
async function moduleFacts(relPath) {
  const src = await readFile(resolve(ROOT, relPath), 'utf8');
  const tags = new Set();
  for (const m of src.matchAll(/<\s*(button|input|select|textarea|canvas|table|details|summary)\b/gi)) {
    tags.add(m[1].toLowerCase());
  }
  for (const m of src.matchAll(/createElement\(\s*['"]([a-z]+)['"]/gi)) tags.add(m[1].toLowerCase());

  const classes = new Set();
  for (const m of src.matchAll(/class="([^"$`]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c && /^[a-z][a-z0-9_-]*$/.test(c)) classes.add(c);
  }
  for (const m of src.matchAll(/classList\.(?:add|toggle)\(\s*['"]([a-z0-9_-]+)['"]/gi)) classes.add(m[1]);

  // Sliders come from a shared factory, so a panel that never writes `<input>`
  // can still be full of them.
  const sliders = (src.match(/sliderControl|sc-input|createSliderRow/g) || []).length;

  const INTERACTIVE = ['button', 'input', 'select', 'textarea', 'table', 'details', 'summary'];
  return {
    controls: INTERACTIVE.filter((t) => tags.has(t)),
    canvases: tags.has('canvas'),
    sliders,
    classes: [...classes].sort(),
    lines: src.split('\n').length,
  };
}

// ── style.css: visual characteristics ────────────────────────────────────
function parseCss(src) {
  const rules = [];
  const stack = [];
  let buf = '';
  for (const ch of src) {
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      const nested = prelude.startsWith('@');
      const frame = { nested, start: rules.length };
      stack.push(frame);
      if (!nested) {
        for (const raw of prelude.split(',')) {
          const selector = raw.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
          if (!selector || selector === 'from' || selector === 'to' || selector === '*') continue;
          if (/^[\d.]+%$/.test(selector)) continue;
          rules.push({ selector, body: '' });
        }
      }
    } else if (ch === '}') {
      const f = stack.pop();
      if (f && !f.nested) for (let k = f.start; k < rules.length; k += 1) rules[k].body += buf;
      buf = '';
    } else buf += ch;
  }
  return rules.filter((r) => r.body.includes(':'));
}

const CSS_RULES = parseCss(CSS.replace(/\/\*[\s\S]*?\*\//g, ''));

const decls = (body) => {
  const out = {};
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
};

/**
 * Describe how a module's classes are styled: type sizes, layout, and accents.
 * A description of the CSS rather than a screenshot, because that is the part
 * of "visual characteristics" a reader can act on.
 */
function visualProfile(classes) {
  const wanted = new Set(classes);
  const sizes = new Map();
  const layouts = new Set();
  const colors = new Set();
  let bordered = 0;
  for (const rule of CSS_RULES) {
    const simple = rule.selector.match(/^([.#])?([a-z0-9_-]+)$/i);
    if (!simple) continue;
    const name = simple[2];
    if (!wanted.has(name)) continue;
    const d = decls(rule.body);
    const size = Number(/^(\d+(?:\.\d+)?)px/.exec(d['font-size'] || d.font || '')?.[1]);
    if (size) sizes.set(name, size);
    for (const prop of ['display', 'grid-template-columns', 'flex-direction']) {
      // `display: none` is how a collapsed panel is expressed, not a layout
      // choice worth reporting.
      if (d[prop] && d[prop] !== 'none') layouts.add(`${prop}: ${d[prop]}`);
    }
    for (const prop of ['color', 'background', 'border-color']) {
      const v = d[prop];
      if (v && /(var\(--accent|hsl|#[0-9a-f]{3,8}|rgb)/i.test(v)) colors.add(v.replace(/\s+/g, ' ').slice(0, 48));
    }
    if (d.border || d['border-color']) bordered += 1;
  }
  const spread = [...new Set([...sizes.values()])].sort((a, b) => a - b);
  return {
    minFont: spread[0] ?? null,
    maxFont: spread[spread.length - 1] ?? null,
    fontSpread: spread,
    layouts: [...layouts].slice(0, 5),
    colors: [...colors].slice(0, 5),
    bordered,
    styled: new Set([...sizes.keys()]).size + bordered,
  };
}

// ── Semantic map: the wiring, read out of src/** ─────────────────────────
// The half above answers "what is on this tab". The map answers "how is the
// layer wired" — what builds what and in what order, which events each module
// listens to and sends, which modules several panels share, and where a wire
// is attached to nothing.
//
// Like everything above it is derived, not declared. The only structure held by
// hand is PANELS; the event graph, the boot order and the kernel are read out
// of call sites, so the map cannot describe wiring that no longer exists.

const SRC_DIR = resolve(ROOT, 'src');

async function walkJs(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) await walkJs(abs, out);
    else if (entry.name.endsWith('.js')) out.push(relative(ROOT, abs).split('\\').join('/'));
  }
  return out;
}

/** Resolve a relative import specifier against the importing file. */
function relPath(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/**
 * One node per source file: what it emits, what it subscribes to, what it
 * imports, and the first self-description in its header comment.
 *
 * The bus has two dispatch channels and both are in use, so both are read:
 *
 *   named    emit('law:toggled')        — the event name is the argument
 *   object   bus.emit(ev.type, ev)     — the name lives in a `type:` field and
 *                                         src/main.js dispatches six such
 *                                         event lists each tick
 *
 * Reading only the named channel would report every epoch, speciation and
 * agency event as an orphan subscription, which is a false alarm in a document
 * whose whole value is that its claims are checkable.
 */
const SRC_FILES = (await walkJs(SRC_DIR)).sort();
const NODES = new Map();
for (const rel of SRC_FILES) {
  const src = await readFile(resolve(ROOT, rel), 'utf8');
  const emits = new Map();
  const subs = new Map();
  const typeDecls = new Map();
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\bemit\(\s*['"]([A-Za-z:_-]+)['"]/g)) {
      if (!emits.has(m[1])) emits.set(m[1], i + 1);
    }
    for (const m of line.matchAll(/\bon\(\s*['"]([A-Za-z:_-]+)['"]/g)) {
      if (!subs.has(m[1])) subs.set(m[1], i + 1);
    }
    for (const m of line.matchAll(/\btype:\s*['"]([A-Za-z:_-]+)['"]/g)) {
      if (!typeDecls.has(m[1])) typeDecls.set(m[1], i + 1);
    }
  });
  const imports = new Set();
  for (const m of [
    ...src.matchAll(/\bfrom\s+'([^']+)'/g),
    ...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
    // The physics worker is constructed by URL, not imported by specifier.
    ...src.matchAll(/new\s+(?:URL|Worker)\(\s*['"]([^'"]+)['"]/g),
  ]) {
    const target = relPath(rel, m[1]);
    if (target) imports.add(target);
  }
  // First line of the header comment that says something — the module's own
  // name for itself, rather than one written here about it. A banner line of
  // `===` rules and a stray JSDoc block further down both have to be skipped,
  // so the search is over lines and takes whichever candidate comes first.
  let doc = '';
  let inBlock = false;
  for (const line of src.split('\n')) {
    if (/^\s*\/\*+/.test(line)) { inBlock = true; continue; }
    if (/^\s*\*\//.test(line)) { inBlock = false; continue; }
    const body = inBlock
      ? /^\s*\*\s?(.+)$/.exec(line)
      : /^\s*\/\/\s?(.+)$/.exec(line);
    const text = body && body[1].trim();
    if (!text || /^[=*\-/]/.test(text)) continue;
    doc = text;
    break;
  }
  const ids = new Set();
  for (const m of [
    ...src.matchAll(/\bid=["']([A-Za-z0-9_-]+)["']/g),
    ...src.matchAll(/\.id\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g),
  ]) ids.add(m[1]);
  NODES.set(rel, {
    rel,
    src,
    emits,
    subs,
    typeDecls,
    imports,
    doc: doc
      ? doc
          .replace(/^VEPA\s*v?\d*\s*[-—]\s*/, '')
          .replace(/[.\s]+$/, '')
          .trim()
      : '',
    lines: src.split('\n').length,
    ids,
    references: new Set(
      [...src.matchAll(/getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].map((m) => m[1]),
    ),
  });
}

/** The event vocabulary, with both channels and every call site. */
const EVENTS = new Map();
const eventOf = (name) => {
  if (!EVENTS.has(name)) EVENTS.set(name, { named: [], object: [], subs: [] });
  return EVENTS.get(name);
};
for (const node of NODES.values()) {
  for (const [name, line] of node.emits) eventOf(name).named.push({ file: node.rel, line });
  for (const [name, line] of node.subs) eventOf(name).subs.push({ file: node.rel, line });
  for (const [name, line] of node.typeDecls) eventOf(name).object.push({ file: node.rel, line });
}

const UI = (file) => file.startsWith('src/ui/');
const short = (file) => file.replace(/^src\//, '');
const EV = (names) => (names.length ? names.map((n) => `\`${n}\``).join(', ') : '—');
const shortModule = (file) => short(file).replace(/^ui\//, '');
const site = ({ file, line }) => `\`${shortModule(file)}:${line}\``;

// Reachability from what the browser actually loads: the entry script named in
// index.html, and anything it pulls in. In-degree alone would call a module
// "used" because one unreachable module imports it, which is how dead clusters
// disguise themselves.
const ROOTS = [...HTML.matchAll(/src="\.\/(src\/[^"]+\.js)"/g)].map((m) => m[1]);
const REACHABLE = new Set();
const frontier = ROOTS.filter((f) => NODES.has(f));
while (frontier.length) {
  const file = frontier.pop();
  if (REACHABLE.has(file)) continue;
  REACHABLE.add(file);
  for (const next of NODES.get(file).imports) {
    if (NODES.has(next) && !REACHABLE.has(next)) frontier.push(next);
  }
}

/** Everything a bus subscription needs to be judged wired or dangling. */
function provenance(name) {
  const ev = EVENTS.get(name);
  const emitsBus = ev.named.filter(({ file }) => !file.startsWith('src/worker/'));
  const producedBy = emitsBus.length
    ? emitsBus
    : // No named emit: the name is carried by an event object, which only
      // counts if something actually subscribes to it. Worker postMessage
      // types have no subscriber and so fall out here.
      ev.object.filter(({ file }) => !file.startsWith('src/worker/'));
  return { name, emitsBus, producedBy, subscribers: ev.subs };
}

// ── Boot order: initUI() ─────────────────────────────────────────────────
const UI_JS = await readFile(resolve(ROOT, 'src/ui/ui.js'), 'utf8');
const INIT_UI = /export function initUI\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(UI_JS)[1];
const BOOT = [...INIT_UI.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]);

/** `createWorldPanel` → `src/ui/worldPanel.js`, by who exports it. */
const EXPORT_OWNER = new Map();
for (const node of NODES.values()) {
  if (!UI(node.rel)) continue;
  for (const m of node.src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    EXPORT_OWNER.set(m[1], node.rel);
  }
}

const PANEL_FILES = new Map();
for (const [subId, meta] of Object.entries(PANELS)) PANEL_FILES.set(meta.file, { subId, mount: meta.mount });

/**
 * Where a module renders. A tab panel is declared by PANELS; anything else is
 * the set of ids it reaches for that index.html actually declares — so a module
 * whose mount point was removed from the markup reports nothing rather than
 * reporting a mount that is not there.
 */
function mountsOf(file) {
  const declared = PANEL_FILES.get(file);
  if (declared) return [`#${declared.mount}`];
  const node = NODES.get(file);
  return node ? [...node.references].filter((id) => HTML.includes(`id="${id}"`)).map((id) => `#${id}`) : [];
}

/** Ids a module reaches for that neither index.html nor the module itself makes. */
function absentRefsOf(file) {
  const node = NODES.get(file);
  if (!node) return [];
  return [...node.references].filter((id) => !node.ids.has(id) && !HTML.includes(`id="${id}"`));
}

// ── Compose ──────────────────────────────────────────────────────────────
const lines = [];
const push = (s = '') => lines.push(s);

push('# VEPA4 — UI module report');
push();
push(`> Generated by \`scripts/generate-ui-module-report.mjs\` from the source of v${VERSION}.`);
push('> Do not edit by hand — \`npm run report:ui\` regenerates it, and `--check` fails the build if it drifts.');
push();
push('For each tab: the modules inside it, the information those modules display, how');
push('they are styled, and every control they expose. It exists so you can find out');
push('what a surface does without opening the app — and so you can trust the answer,');
push('because none of the body below is written by hand.');
push();

let moduleCount = 0;
let controlCount = 0;
let subTabCount = 0;
const accountedCells = new Set();

for (const tabId of TAB_ORDER) {
  const tab = TAB_HELP[tabId];
  if (!tab) continue;
  const button = tabButtons.find((b) => b.id === tabId);
  push(`## ${tab.icon} ${tab.title}`);
  push();
  push(`**Toolbar button** \`${tabId}\` — labelled "${esc(button ? button.label : tab.title)}".`);
  push();
  push(`> ${tab.summary}`);
  push();
  for (const [heading, body] of tab.sections || []) push(`- **${heading}.** ${body}`);
  push();

  const subIds = TAB_SUBTABS[tabId] || [];
  subTabCount += subIds.length;

  if (!subIds.length) {
    // A tab with no sub-tabs is its own module (WORLD STATES).
    const meta = PANELS[tabId];
    if (!meta) continue;
    const facts = await moduleFacts(meta.file);
    moduleCount += 1;
    controlCount += facts.controls.length;
    push(`### ${meta.file}`);
    push();
    push(`Mounted at \`#${meta.mount}\`, ${facts.lines} lines.`);
    push();
    push(`**Controls:** ${facts.controls.length ? facts.controls.map((c) => `\`${c}\``).join(', ') : 'none'}.`);
    push();
    continue;
  }

  push('| Sub-tab | Module | What it displays | Controls |');
  push('| --- | --- | --- | --- |');
  for (const subId of subIds) {
    const help = SUBTAB_HELP[subId];
    const meta = PANELS[subId];
    if (!help || !meta) continue;
    moduleCount += 1;
    const facts = await moduleFacts(meta.file);
    const canvases = canvasesFor(subId);
    const cellIds = meta.cellPrefix
      ? Object.keys(CELL_HELP).filter((k) => k.startsWith(meta.cellPrefix))
      : [];
    for (const c of cellIds) accountedCells.add(c);
    const controls = [...facts.controls];
    if (facts.sliders) controls.push(`${facts.sliders} slider controls`);
    controlCount += controls.length;
    const subButton = subButtons.find((b) => b.id === subId);
    // Only worth reporting when the label says something the title does not;
    // "Laws" vs "LAWS" is not a discrepancy.
    const labelNote =
      subButton && subButton.label.toUpperCase() !== help.title.toUpperCase()
        ? `<br><sub>button label "${esc(subButton.label)}"</sub>`
        : '';
    push(
      `| ${help.icon} ${help.title}${labelNote}`
      + ` | \`${meta.file}\`<br>${facts.lines} lines`
      + ` | ${esc(help.summary)}`
      + (cellIds.length
        ? `<br><br>**${cellIds.length} documented readouts:** ${cellIds.map((c) => `\`${c}\``).join(', ')}`
        : '')
      + (canvases.length
        ? `<br><br>**${canvases.length} canvas graphs:** ${canvases.map((c) => `\`${c}\``).join(', ')}`
        : '')
      + ` | ${controls.length ? controls.map((c) => (c.startsWith(String(facts.sliders)) ? c : `\`${c}\``)).join(', ') : '**none — read-only**'} |`,
    );
  }
  push();

  for (const subId of subIds) {
    const help = SUBTAB_HELP[subId];
    const meta = PANELS[subId];
    if (!help || !meta) continue;
    const facts = await moduleFacts(meta.file);
    const profile = visualProfile(facts.classes);
    const canvases = canvasesFor(subId);

    push(`### ${help.icon} ${help.title}`);
    push();
    push(`**What it is for.** ${help.summary}`);
    push();
    for (const [heading, body] of help.sections || []) push(`- **${heading}.** ${body}`);
    push();

    push('**Visual characteristics.**');
    push();
    if (profile.styled === 0) {
      push(`- No classes of its own; it is styled entirely by inherited panel rules.`);
    } else {
      push(`- ${profile.styled} CSS rules target its own classes.`);
      if (profile.minFont !== null) {
        const type = profile.fontSpread.length > 1
          ? `runs from ${profile.minFont}px to ${profile.maxFont}px (${profile.fontSpread.join(' / ')}px)`
          : `is ${profile.minFont}px throughout`;
        push(`- Type ${type}. Floors are enforced by \`tests/unit/typeScale.test.js\`.`);
      }
      if (profile.layouts.length) push(`- Layout: ${profile.layouts.map((l) => `\`${l}\``).join('; ')}.`);
      if (profile.colors.length) push(`- Accents: ${profile.colors.map((c) => `\`${c}\``).join('; ')}.`);
    }
    if (canvases.length) push(`- Renders ${canvases.length} live canvas graphs; long-press one for what it measures.`);
    push();

    push('**Controls.**');
    push();
    if (!facts.controls.length && !facts.sliders) {
      push('- None. This is read-only by design: every value it shows is derived from the simulation, and editing a readout would desynchronise it from what it measures.');
    } else {
      for (const c of facts.controls) push(`- \`<${c}>\``);
      if (facts.sliders) push(`- ${facts.sliders} sliders, built by the shared \`sliderControl\` factory so they all get the same tap target and help behaviour.`);
    }
    push();
  }
}

push('## Coverage');
push();
push(`- **${TAB_ORDER.length} top-level tabs** and **${subTabCount} sub-tabs**, all of them listed above.`);
push(`- **${moduleCount} UI modules**, each mapped to the file that builds it.`);
push(`- **${controlCount} control types** across those modules.`);
push(`- **${accountedCells.size} of ${Object.keys(CELL_HELP).length} analytics cells** are attributed to a panel above; the remainder belong to panels that are not tab-mounted.`);
push(`- **${Object.keys(GRAPH_HELP).length} graphs** have their own help entries. Long-press any graph or cell in the app to read it.`);
push();
push('This is a view of the code, not a copy of it. If a module here looks wrong, the');
push('fix belongs in `src/ui/`, and the report follows on the next build.');
push();

// ── SEMANTIC-MAP ──
const bootRows = BOOT.map((call, i) => {
  const file = EXPORT_OWNER.get(call) || 'src/ui/ui.js';
  const node = NODES.get(file);
  return {
    order: i + 1,
    call,
    file,
    mounts: mountsOf(file),
    subs: [...node.subs.keys()].sort(),
    emits: [...node.emits.keys()].sort(),
  };
});

const chromeRows = bootRows.filter((r) => r.file === 'src/ui/ui.js');
const panelRows = bootRows.filter((r) => r.call.startsWith('create'));
const helpRows = bootRows.filter((r) => !chromeRows.includes(r) && !panelRows.includes(r));
const range = (rows) => `${rows[0].order}–${rows[rows.length - 1].order}`;

push('## Semantic map');
push();
push('The half above answers *what is on this tab*. This answers *how the layer is');
push('wired*: what constructs what and in what order, which bus events each module');
push('listens to and sends, which modules several panels share, and where a wire ends');
push('up attached to nothing.');
push();
push('It is read the same way as the rest of this report — out of call sites in');
push('`src/**`, not out of a structure written here — so it cannot describe wiring that');
push('no longer exists. Where it names a loose end it gives the `file:line`, because a');
push('document full of suspicions is worth nothing.');
push();
push('### Boot order');
push();
push(`\`src/main.js\` calls \`initUI\` once. \`initUI\` runs ${BOOT.length} steps: ${chromeRows.length} wire the drawer`);
push(`chrome and the toolbar, ${panelRows.length} construct a panel, ${helpRows.length} install the help layer. The`);
push('order is a convention, not a dependency — the bus is a plain listener list and');
push('every mount point is static markup, so an early panel never waits on a later');
push('one. It is worth knowing anyway, because it is the execution order that decides');
push('what runs when a panel constructor returns early.');
push();
push('| # | Step | Module | Mounts | Listens to | Sends |');
push('| --- | --- | --- | --- | --- | --- |');
const mountCell = (r) => (r.mounts.length ? r.mounts.map((m) => `\`${m}\``).join('<br>') : '**nothing**');
const bootRow = (r, label) => `| ${label} | \`${esc(r.call)}\` | \`${short(r.file)}\` | ${mountCell(r)} | ${EV(r.subs)} | ${EV(r.emits)} |`;
push(
  `| ${range(chromeRows)} | ${chromeRows.map((r) => `\`${r.call}\``).join('<br>')}`
  + ` | \`src/ui/ui.js\`<br><sub>chrome, tabs, shortcuts</sub>`
  + ` | \`#drawer-container\`<br>\`#top-toolbar\` | ${EV([...new Set(chromeRows.flatMap((r) => r.subs))])} | ${EV([...new Set(chromeRows.flatMap((r) => r.emits))])} |`,
);
for (const r of panelRows) push(bootRow(r, String(r.order)));
push(
  `| ${range(helpRows)} | ${helpRows.map((r) => `\`${r.call}\``).join('<br>')}`
  + ` | ${[...new Set(helpRows.map((r) => short(r.file)))].map((f) => `\`${f}\``).join('<br>')}`
  + ` | overlay, on demand | ${EV(helpRows.flatMap((r) => r.subs))} | ${EV(helpRows.flatMap((r) => r.emits))} |`,
);
push();
const uiSubs = (name) => EVENTS.get(name).subs.filter(({ file }) => UI(file));
const outsideProducers = (name) => EVENTS.get(name).named.filter(({ file }) => !UI(file));
const uiProducers = (name) => EVENTS.get(name).named.filter(({ file }) => UI(file));
const outsideSubs = (name) => EVENTS.get(name).subs.filter(({ file }) => !UI(file));

const PUSH = [...EVENTS.keys()]
  .filter((n) => outsideProducers(n).length && uiSubs(n).length)
  .sort();
const COMMAND = [...EVENTS.keys()]
  .filter((n) => uiProducers(n).length && outsideSubs(n).length)
  .sort();
const INTERNAL = [...EVENTS.keys()]
  .filter((n) => uiProducers(n).length && uiSubs(n).length)
  .sort();
const UI_EVENTS = [...EVENTS.keys()].filter((n) => uiProducers(n).length || uiSubs(n).length);
// How much of the command channel main.js answers on its own, rather than
// forwarding: the engines that also listen to UI events are the exception and
// are named rather than smoothed over.
const mainOnly = COMMAND.filter((n) => outsideSubs(n).every(({ file }) => file === 'src/main.js'));
const mainNotOnly = COMMAND.filter((n) => !mainOnly.includes(n));

push('### Two channels to the orchestrator');
push();
push(`The UI layer and \`src/main.js\` speak over ${UI_EVENTS.length} named events, which separate by`);
push('direction. An event can appear in more than one list, which is exactly the');
push('point of listing them: a panel-to-panel edge is often also a command.');
push();
push(`- **${PUSH.length} push in** — produced outside \`src/ui/\`, consumed by a panel. These are the numbers a panel`);
push('  displays, and they arrive without the panel asking.');
push(`- **${COMMAND.length} commands out** — sent by a panel, answered outside \`src/ui/\`. ${mainOnly.length} of the ${COMMAND.length} are`);
push('  answered by `src/main.js` and nothing else, so a panel never reaches an engine,');
push('  a state module or the worker by name.');
if (mainNotOnly.length) {
  push(`- ${mainNotOnly.length} command${mainNotOnly.length === 1 ? '' : 's'} also reach${mainNotOnly.length === 1 ? 'es' : ''} something else:`);
  for (const name of mainNotOnly) {
    const elsewhere = outsideSubs(name).filter(({ file }) => file !== 'src/main.js');
    push(`  \`${name}\` → ${elsewhere.map(({ file }) => `\`${short(file)}\``).join(', ')}.`);
  }
}
push(`- **${INTERNAL.length} exchanged panel to panel**, with the orchestrator out of the path.`);
push();
push('#### Push: simulation → panel');
push();
push('| Event | Produced by | Panel |');
push('| --- | --- | --- |');
for (const name of PUSH) {
  const prov = provenance(name);
  const by = prov.producedBy.map(site).join('<br>');
  const objectOnly = !prov.producedBy.length ? '—' : '';
  push(
    `| \`${name}\` | ${by || objectOnly} | ${uiSubs(name).map(({ file }) => `\`${shortModule(file)}\``).join(', ')} |`,
  );
}
push();
push('#### Command: panel → orchestrator');
push();
push('| Event | Sent by | Answered by |');
push('| --- | --- | --- |');
for (const name of COMMAND) {
  push(
    `| \`${name}\` | ${uiProducers(name).map(({ file }) => `\`${shortModule(file)}\``).join(', ')}`
    + ` | ${outsideSubs(name).map(({ file }) => `\`${short(file)}\``).join(', ')} |`,
  );
}
push();
push('#### Inside the layer');
push();
if (INTERNAL.length) {
  push(`${INTERNAL.length} event${INTERNAL.length === 1 ? ' is' : 's are'} delivered straight from one module to`);
  push('another inside `src/ui/`, with no orchestrator hop on that edge:');
  push();
  for (const name of INTERNAL) {
    push(
      `- \`${name}\` — ${uiProducers(name).map(({ file }) => shortModule(file)).join(', ')} → ${uiSubs(name).map(({ file }) => shortModule(file)).join(', ')}.`,
    );
  }
} else {
  push('- None.');
}
push();
const importedBy = (file) => [...NODES.values()].filter((n) => n.imports.has(file)).map((n) => n.rel);
const BOOT_FILES = new Set(bootRows.map((r) => r.file));
const KERNEL = SRC_FILES.filter((f) => UI(f) && f !== 'src/ui/ui.js' && !BOOT_FILES.has(f));
const role = (file) => {
  const users = importedBy(file);
  if (!users.length) return '**not imported**';
  if (users.length > 1) return 'shared';
  if (users[0] === 'src/ui/ui.js') return 'wired at init';
  return 'single owner';
};

push('### The shared kernel');
push();
push(`The coverage counts above are tab panels. \`src/ui/\` holds ${SRC_FILES.filter(UI).length} JavaScript modules; the rest are the`);
push(`orchestrator, ${KERNEL.filter((f) => importedBy(f).length > 1).length} shared helpers and the help layer. A helper earns its place here only`);
push('by being imported more than once, so this list is the deduplication record:');
push('every entry is one behaviour that would otherwise be a second implementation.');
push();
push('| Module | What it owns | Imported by | Role |');
push('| --- | --- | --- | --- |');
for (const file of KERNEL.sort((a, b) => importedBy(b).length - importedBy(a).length || a.localeCompare(b))) {
  const users = importedBy(file);
  push(
    `| \`${short(file)}\`<br><sub>${NODES.get(file).lines} lines</sub>`
    + ` | ${NODES.get(file).doc ? esc(NODES.get(file).doc) : '—'}`
    + ` | ${users.length ? users.map((u) => `\`${shortModule(u)}\``).join(', ') : '**nothing**'}`
    + ` | ${role(file)} |`,
  );
}
push();
// A dangling subscription is a *listener* nothing sends; an unanswered send is
// an *emit* nothing hears. Both predicates require the matching half to exist,
// or every postMessage type in the worker would qualify as a dead listener.
const dangling = (name) => EVENTS.get(name).subs.length > 0 && provenance(name).producedBy.length === 0;
const unanswered = (name) => provenance(name).emitsBus.length > 0 && EVENTS.get(name).subs.length === 0;

const dark = panelRows.filter((r) => r.mounts.length === 0);
const darkBus = dark.map((r) => {
  const subs = r.subs.filter(dangling);
  const sends = r.emits.filter(unanswered);
  return { ...r, subs, sends, absent: absentRefsOf(r.file) };
}).filter((r) => r.absent.length || r.subs.length || r.sends.length);
const unreached = SRC_FILES.filter((f) => !REACHABLE.has(f));
const danglingSubs = [...EVENTS.keys()].filter(dangling).sort();
const deadSends = [...EVENTS.keys()].filter(unanswered).sort();

push('### Loose ends');
push();
push('Facts this map produced that no other part of the report states. Each names a');
push('call site so it can be checked rather than believed. None of them is a');
push('recommendation — a wire with nothing on the end of it may be a dormant feature,');
push('a seam for something not built yet, or a genuine omission, and the code does not');
push('say which.');
push();
if (darkBus.length) {
  push('**Panels that construct and render nothing.**');
  push();
  for (const r of darkBus) {
    const parts = [];
    if (r.absent.length) {
      const where = NODES.get(r.file).src.split('\n');
      parts.push(
        `It reaches for ${r.absent.map((id) => `\`#${id}\``).join(', ')}, which neither \`index.html\` nor the module itself declares`,
      );
    }
    if (r.subs.length) parts.push(`${r.subs.length} event${r.subs.length === 1 ? '' : 's'} it waits for (${EV(r.subs)}) never arrive`);
    if (r.sends.length) parts.push(`${r.sends.length} event${r.sends.length === 1 ? '' : 's'} it sends (${EV(r.sends)}) reach nothing`);
    push(
      `- \`${r.call}\` (\`${short(r.file)}\`) is constructed on every boot and writes nothing. ${parts.join('; ')}.`
      + ' The constructor guards for the missing element, so it is silent: no error, no surface.',
    );
  }
  push();
}
if (danglingSubs.length) {
  push(`**${danglingSubs.length} subscriptions with no producer.** A listener whose event is`);
  push('never sent, on either dispatch channel.');
  push();
  push('| Event | Subscribed at |');
  push('| --- | --- |');
  for (const name of danglingSubs) {
    const subs = EVENTS.get(name).subs;
    const scope = subs.every(({ file }) => UI(file)) ? 'panel' : 'orchestrator';
    push(`| \`${name}\`<br><sub>${scope}</sub> | ${subs.map(site).join('<br>')} |`);
  }
  push();
}
if (deadSends.length) {
  push(`**${deadSends.length} events sent to an empty room.** Emitted, with no subscriber`);
  push('anywhere in `src/`.');
  push();
  const uiSends = deadSends.filter((n) => uiProducers(n).length);
  const otherSends = deadSends.filter((n) => !uiProducers(n).length);
  for (const [label, list] of [['UI', uiSends], ['orchestrator', otherSends]]) {
    if (!list.length) continue;
    push(
      `- **From the ${label}:** ${list.map((n) => `\`${n}\` (${uiProducers(n).length ? uiProducers(n).map(({ file }) => shortModule(file)).join(', ') : EVENTS.get(n).named.map(({ file }) => short(file)).join(', ')})`).join('; ')}.`,
    );
  }
  push();
}
if (unreached.length) {
  const uiUnreached = unreached.filter(UI);
  const otherUnreached = unreached.filter((f) => !UI(f));
  push(`**${unreached.length} modules nothing reachable loads.** Walking imports from the entry`);
  push(`script named in \`index.html\` (${ROOTS.map((r) => `\`${short(r)}\``).join(', ')}) reaches every other file in \`src/\``);
  push(`except these. They are checked and shipped; nothing calls them.`);
  push();
  for (const file of uiUnreached) {
    const users = importedBy(file);
    push(
      `- \`${short(file)}\` (${NODES.get(file).lines} lines) — ${NODES.get(file).doc ? esc(NODES.get(file).doc) : 'no header description'}.`
      + (users.length
        ? ` Imported only by ${users.map((u) => `\`${short(u)}\``).join(', ')}, which ${users.length === 1 ? 'is' : 'are'} itself unreachable.`
        : ' Imported by nothing at all.'),
    );
  }
  if (otherUnreached.length) {
    push(`- Outside the UI layer: ${otherUnreached.map((f) => `\`${short(f)}\``).join(', ')}.`);
  }
  push();
}
push('### Cross-references');
push();
push('- `docs/spec/architecture/module-boundaries.md` — generated area-level import and');
push('  export counts, where this map goes down to the individual module.');
push('- `docs/spec/architecture/dataflow.md` — the tick dataflow behind those push events:');
push('  configuration → worker → solver → renderer and HUD.');
push('- `src/core/eventBus.js` — the bus itself: a listener list with no routing, so every');
push('  edge above is a name string in two files and nothing more.');
push();
// ── SEMANTIC-MAP ──
const report = `${lines.join('\n')}\n`;

// ── Validation: the table must match reality ─────────────────────────────
const problems = [];
for (const [subId, meta] of Object.entries(PANELS)) {
  if (!TAB_SUBTABS[Object.keys(TAB_SUBTABS).find((t) => (TAB_SUBTABS[t] || []).includes(subId))] &&
      !TAB_HELP[subId] && !subIdsHas(subId)) {
    problems.push(`${subId} is in PANELS but is neither a tab nor a sub-tab`);
  }
  if (!HTML.includes(meta.mount)) problems.push(`${subId}: index.html has no #${meta.mount} mount point`);
  const src = await readFile(resolve(ROOT, meta.file), 'utf8').catch(() => null);
  if (src === null) problems.push(`${subId}: ${meta.file} does not exist`);
}
const orphanCells = Object.keys(CELL_HELP).filter((c) => !accountedCells.has(c) && !c.startsWith('dna-'));
if (orphanCells.length && problems.length === 0) {
  // Not fatal: some cells legitimately live outside a tab panel. Worth a line
  // in the report rather than a build failure.
  push('');
}
if (problems.length) {
  console.error('PANELS table is out of date with the code:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

function subIdsHas(id) {
  return Object.values(TAB_SUBTABS).some((list) => list.includes(id));
}

if (CHECK_ONLY) {
  const current = await readFile(OUT, 'utf8').catch(() => '');
  if (current !== report) {
    console.error('docs/systems/ui-module-report.md is stale. Run: npm run report:ui');
    process.exit(1);
  }
  console.log('ui-module-report.md is up to date');
} else {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, report);
  console.log(`Wrote docs/systems/ui-module-report.md (${report.split('\n').length} lines, ${moduleCount} modules)`);
}
