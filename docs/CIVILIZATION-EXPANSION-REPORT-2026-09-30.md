# VEPA4 — Civilization Expansion & Structural Reconciliation Report

**Date:** 2026-09-30
**Version:** 9.1.22
**Covers:** structural reconciliation (A9, H2, H3, H6) and the group / culture /
civilization expansion, including a gap analysis and a phased plan for what
remains.

---

## 1. Verification

```
npm test                 ✅ 987 passed (112 files)   ← was 951 / 109
npm run syntax-check     ✅ clean
npm run spec:check       ✅ passed (180 generated files)
npm run repository:check ✅ passed (136 laws, provenance + signoff valid)
npm run build            ✅ built
```

Net **+36 tests**, all gates green.

---

## 2. Structural reconciliation

### H2 — `laws/` duplicate corpus ✅ RESOLVED (3.0 MB reclaimed)

`laws/a3/**` was **397 of 398 files byte-identical** to `docs/audit/laws/a3/**`
(3.0 MB). Nothing in `src/`, `scripts/`, `tests/`, `bench/`, `exports/`, or
`package.json` referenced it.

**Trap caught:** the single divergent file was not a stale copy — `laws/a3/physics.md`
contained a **v8.0.0 "Matter & Union" note missing from the `docs/` copy**
(documenting the ACCR true-merger rework and its bonded-pair exclusion). A naive
delete would have silently lost that. The line was merged forward first, then the
tree removed. Corpus went 1,994,990 → 1,995,495 bytes (**+505**, the preserved
line), and all 398 files are now identical.

### H3 — `exports/` non-canonical snapshots ✅ RESOLVED (2.57 MB reclaimed)

Removed `vepa-codebase-full-concat.md` (2.19 MB) and `vepa-codebase-concat.mjs`
(376 KB), and reconciled **four** manifests that referenced them:

- `exports/provenance.json` — new `retired[]` block; the record is no longer
  `provenance-review-required` (its consumer was documented as *unmapped*).
- `exports/publication-plan.json` — `nonCanonical[]` emptied; `retired[]` added.
- `scripts/repository-artifact-report.mjs` — new `RETIRED` inventory section that
  is reported but not expected on disk.
- `exports/generate-full-concat.mjs` — removed the dead `EXCLUDE_FILES` entry and
  two stale doc-map lines referencing a generator that no longer exists.

`vepa-codebase-concat.mjs` was **unregenerable**: its only producer
(`exports/generate-concat.mjs`) did not exist in the repo. Both retired entries
record `recoverableFrom: git history`.

Two contract tests encoded the *unresolved* state and were updated to the new,
stronger contract (952 → recorded-retired-and-recoverable rather than
permanently-unresolved): `batch5Reports.test.js` (+1 test for the retired
boundary) and `provenance.test.js` (now asserts **no** live record is
`provenance-review-required`, and every retired entry carries a recovery
boundary).

### H6 — dual lockfiles ✅ RESOLVED

`AGENTS.md` §1 designates **npm** as the package manager and CI installs with
`npm ci` + `package-lock.json`, making npm the SSOT. `bun.lock` was a second
lockfile for the same dependency set, free to drift silently. It is now
gitignored and untracked from the index; the SSOT decision is recorded in
`AGENTS.md`. Both files remain in the working tree, so local `bun` use is
unaffected — only the committed authority changed.

### A9 — `buffer_global` singleton ⏸️ STAGED (not attempted)

I measured the scope rather than estimating it:

| Item | Count |
|---|---:|
| Exported laws reading `buffer_global` | **45** (+`setBuffer`) |
| Internal helpers reading it | 4 — `readDNA`, `clearEntangleLink`, HISTORY accessors |
| Call sites in `solver.js` | **37** |
| Call sites in tests | **48** across 6 files |
| Second module singleton (HISTORY) | 4 module variables |

**Why staged rather than done:** the transformation is uniform but the blast
radius is the physics hot path. Step 1 alone (add `view` to the 45 signatures)
leaves the tree non-runnable, because the solver would call them with mismatched
arguments. Completing it inside this change set risked leaving the solver
half-migrated — strictly worse than a clean staging point. The work is now
specified in **`docs/A9-MIGRATION-PLAN.md`** with the exact ordered steps, the
full 45-signature inventory, acceptance criteria, and the specific risk notes
(including: do **not** "tidy" the narrower `nanGuard` as part of it).

`tests/unit/lawsSingleton.test.js` (6 tests) now **characterizes** the current
implicit-global behaviour, so the debt is visible in CI and the migration has a
safety net.

---

## 3. Gap analysis — group, culture, civilization

`docs/systems/implementation-gaps.md` lists 12 gaps. The decisive finding was
not in the gap table:

> **`src/state/systemLifecycle.js` — 464 lines, 24 exports, the entire
> cross-system substrate (durable records, causal events, topology, evolution) —
> was imported only by tests.** Not by `main.js`, not by the save path, not
> present in any build chunk. Tested, documented, and never executed.

So the systems weren't merely shallow; their foundation was never running. The
expansion therefore had two halves: **activate the substrate**, then **add the
missing entities on top of it**.

| Gap (from `implementation-gaps.md`) | Before | After |
|---|---|---|
| Cultural transmission | signal/memory/culture laws only | Explicit symbol/norm objects with per-item fidelity, mutation, loss, reinvention, and a ledger |
| Tribe / clan | groups + alliances | Federation entities with typed edges, fission (incl. collapse into a clan), fusion |
| Nation / polity | group governance | Polity entities with jurisdiction, provinces, citizenship, institutions, succession |
| Kin / family | ancestry records only | Kin edges, households, need-weighted kin resource flow |
| Individual recognition | particle memory | Stable pair keys; pruning on death |
| Substrate activation | **dead code** | Instantiated in `boot()`, stepped on the social cadence, saved/restored, rendered |

## 4. What was implemented

**`src/state/civilization.js`** (new, ~600 lines) — four systems on the existing
lifecycle substrate:

- **Culture** — `foundCulture`, `transmitCulture` (vertical/horizontal, per-item
  buckets, deterministic rolls so replay is reproducible), `updateCultureCohesion`.
- **Kinship** — `recordKin`, `getKin`, `kinStrength`, households, `flowKinResources`.
- **Federation** — `createFederation`, `addFederationMember`, `linkFederation`,
  `fissionFederation` (with viability threshold and clan split), `fuseFederations`.
- **Polity** — `foundPolity`, `claimTerritory`, `addProvince`, citizenship grant/
  revoke, `foundInstitution`, `nominateSuccessor` / `installSuccessor`.

Every mutation goes through `updateSystemRecord` / `recordSystemEvent`, because
**`createSystemRecord` returns a clone** — the first implementation mutated
snapshots and silently did nothing; 8 of 20 tests caught it. Reading via
`live()` and writing via `patchAttrs()` is now enforced by construction and
documented in the module header.

**Runtime wiring** (closing the dead-code gap):
- `main.js`: created in `boot()`, stepped inside the existing `SOCIAL_CADENCE`
  block, emits `civilization:analytics` with the other 30-tick analytics,
  reset in `resetIntelligence()`, and included in world save/restore.
- `worldSave.js`: `civilization` added as an **additive, backward-compatible**
  field — saves predating the ontology simply restore an empty registry.
- `src/ui/civilizationPanel.js`: dashboard built on the `analyticsPanel` shell
  from the A8 refactor, reusing it rather than re-introducing panel scaffolding.
- `systemFoundation.js`: evidence levels corrected — `family-kinship` and
  `group-tribe-clan` were `scaffold` (identity only); they are now `proxy`, with
  the new source anchor. Kept at `proxy`, not `implemented`, because the cultural
  model is explicit accounting, not measurement.

**Tests: 987 (was 951).** `civilization.test.js` (20), `civilizationWiring.test.js`
(8), `lawsSingleton.test.js` (6), plus updated contract tests.

---

## 5. Multi-phase plan for the remaining work

Phases 1–2 of the `implementation-gaps.md` sequence are now closed. Remaining,
in priority order:

| Phase | Scope | Status |
|---|---|---|
| **1** | Sparse relationship graph with stable pair keys + save/restore | ✅ **done** (kin edges + households) |
| **2** | Kin edges and care/resource transfer | ✅ **done** (`flowKinResources`) |
| **3** | Group-to-group federation + shared cultural memory | 🟡 **partial** — federation done; culture sharing is `transmitCulture` but is not yet auto-fed from alliance events in `main.js` |
| **4** | Durable structures: ownership, maintenance, dependencies | ⛔ not started (`artifacts.js`/`infrastructure.js` are proxies) |
| **5** | Multi-epoch continuity metrics + regime catalog | ⛔ not started (`epochEngine` has eras; continuity metrics do not exist) |
| **6** | Codex explanations from evidence, never from law names | ⛔ not started |

**Next concrete slice (Phase 3 completion)** — the smallest high-value step:
when `runGovernance` reports an alliance, call `transmitCulture` between the two
groups' cultures on the social cadence. This closes the loop between the
existing governance system and the new culture system, and is a few lines in
`main.js` plus one test.

**Also still open**, carried from the first audit: A10 (shared `render/core.js`),
A11 (split `multiplex.js`), A12 (decompose `main.js` singletons) — all structural,
none duplication-critical.

---

## 6. Honest boundaries

- **A9 is not done.** The physics buffer singleton remains. The plan and the
  characterization test are in place; the refactor is not.
- The cultural fidelity model is an **explicit accounting** of what was offered,
  retained, mutated, or reinvented — not a measurement of culture. It is labelled
  `proxy` for that reason.
- Kin recognition is bookkeeping derived from lineage; it does not model
  social kin preference or inbreeding avoidance.
- 34 test assertions were updated because they encoded *pre-reconciliation*
  contracts (3 export snapshots, one permanently-unresolved provenance record,
  a `scaffold` evidence level). Each was updated to assert the new **stricter**
  condition, not merely to pass.

---

## 7. Addendum — Phase 3 completed, and the Phases 4–6 sequel

**Delivered 2026-09-30.** Full design, decisions and verification are in
`docs/CIVILIZATION-SEQUEL-PLAN-2026-09-30.md`; this section only closes the
loop on this report.

**Phase 3 (the slice proposed above) is done.** `transmitBetweenGroups` and
`cultureForGroup` were added to `src/state/civilization.js`, and the
`governance:alliance` branch in `main.js` now calls them at
`CULTURE_ALLIANCE_FIDELITY = 0.45`, emitting `culture:transmitted`. 22 tests.

**Phases 4–6 were then generated from the next three rows of the same gap
table** and implemented: `src/state/structures.js` (durable structures),
`src/state/continuity.js` (multi-epoch continuity + regime catalog) and
`src/state/codex.js` (evidence-cited observer explanations). 155 further
tests, all four files wired into the orchestrator, the panel and the save path.

Two bugs were found and fixed while building them, both of the kind that look
like working code:

1. **A record-id mismatch in the new `main.js` wiring** that would have founded
   a new structure on *every* maintenance pass and leaked records to the
   lifecycle cap. Caught before commit; fixed with a `structureForGroup()`
   owner lookup, and pinned by a negative test on the old pattern.
2. **A pre-existing latent bug in `civilization.js`'s `tally()`** — it wrote
   the bucket name `retained` into a ledger whose readers expect `inherited`,
   so `e.inherited` was permanently `0`. This silently made Phase 5's
   `cultureRetention` always zero and the `thriving` regime unreachable. Found
   only because Phase 5 was written to read that field; it predates this work.

**Suite: 987 → 1164 tests across 117 files, all gates green.** A9, A10, A11 and
A12 remain open and are now listed in the sequel plan.

