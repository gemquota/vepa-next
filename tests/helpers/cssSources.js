/**
 * VEPA4 — every stylesheet the app actually ships, in load order.
 *
 * The obvious place to look for CSS is `style.css`. It is not the whole story:
 * two UI modules inject a `<style>` block from a JavaScript template literal at
 * mount time, and those rules are just as real — they are what the WORLD STATES
 * tab and the chaos multiplex actually look like.
 *
 * An audit that only reads `style.css` therefore passes while the WORLD STATES
 * buttons sit at 9px with no `touch-action`, which is precisely the defect the
 * audit exists to catch. So both the type-scale and the touch-contract tests
 * read their sources through this module instead of importing the files
 * themselves, and neither can be fooled by a stylesheet that moved.
 *
 * The injected blocks are matched structurally (`<style>` tags and assignments
 * to a style element's text), not by a hard-coded file list, so a third injected
 * stylesheet is picked up without anyone remembering to add it here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Every `.js` file under `src/`, sorted so the order is stable across runs. */
function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Pull the CSS out of a module: literal `<style>` blocks, and template
 * literals assigned to a style element. Interpolations become `0` so a block
 * still parses when it embeds a computed value.
 */
function injectedCss(src) {
  const blocks = [];
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) blocks.push(m[1]);
  for (const m of src.matchAll(/styleEl?\.textContent\s*=\s*`([\s\S]*?)`/g)) blocks.push(m[1]);
  return blocks
    .map((b) => b.replace(/\$\{[^}]*\}/g, '0'))
    .filter((b) => b.includes('{'));
}

/**
 * Stylesheets in the order the browser sees them.
 *
 * `style.css` is a <link> in <head>; `toolbarHelp.css` is imported by
 * `src/ui/ui.js` and is injected by the module graph, so it loads after and wins
 * every specificity tie. Injected module styles come last, because they are
 * added to the document when the module mounts.
 *
 * @returns {Array<{file: string, css: string}>}
 */
export function stylesheetSources() {
  const sources = [
    { file: 'style.css', css: readFileSync(join(ROOT, 'style.css'), 'utf8') },
    { file: 'src/ui/toolbarHelp.css', css: readFileSync(join(ROOT, 'src/ui/toolbarHelp.css'), 'utf8') },
  ];
  for (const file of jsFiles(join(ROOT, 'src'))) {
    const css = injectedCss(readFileSync(file, 'utf8'));
    if (css.length) sources.push({ file: relative(ROOT, file), css: css.join('\n') });
  }
  return sources;
}

/** Collapse whitespace and normalise attribute-selector quoting. */
export const norm = (selector) => selector.replace(/"/g, "'").replace(/\s+/g, ' ').trim();

export const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Flatten one stylesheet into `{ selector, body, media, order, file }` records.
 *
 * Hand-rolled rather than regex-based because `@media { … }` nests: a flat
 * `selector { body }` regex silently mis-attributes every rule inside a media
 * query, and the coarse-pointer rules live in exactly such a query.
 */
export function parseStylesheet(css, file, startOrder) {
  const out = [];
  const stack = [];
  let buf = '';
  let order = startOrder;
  for (const ch of css) {
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      const nested = prelude.startsWith('@');
      const frame = { prelude, nested, start: out.length };
      stack.push(frame);
      if (!nested) {
        const media = stack.slice(0, -1).map((f) => f.prelude).filter((p) => p.startsWith('@')).join(' ');
        for (const raw of prelude.split(',')) {
          const selector = norm(raw);
          if (!selector || selector === 'from' || selector === 'to' || selector === '*') continue;
          if (/^[\d.]+%$/.test(selector)) continue;
          out.push({ selector, body: '', media, order: order++, file });
        }
      }
    } else if (ch === '}') {
      const frame = stack.pop();
      if (frame && !frame.nested) for (let k = frame.start; k < out.length; k += 1) out[k].body += buf;
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out.filter((r) => r.body.includes(':'));
}

/** Every rule from every stylesheet, in cascade order. */
export function allRules() {
  const out = [];
  let order = 0;
  for (const source of stylesheetSources()) {
    const parsed = parseStylesheet(stripComments(source.css), source.file, order);
    order += parsed.length + 1;
    out.push(...parsed);
  }
  return out;
}

/** Declaration map for a rule body. */
export function decls(body) {
  const map = {};
  for (const part of body.split(';')) {
    const idx = part.indexOf(':');
    if (idx > 0) map[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
  }
  return map;
}
