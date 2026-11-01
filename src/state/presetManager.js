/**
 * VEPA v3 — Preset Manager (IndexedDB via localStorage fallback)
 * Save/load/delete simulation presets.
 */

const STORAGE_KEY = 'vepa-v3-presets';

function getPresets() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function savePresets(presets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Save a preset with the current simulation state.
 * @param {string} name - Preset name
 * @param {object} state - { lawState, dnaBuffer, worldParams, speciesCount }
 */
export function savePreset(name, state) {
    const presets = getPresets();
    presets[name] = {
        name,
        timestamp: Date.now(),
        lawState: state.lawState ? { low: state.lawState.lowFlags[0], high: state.lawState.highFlags[0] } : null,
        dnaBuffer: state.dnaBuffer ? Array.from(state.dnaBuffer) : null,
        worldParams: state.worldParams || {},
        speciesCount: state.speciesCount || 5,
    };
    savePresets(presets);
    return true;
}

/**
 * Load a preset by name.
 * @param {string} name
 * @returns {object|null} preset state or null
 */
export function loadPreset(name) {
    const presets = getPresets();
    return presets[name] || null;
}

/**
 * List all saved preset names.
 * @returns {string[]}
 */
export function listPresets() {
    return Object.keys(getPresets()).sort();
}

/**
 * Delete a preset by name.
 * @param {string} name
 */
export function deletePreset(name) {
    const presets = getPresets();
    delete presets[name];
    savePresets(presets);
}

/**
 * Export all presets as JSON string.
 */
export function exportPresets() {
    return JSON.stringify(getPresets(), null, 2);
}

/**
 * Import presets from JSON string.
 */
export function importPresets(json) {
    try {
        const data = JSON.parse(json);
        savePresets(data);
        return true;
    } catch {
        return false;
    }
}
