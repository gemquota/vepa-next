/**
 * VEPA4 — shared selection context.
 *
 * The DATA drawer had six read-only grids describing the same world from
 * different angles, with no way to say "this one". INTELLIGENCE showed clusters,
 * ECO showed species, CIVILIZATION showed polities, DNA ANALYTICS showed traits
 * — so answering "what is happening to species 3?" meant holding four numbers in
 * your head and cross-referencing by eye.
 *
 * One selection, owned here, broadcast as `selection:changed`. Panels subscribe;
 * they never own it. That is the whole design: a second owner is how a UI ends
 * up with two panels claiming different things are selected.
 *
 * Deliberately DOM-free and bus-optional so it can be tested without either.
 */

/** The two things a panel can select. `null` on a field means "not that kind". */
export const SELECTION_KINDS = Object.freeze(['species', 'group']);

const EMPTY = Object.freeze({ species: null, group: null });

/** Normalise anything a panel hands us into `{species, group}` or null. */
function normalise(next) {
  if (!next) return null;
  const species = next.species === undefined || next.species === null ? null : Number(next.species);
  const group = next.group === undefined || next.group === null ? null : Number(next.group);
  if (species !== null && !Number.isFinite(species)) return null;
  if (group !== null && !Number.isFinite(group)) return null;
  if (species === null && group === null) return null;
  return { species, group };
}

function same(a, b) {
  return a.species === b.species && a.group === b.group;
}

/**
 * Create a selection context.
 *
 * @param {object} [bus] optional; when given, every real change is broadcast as
 *   `selection:changed` with the full selection
 * @returns {{
 *   get: () => {species: number|null, group: number|null},
 *   isEmpty: () => boolean,
 *   matches: (kind: string, id: number) => boolean,
 *   select: (next: object|null) => boolean,
 *   clear: () => boolean,
 * }}
 */
export function createSelectionContext(bus = null) {
  let current = EMPTY;

  function publish() {
    if (bus && typeof bus.emit === 'function') {
      bus.emit('selection:changed', { ...current });
    }
  }

  return {
    /** The live selection. Frozen, so a panel cannot mutate it in place. */
    get() {
      return current;
    },

    isEmpty() {
      return current.species === null && current.group === null;
    },

    /**
     * Is this kind/id the selected one? The check every panel's render loop
     * needs, in one place so "focused" never means two different things.
     */
    matches(kind, id) {
      if (!SELECTION_KINDS.includes(kind)) return false;
      const key = kind === 'species' ? 'species' : 'group';
      return current[key] !== null && current[key] === Number(id);
    },

    /**
     * Set the selection. Returns true when it actually changed, so a caller can
     * skip a redraw. Selecting the same thing twice is not a change.
     */
    select(next) {
      // A malformed payload is rejected, not treated as a clear: silently
      // emptying the selection because someone passed a string would hide the
      // bug behind a panel that quietly stopped filtering.
      const value = normalise(next);
      if (value === null && next !== null && next !== undefined) return false;
      const target = value || EMPTY;
      if (same(current, target)) return false;
      current = Object.freeze(target);
      publish();
      return true;
    },

    clear() {
      return this.select(null);
    },
  };
}
