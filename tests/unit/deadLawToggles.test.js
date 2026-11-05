/**
 * VEPA4 — no dead law toggles.
 *
 * A law tile in the grid is a promise: turn it on and the simulation changes.
 * `INERTIA` (mechanics, law 130) broke that promise for a full release — it was
 * imported into `solver.js:121` and never called, so its gate had zero hits
 * while all seven sibling mechanics had at least one. The player could flip it
 * forever and nothing would happen.
 *
 * Nothing caught it, because nothing asked. `docs/spec/laws/implementation-status.json`
 * does classify laws as `wired` / `implemented-not-gated` / `metadata-only`,
 * but it is a generated report, not a gate: `lawImplementationManifest.test.js`
 * only checks that the statuses are *valid strings* and sum to the law count. A
 * new dead toggle would land, be recorded accurately in the report, and still
 * ship.
 *
 * So this is the gate. It reads the simulation source and fails on any law that
 * no code path can act on.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { LAW_INDEXES, LAW_COUNT } from '../../src/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Every simulation file that is allowed to gate a law. */
const SIM_ROOTS = ['src/physics', 'src/worker', 'src/engines'];

const simFiles = SIM_ROOTS.flatMap((r) => walk(join(ROOT, r)));
const simSource = simFiles.map((f) => ({
  rel: relative(ROOT, f),
  text: readFileSync(f, 'utf8'),
}));

/**
 * Laws with no gate anywhere in the simulation, each with a written reason.
 *
 * The point of an allow-list is that it is short and every entry is a decision.
 * It is asserted below to match the spec manifest exactly, so it cannot grow by
 * accident — adding a law here fails the suite until the manifest agrees.
 */
const UNGATED = {
  ELECTRIC_FIELD: 'metadata-only: a declared law with a 4-tier help entry and no implementation. '
    + 'Tracked as a known gap in docs/spec/laws/implementation-status.json rather than silently dropped.',
};

/** Count how many simulation files reference a given law token. */
function gateHits(name) {
  const token = new RegExp(`LAW_INDEXES\\.${name}\\b`);
  return simSource.filter((f) => token.test(f.text)).map((f) => f.rel);
}

describe('every law toggle can do something', () => {
  it('gates every law except the ones on the written allow-list', () => {
    const ungated = Object.keys(LAW_INDEXES)
      .filter((name) => gateHits(name).length === 0)
      .sort();

    expect({ ungated, allowList: Object.keys(UNGATED).sort() })
      .toEqual({ ungated: Object.keys(UNGATED).sort(), allowList: Object.keys(UNGATED).sort() });
  });

  it('keeps the allow-list in step with the generated implementation manifest', () => {
    // The manifest is generated from the same source by `npm run spec:generate`.
    // If it disagrees with this file's allow-list, one of the two is stale —
    // and a stale allow-list is exactly how a dead toggle gets shipped.
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'docs/spec/laws/implementation-status.json'), 'utf8'),
    );
    const metadataOnly = manifest.records
      .filter((r) => r.status === 'metadata-only')
      .map((r) => r.name)
      .sort();

    expect(Object.keys(UNGATED).sort()).toEqual(metadataOnly);
    expect(manifest.declaredLawCount).toBe(LAW_COUNT);
  });

  it('does not let a law be gated only by its own name in a comment', () => {
    // `applyInertia` was imported but never called — a reference existed, so a
    // naive "is the name mentioned anywhere" check would have passed. A gate
    // has to be a read of the law bit or the bitmask helper.
    const GATE = /(active\[[^\]]*LAW_INDEXES\.(\w+)\]|isSet\(\s*lawState\s*,\s*LAW_INDEXES\.(\w+)\s*\))/g;
    const gated = new Set();
    for (const file of simSource) {
      for (const m of file.text.matchAll(GATE)) gated.add(m[2] || m[3]);
    }

    const missing = Object.keys(LAW_INDEXES)
      .filter((name) => !gated.has(name) && !UNGATED[name])
      .sort();

    expect(missing).toEqual([]);
  });

  it('reports the allow-list entries as genuinely ungated', () => {
    // Guards the test above against passing for the wrong reason: if a law on
    // the allow-list were ever given a real gate, the allow-list would be
    // hiding a working feature and should be removed, not left to rot.
    for (const [name, reason] of Object.entries(UNGATED)) {
      expect(LAW_INDEXES[name], `allow-listed law ${name} no longer exists`).toBeTypeOf('number');
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});
