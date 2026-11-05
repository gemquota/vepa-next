import { STABLE_LAW_INVENTORY } from './stable-law-inventory.js';

export const LEGACY_LAW_FLAG_SCHEMA_VERSION = 1;
const WORDS = [
  { key: 'low', start: 0, end: 31 },
  { key: 'high', start: 32, end: 63 },
  { key: 'ext', start: 64, end: 95 },
  { key: 'quad', start: 96, end: 127 },
  { key: 'penta', start: 128, end: 135 },
];

export function migrateLegacyLawFlags(legacy = {}) {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) throw new TypeError('legacy law flags must be an object');
  const words = {};
  const warnings = [];
  for (const { key, start, end } of WORDS) {
    const value = legacy[key];
    if (value === undefined || value === null) {
      words[key] = 0;
      warnings.push(Object.freeze({ code: 'missing-law-word', key, firstIndex: start, lastIndex: end }));
      continue;
    }
    if (!Number.isInteger(value) || value < -2147483648 || value > 4294967295) throw new TypeError('legacy law word ' + key + ' must be a 32-bit integer');
    words[key] = value >>> 0;
  }
  const activeLawIds = [];
  for (const law of STABLE_LAW_INVENTORY) {
    const word = WORDS.find(entry => law.stableIndex >= entry.start && law.stableIndex <= entry.end);
    if (!word) throw new Error('No legacy flag word for stable law index ' + law.stableIndex);
    if (((words[word.key] >>> (law.stableIndex - word.start)) & 1) === 1) activeLawIds.push(law.canonicalId);
  }
  return Object.freeze({ sourceSchema: 'vepa.legacy-law-flags.v1', lawInventoryCount: STABLE_LAW_INVENTORY.length, activeLawIds: Object.freeze(activeLawIds), warnings: Object.freeze(warnings) });
}
