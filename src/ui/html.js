/**
 * VEPA4 — HTML escaping for the drawer's string-built markup.
 *
 * The panels build their DOM with template literals, so anything that comes
 * from the simulation, a preset file or a user's saved world ends up inside
 * `innerHTML`. That makes escaping a correctness surface rather than a
 * convenience, and it used to be four private copies of the same helper in the
 * UI modules — all of which escaped `& < > "` and none of which escaped `'`.
 *
 * The missing apostrophe is the bug that justified the shared module. Three of
 * those copies were used on attributes — `title="${esc(label)}"`,
 * `aria-label="${esc(label)}"`, `data-help-id="${esc(id)}"` — and a preset
 * name or help heading containing an apostrophe terminates the attribute early
 * and injects the rest as markup. A helper whose escape set differs by module
 * is not a style question; it means the safe call sites are the ones that got
 * the thorough copy.
 *
 * The mapping is complete for both quoting styles, so one call is correct
 * whether the value lands in text or in a quoted attribute.
 */

const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value for interpolation into HTML text or a quoted attribute.
 *
 * @param {unknown} value coerced with String(); null and undefined become
 *                   their literal text, matching what the panels already showed
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
