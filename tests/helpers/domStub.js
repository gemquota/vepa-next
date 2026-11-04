/**
 * VEPA4 — a minimal DOM stub for unit tests.
 *
 * The project ships no DOM library and vitest runs in the `node` environment,
 * so every UI test that wants to exercise real wiring needs something. This is
 * that something, shared, so there is one implementation instead of a private
 * fake per test file — drawer.test.js had its own and launchModal.test.js
 * needed a superset of it.
 *
 * It implements only what the drawer and the launch modal actually touch:
 * element creation, parent/child, a small selector vocabulary
 * (`tag`, `.class`, `#id`, `[attr]`, `[attr=value]`, `tag.class`, descendants
 * and comma lists), classList, dataset, attributes, focus, listeners with
 * bubbling, textContent and innerHTML.
 *
 * The innerHTML parser is the part that earns its keep: the UI builds most of
 * its markup with template literals, so a stub that cannot parse HTML cannot
 * test the wiring *inside* that markup. It handles the well-formed subset the
 * app emits — no scripts, no raw-text elements, no malformed input — and
 * throws on anything else rather than silently producing a wrong tree, because
 * a stub that quietly mis-parses gives green tests over broken code.
 */

const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'area', 'base', 'col']);

/** One attribute selector: `[name]` or `[name=value]`. The `=` is optional. */
const ATTR_RE = /\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/;

/**
 * A `dataset` view over the element's attributes, with the DOM's camelCase
 * rule: `dataset.catRow` and `data-cat-row` are the same thing.
 *
 * Without the mapping, every hyphenated data attribute in the app — `data-law`,
 * `data-cat-row`, `data-species` — is readable only under its raw dashed name,
 * so `el.dataset.catRow` is silently `undefined` and any code that filters on
 * it hides everything. That is exactly what happened to the law grid's category
 * rows before this existed.
 */
function makeDataset(el) {
  const toAttr = (prop) => `data-${String(prop).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
  const toProp = (attr) => attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const handler = {
    get(_t, prop) {
      if (typeof prop !== 'string') return undefined;
      return el.attrs[toAttr(prop)];
    },
    set(_t, prop, value) {
      el.attrs[toAttr(prop)] = String(value);
      return true;
    },
    has(_t, prop) {
      return typeof prop === 'string' && toAttr(prop) in el.attrs;
    },
    deleteProperty(_t, prop) {
      delete el.attrs[toAttr(prop)];
      return true;
    },
    ownKeys() {
      return Object.keys(el.attrs).filter((k) => k.startsWith('data-')).map(toProp);
    },
    getOwnPropertyDescriptor(_t, prop) {
      const attr = toAttr(prop);
      return attr in el.attrs
        ? { value: el.attrs[attr], enumerable: true, configurable: true }
        : undefined;
    },
  };
  return new Proxy({}, handler);
}

let uid = 0;

/**
 * A minimal `style` object: plain properties plus the three CSSOM methods the
 * app actually calls.
 *
 * Custom properties matter more here than usual — the law grid writes every
 * colour as `--law-h` / `--law-s` through `setProperty`, so a stub that only
 * accepted `style.foo = ...` would make the whole grid un-renderable in tests.
 * `setProperty('--x', v)` and `style['--x'] = v` are deliberately the same
 * store, as they are in a browser.
 */
function makeStyle() {
  const props = new Map();
  const custom = new Map();
  const base = {
    setProperty(name, value) {
      if (String(name).startsWith('--')) custom.set(name, String(value));
      else props.set(name, String(value));
    },
    removeProperty(name) {
      if (String(name).startsWith('--')) custom.delete(name);
      else props.delete(name);
    },
    getPropertyValue(name) {
      const key = String(name);
      return key.startsWith('--') ? (custom.get(key) ?? '') : (props.get(key) ?? '');
    },
  };
  return new Proxy(base, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (key in target) return target[key];
      return custom.get(key) ?? props.get(key);
    },
    set(target, key, value) {
      const name = String(key);
      if (name.startsWith('--')) custom.set(name, String(value));
      else props.set(name, String(value));
      return true;
    },
    has(target, key) {
      if (typeof key !== 'string') return false;
      return key in target || custom.has(key) || props.has(key);
    },
    deleteProperty(target, key) {
      custom.delete(String(key));
      props.delete(String(key));
      return true;
    },
    ownKeys() {
      return [...new Set([...props.keys(), ...custom.keys()])];
    },
    getOwnPropertyDescriptor(target, key) {
      const name = String(key);
      if (props.has(name) || custom.has(name)) return { value: this.get(target, key), enumerable: true, configurable: true };
      return undefined;
    },
  });
}

/**
 * A recording 2D context.
 *
 * The analytics panels (`ecoPanel`, `groupAnalytics`, `civilizationPanel`)
 * paint their graphs through `getContext('2d')`, and their `drawAll` bodies
 * were never executed by any test — the class of gap that shipped a
 * `ReferenceError` in `civilizationPanel` for a full release. A stub that only
 * *permitted* drawing would let a draw path rot while tests stayed green, so
 * every call is recorded on `calls`. A test can then assert not just "did not
 * throw" but "the graph code actually ran".
 */
export function makeContext2d(canvas = null) {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); };
  const ctx = {
    canvas,
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'start',
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    rect: record('rect'),
    fill: record('fill'),
    stroke: record('stroke'),
    clip: record('clip'),
    fillText: record('fillText'),
    strokeText: record('strokeText'),
    setTransform: record('setTransform'),
    translate: record('translate'),
    scale: record('scale'),
    rotate: record('rotate'),
    save: record('save'),
    restore: record('restore'),
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    putImageData: record('putImageData'),
  };
  return ctx;
}

/** Attach a fresh recording context to a stub canvas element. */
export function attachContext2d(el) {
  const ctx = makeContext2d(el);
  // Read through to the attribute map: the parser sets `width`/`height` after
  // the element exists, and the draw code reads `ctx.canvas.width`.
  Object.defineProperty(el, 'width', { configurable: true, get: () => Number(el.attrs.width) || 300 });
  Object.defineProperty(el, 'height', { configurable: true, get: () => Number(el.attrs.height) || 150 });
  el.getContext = (type) => (type === '2d' ? ctx : null);
  return ctx;
}

export function makeEl(tagName = 'div', doc = null) {
  const el = {
    tagName: String(tagName).toLowerCase(),
    uid: ++uid,
    style: makeStyle(),
    attrs: {},
    children: [],
    parentElement: null,
    ownerDocument: doc,
    classes: new Set(),
    listeners: {},
    textContent: '',
    value: '',
    disabled: false,
    focused: 0,
    _html: null,

    get classList() {
      const classes = this.classes;
      return {
        add: (...cs) => cs.forEach((c) => c && classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        toggle: (c, force) => {
          const on = force !== undefined ? force : !classes.has(c);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
        contains: (c) => classes.has(c),
      };
    },

    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'id') this.id = String(v);
      if (k === 'class') {
        this.classes = new Set(String(v).split(/\s+/).filter(Boolean));
      }
      if (k === 'value') this.value = String(v);
      if (k === 'disabled') this.disabled = true;
    },
    getAttribute(k) {
      if (k in this.attrs) return this.attrs[k];
      if (k === 'class') return [...this.classes].join(' ');
      return null;
    },
    hasAttribute(k) {
      return k in this.attrs || (k === 'class' && this.classes.size > 0);
    },
    removeAttribute(k) { delete this.attrs[k]; },

    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
    },
    /** Fire at this element with capture-then-bubble, as the real DOM does. */
    dispatch(type, ev = {}) {
      const event = {
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.stopped = true; },
        ...ev,
        type,
        target: ev.target || this,
        currentTarget: this,
      };
      // A caller-supplied preventDefault is how a test asserts that a handler
      // claimed the event, so it must survive rather than be replaced.
      if (typeof ev.preventDefault !== 'function') event.preventDefault = () => { event.defaultPrevented = true; };
      // Capture walks down to the target, then the bubble phase walks back up.
      for (let node = this; node; node = node.parentElement) {
        for (const fn of node.listeners[type] || []) {
          if (event.stopped) return event;
          fn.call(node, event);
        }
      }
      return event;
    },

    focus() { this.focused += 1; if (doc) doc.activeElement = this; },
    /** `HTMLElement.click()` — fires the click listeners, as a browser does. */
    click() {
      this.dispatch('click', {});
    },
    contains(node) {
      for (let n = node; n; n = n.parentElement) if (n === this) return true;
      return false;
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      if (this.ownerDocument) child.ownerDocument = this.ownerDocument;
      return child;
    },
    /** `ParentNode.append(...)` — variadic, and accepts strings as text nodes. */
    append(...nodes) {
      for (const node of nodes) {
        if (typeof node === 'string') this.appendChild(makeTextNode(node, this.ownerDocument));
        else if (node) this.appendChild(node);
      }
    },
    prepend(node) {
      const child = typeof node === 'string' ? makeTextNode(node, this.ownerDocument) : node;
      child.parentElement = this;
      this.children.unshift(child);
      if (this.ownerDocument) child.ownerDocument = this.ownerDocument;
    },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parentElement = null;
      return child;
    },
    remove() { if (this.parentElement) this.parentElement.removeChild(this); },
    replaceWith(replacement) {
      const parent = this.parentElement;
      if (!parent || replacement === this) return;
      if (replacement.parentElement) replacement.remove();
      const index = parent.children.indexOf(this);
      parent.children.splice(index, 1, replacement);
      replacement.parentElement = parent;
      replacement.ownerDocument = parent.ownerDocument;
      this.parentElement = null;
    },
    insertAdjacentElement(position, element) {
      if (position === 'beforeend') return this.appendChild(element);
      if (position === 'afterbegin') { this.prepend(element); return element; }
      if (position !== 'beforebegin' && position !== 'afterend') {
        throw new Error(`domStub: unsupported insertAdjacentElement position "${position}"`);
      }
      const parent = this.parentElement;
      if (!parent) return null;
      if (element.parentElement) element.remove();
      const index = parent.children.indexOf(this) + (position === 'afterend' ? 1 : 0);
      parent.children.splice(index, 0, element);
      element.parentElement = parent;
      element.ownerDocument = parent.ownerDocument;
      return element;
    },
    /**
     * `insertAdjacentHTML('beforeend', html)`.
     *
     * Only `beforeend` is implemented, which is the only position the app
     * uses; anything else throws rather than guessing, because a silently
     * misplaced panel is a test that passes over a broken drawer.
     */
    insertAdjacentHTML(position, html) {
      if (position !== 'beforeend') {
        throw new Error(`domStub: unsupported insertAdjacentHTML position "${position}"`);
      }
      const fragment = parseFragment(String(html), this.ownerDocument);
      for (const child of [...fragment.children]) this.appendChild(child);
    },

    closest(selector) {
      for (let node = this; node; node = node.parentElement) {
        if (matchesSelector(node, selector)) return node;
      }
      return null;
    },
    matches(selector) { return matchesSelector(this, selector); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const wanted = selector.split(',').map((s) => s.trim()).filter(Boolean);
      const out = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (wanted.some((w) => matchesSelector(child, w))) out.push(child);
          walk(child);
        }
      };
      walk(this);
      return out;
    },
    /** The stub has no layout, so nothing is ever `offsetParent === null`. */
    get offsetParent() { return this.parentElement; },
    get offsetWidth() { return 100; },
    get offsetHeight() { return 40; },

    /**
     * Assigning innerHTML replaces the subtree, as it does in a browser.
     * Parsing is what lets a test reach controls that only exist inside a
     * template literal, which is how most of this UI is built.
     */
    set innerHTML(html) {
      for (const child of [...this.children]) child.parentElement = null;
      this.children.length = 0;
      this._html = String(html);
      const fragment = parseFragment(this._html, this.ownerDocument);
      for (const child of [...fragment.children]) this.appendChild(child);
    },
    get innerHTML() { return this._html ?? ''; },
  };
  el.id = '';
  el.dataset = makeDataset(el);
  // `className` is an alias for the class set, as it is in a browser. Assigning
  // to it must be visible to `classList` and to `.foo` selectors — several UI
  // modules build elements with `el.className = 'a b'` rather than
  // `setAttribute`, and without this the element silently matches nothing.
  Object.defineProperty(el, 'className', {
    configurable: true,
    get() { return [...this.classes].join(' '); },
    set(value) {
      this.classes = new Set(String(value ?? '').split(/\s+/).filter(Boolean));
    },
  });
  Object.defineProperty(el, 'hidden', {
    configurable: true,
    get() { return this.hasAttribute('hidden'); },
    set(value) {
      if (value) this.attrs.hidden = '';
      else delete this.attrs.hidden;
    },
  });
  // Canvas elements need a 2D context for the analytics panels' draw paths.
  if (el.tagName === 'canvas') attachContext2d(el);
  // `textContent` reads through the subtree, as it does in a browser. Reading
  // only the element's own field would make every template-literal label read
  // back as the empty string, which is how a stub starts lying to its tests.
  let ownText = '';
  Object.defineProperty(el, 'textContent', {
    configurable: true,
    get() {
      if (!this.children.length) return ownText;
      return this.children.map((c) => c.textContent).join('');
    },
    set(value) {
      ownText = value === null || value === undefined ? '' : String(value);
      for (const child of [...this.children]) child.parentElement = null;
      this.children.length = 0;
    },
  });
  return el;
}

function matchesCompound(el, compound) {
  let rest = compound;
  let attr;
  ATTR_RE.lastIndex = 0;
  while ((attr = ATTR_RE.exec(rest)) !== null) {
    rest = rest.replace(attr[0], '');
    // `data-tab` lives at `dataset.tab`; every other attribute is looked up in
    // the attribute map. Checking only `dataset` would make
    // `input[type="range"]` silently match nothing.
    if (attr[1].startsWith('data-')) {
      const key = attr[1].slice(5);
      if (attr[2] !== undefined) {
        if (String(el.dataset[key] ?? '') !== attr[2]) return false;
      } else if (!(key in el.dataset)) return false;
    } else if (attr[2] !== undefined) {
      if (String(el.attrs[attr[1]] ?? '') !== attr[2]) return false;
    } else if (!(attr[1] in el.attrs)) return false;
    ATTR_RE.lastIndex = 0;
  }
  const id = /#([\w-]+)/.exec(rest);
  if (id && el.id !== id[1]) return false;
  rest = rest.replace(/#[\w-]+/g, '');
  const classes = [...rest.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const tag = rest.replace(/\.[\w-]+/g, '').replace(/[>+~]/g, '').trim();
  if (tag && el.tagName !== tag.toLowerCase()) return false;
  return classes.every((c) => el.classes.has(c));
}

/**
 * Match a descendant selector: `a b` matches an element that is `b` and has an
 * ancestor matching `a`.
 *
 * Implemented by walking ancestors rather than by requiring every compound to
 * match the *same* element, which would silently never match — and a selector
 * engine that quietly returns nothing is how a stub starts lying to its tests.
 */
export function matchesSelector(el, selector) {
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  return matchesParts(el, parts);
}

function matchesParts(el, parts) {
  if (!parts.length) return true;
  if (!matchesCompound(el, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (matchesParts(node, parts.slice(0, -1))) return true;
  }
  return false;
}

/** A text node: contributes its text and nothing else. */
function makeTextNode(text, doc) {
  const node = makeEl('#text', doc);
  node.textContent = text;
  return node;
}

/**
 * Parse a well-formed HTML fragment into stub elements.
 *
 * Throws on anything it does not understand. A parser that guesses produces a
 * tree that looks plausible and wires nothing, which is worse than no test.
 */
export function parseFragment(html, doc) {
  const root = makeEl('#fragment', doc);
  const stack = [root];
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  const VOID_OK = new Set([...VOID_TAGS]);

  for (const token of tokens) {
    const top = stack[stack.length - 1];
    if (!token.startsWith('<')) {
      const text = token.trim();
      if (text) top.appendChild(makeTextNode(text, doc));
      continue;
    }
    if (token.startsWith('</')) {
      const name = token.slice(2, -1).trim().toLowerCase();
      if (stack.length < 2) throw new Error(`domStub: stray </${name}>`);
      const open = stack[stack.length - 1];
      if (open.tagName !== name) {
        throw new Error(`domStub: </${name}> closes <${open.tagName}>`);
      }
      stack.pop();
      continue;
    }
    const selfClosing = token.endsWith('/>');
    const body = token.slice(1, selfClosing ? -2 : -1).trim();
    const nameMatch = body.match(/^([a-zA-Z][\w-]*)/);
    if (!nameMatch) throw new Error(`domStub: cannot read a tag name from <${body}>`);
    const name = nameMatch[1].toLowerCase();
    if (!/^[a-z][a-z0-9]*$/.test(name)) {
      throw new Error(`domStub: unsupported element <${name}> — the stub only parses real HTML tags`);
    }
    const node = makeEl(name, doc);
    const attrRe = /([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    const rest = body.slice(nameMatch[0].length);
    let m;
    while ((m = attrRe.exec(rest)) !== null) {
      const attrName = m[1];
      const value = m[3] ?? m[4] ?? m[5] ?? '';
      node.setAttribute(attrName, value);
      if (attrName.startsWith('data-')) node.dataset[attrName.slice(5)] = value;
    }
    if (name === 'input' || name === 'textarea') node.value = node.getAttribute('value') || '';
    top.appendChild(node);
    if (!selfClosing && !VOID_OK.has(name)) stack.push(node);
  }
  if (stack.length !== 1) {
    throw new Error(`domStub: unclosed <${stack[stack.length - 1].tagName}>`);
  }
  return root;
}

/** Install a stub document/global. Returns handles for arranging the tree. */
export function installDom() {
  const doc = {
    activeElement: null,
    listeners: {},
    createElement(tag) { return makeEl(tag, doc); },
    createTextNode(text) {
      const node = makeEl('#text', doc);
      node.textContent = text;
      return node;
    },
    getElementById(id) {
      let found = null;
      const walk = (node) => {
        for (const child of node.children) {
          if (child.id === id && !found) found = child;
          walk(child);
        }
      };
      walk(doc.body);
      return found;
    },
    querySelector(selector) { return doc.body.querySelector(selector); },
    querySelectorAll(selector) { return doc.body.querySelectorAll(selector); },
    addEventListener(type, fn) { (doc.listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      doc.listeners[type] = (doc.listeners[type] || []).filter((f) => f !== fn);
    },
    /** Fire a document-level event, as a real keydown would arrive. */
    dispatch(type, ev = {}) {
      for (const fn of doc.listeners[type] || []) fn({ type, preventDefault() {}, ...ev });
    },
  };
  doc.body = makeEl('body', doc);
  // Panels inject their own stylesheets into <head>; without it they throw.
  doc.head = makeEl('head', doc);
  doc.documentElement = makeEl('html', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  globalThis.document = doc;
  globalThis.window = { innerHeight: 800, innerWidth: 1200, addEventListener: () => {} };
  globalThis.localStorage = makeStorage();
  return doc;
}

/** An in-memory localStorage, since the real one does not exist in node. */
export function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    _map: map,
  };
}
