// ============================================================================
// VEPA4 — Clipboard helper
//
// debug.js and ui/settingsPanel.js each shipped a byte-identical
// execCommand('copy') fallback. Centralised here so the "copy to clipboard"
// button behaves the same in both places.
//
// See docs/CODEBASE-AUDIT-2026-09-30.md §2.1 (DUP-2).
// ============================================================================

/**
 * Copy text to the clipboard via the async Clipboard API, falling back to a
 * hidden textarea + execCommand when the API is unavailable or rejects
 * (non-secure contexts, denied permission, older browsers).
 *
 * @param {string} text
 * @returns {Promise<boolean>} true if the async API path succeeded
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  fallbackCopy(text);
  return false;
}

/** Legacy execCommand copy. Never throws; used only as a fallback. */
export function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}
