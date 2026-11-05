# Civilization sequel — Phases 4–6

**Status:** implemented and gated. Extends
`docs/CIVILIZATION-EXPANSION-REPORT-2026-09-30.md` (round 2, Phases 1–3).
**Date:** 2026-09-30 · **Baseline:** VEPA4 9.1.22 · **Branch:** `main`

## Where this came from

Round 2 closed the four ontology gaps that had runnable proxies but no entity
representation (culture, kin, federation, polity) and left the remaining five
rows of `docs/systems/implementation-gaps.md` open. Phase 3 finished the
"cultural transmission" row by wiring horizontal transfer into the social stack.
Phases 4–6 below were generated from the *next three* rows of that same table,
in the order the table's own "Recommended next implementation sequence" lists
them:

| # | Table row | Phase | Module |
|---|---|---|---|
| 4 | Structure ownership | P2 | `src/state/structures.js` |
| 5 | Civilization continuity | P2 | `src/state/continuity.js` |
| 6 | Codex ontology | P3 | `src/state/codex.js` |

---

## Phase 4 — durable structures (`src/state/structures.js`)

**Gap closed.** "Structure ownership \| field writes and artifacts \| durable
object registry, ownership, maintenance, dependencies."

Structures previously existed only as field-cell writes and treasury
artifacts, so nothing had an owner, upkeep, or a dependency. This adds nine
kinds (NEST, HIVE, WALL, ROAD, HUB, BRIDGE, STOREHOUSE, SHRINE, GUILDHALL)
hosted as `infrastructure` records on the shared lifecycle substrate.

- **Ownership** is a causal event (`ownership-transferred`), never a silent
  overwrite. Dependencies are first-class: a structure whose dependency is
  gone reports **dormant** and stays standing, which is deliberately
  distinguishable from **collapsed**. Collapsing closes the record with a
  reason.
- **Upkeep** is paid from the group treasury at a per-kind cost. A group that
  cannot pay is treated *exactly* like an unmaintained one — the path must not
  quietly rescue the poor — and emits `upkeep-unaffordable` so the difference
  is visible.
- **Runtime.** `runMaintenance` runs on `STRUCTURE_MAINTENANCE_INTERVAL` (8),
  not the social cadence (4), because upkeep every 4 ticks drains treasuries
  far too fast. Upkeep is deliberately partial: the top
  `STRUCTURE_UPKEEP_RATIO` (35%) of groups by treasury are funded, so a society
  that cannot pay for all of its buildings visibly loses some of them. That is
  the entire point of modelling ownership.

**Bug caught during wiring.** My first `main.js` existence check was
`civilization.lifecycle.records.has('infrastructure:group:' + g.id)`. Record
ids are allocated by the substrate as `infrastructure:<n>`, so that check could
never match and would have founded a **new nest on every maintenance pass**,
leaking records to the 2048 cap. Fixed by adding `structureForGroup()` as the
supported owner lookup — the same pattern `cultureForGroup()` already uses.
`civilizationSequelWiring.test.js` now asserts the bad pattern never returns.

## Phase 5 — multi-epoch continuity (`src/state/continuity.js`)

**Gaps closed.** "Civilization \| cumulative culture and multi-group continuity
across member turnover" and the first half of "Codex ontology".

`epochEngine` recorded era boundaries but nothing compared the world either
side of one. This samples a fingerprint of the *social* world at each boundary
and diffs it against the previous sample, yielding seven regimes (`thriving`,
`settled`, `strained`, `fragmenting`, `collapsing`, `empty`, `emergent`), each
with evidence, a confidence, and a rationale.

**The fingerprint deliberately excludes law state, particle counts and physics
metrics.** A regime is a description of a society, so it must be derivable from
the society. `captureContinuityFingerprint` takes no law-state parameter at
all, so there is nothing to smuggle one in through.

Naming is ordered by severity, so the most serious diagnosis wins when several
conditions hold simultaneously. Below `MIN_EVIDENCE` (3) or 0.6 confidence a
regime is recorded but explicitly *not* well-evidenced.

**Bug caught here — a cross-phase silent failure.** `civilization.js`'s
`tally()` initialised each ledger entry as `{ inherited, mutated, invented,
lost }` but then incremented `ledger[item][field]` where `field` is the
transmission *bucket* name, `'retained'`. So the ledger accumulated a
`retained` key that nothing read, while `e.inherited` stayed `0` forever.
Phase 5 sums `e.inherited` to compute `cultureRetention`, which means the
`thriving` regime was **unreachable** — the code looked correct and would
simply never fire. `tally` now normalises `'retained' → 'inherited'`, with a
comment explaining the two vocabularies, and
`cultureTransmission.test.js` pins the exact ledger key set so the two names
cannot drift apart again.

## Phase 6 — the Codex (`src/state/codex.js`)

**Gap closed.** "Codex ontology \| narrative and analytics \| observer-generated
regime names with evidence and confidence" — step 6 of the table's sequence:
"Build Codex explanations from evidence, never from law names alone."

The rule this phase exists to enforce is *negative*, and a comment is not a
guarantee, so it is enforced twice:

1. **Structural.** `explainRegime(entry, opts)` takes a continuity entry and
   nothing else — no parameter through which law state could arrive. Every
   evidence token must match a stem in `SOCIAL_EVIDENCE`; anything else is a
   thrown error, never a guess. The stored record keeps the *stem*
   (`member-retention`), never the raw token (`member-retention-0.42`).
2. **Textual.** `findLawAttribution` scans the finished prose for law
   identifiers and `recordCodexEntry` **refuses to file** an entry that fails,
   recording the refusal in a bounded ring that the UI surfaces. This catches
   what the structural check cannot: a template edit that reintroduces a law
   name into the wording.

Below the gate the observer is *required* to say it does not know —
`explainRegime` returns the hedge text instead of the claim, and `main.js`
routes it to `codex:uncertain` rather than `codex:regime`.

**Calibration, documented rather than hidden.** The prose scan only matches law
identifiers of ≥5 characters, or any containing an underscore. `LIFE`, `HEAT`,
`VOID`, `MIND` and `WILL` are four-letter keys that are also ordinary English;
scanning them would make the guard fire on a sentence about a society's *life*.
`LAW_SCAN_MIN_LENGTH` is exported so the rule is auditable and testable.

**The guard caught my own prose.** This repository has laws literally named
`CULTURE`, `OBSERVER` and `PATTERN` — all three ordinary words in this domain.
The first draft of the templates used all three, and the guard correctly
refused to file *every single statement*. The templates were reworded around
the collisions rather than the dictionary weakened, because a narrowed
dictionary would let a genuine law citation through unnoticed. Two regression
tests pin both halves: that the shipped prose stays clear, and that all seven
regimes file successfully under the real dictionary.

---

## Wiring

All three phases are hosted by the existing `civilization` lifecycle and ride
the existing CIVILIZATION dashboard rather than claiming new tabs — they are
one story, not three.

- `structures = createStructureRegistry(civilization.lifecycle)` at boot, in
  `resetIntelligence()`, and re-pointed after `restoreCivilization()` (a
  restored save carries a *new* lifecycle object, so the registry must be
  re-hosted or every record lookup silently misses).
- `runMaintenance` on tick 8 → `structures:pass`.
- `recordEraContinuity` + `recordCodexEntry` on `epoch:boundary` only. Sampling
  continuity per tick would compare a world against itself and manufacture fake
  stability.
- Four new panel cells: STRUCTURES, REGIME, CONFIDENCE, CODEX, plus an
  evidence line showing how much is actually behind the regime name. A missing
  sub-report renders as `—`, never `0`, so "not measured yet" is never
  displayed as "measured as zero".
- `codex` is an additive `worldSave` field; saves predating it restore to an
  empty catalog rather than erroring.

## Verification

| Gate | Result |
|---|---|
| `bun run syntax-check` | pass |
| `bun run test` | **1164 passed / 1164** (117 files; was 987/112) |
| `bun run spec:generate` → `spec:check` | pass (180 files) |
| `bun run repository:check` | pass |
| `node scripts/validate-provenance.mjs` | pass |
| `node scripts/validate-signoff.mjs` | pass |
| `node scripts/check-export-publication.mjs` | pass |
| `node scripts/audit-corpus-report.mjs` | pass, 398 files, 0 duplicates, nothing modified |
| `bun run build` | pass, built in 674 ms |

New tests: `cultureTransmission` (22), `structures` (49), `continuity` (31),
`codex` (45), `civilizationSequelWiring` (30) = **177**.

Bundle check — the phases are live, not dead code: `structure-founded`,
`upkeep-unaffordable`, `no-surviving-groups`,
`institutions-and-culture-persisting`, `law attribution in prose`,
`culture:transmitted`, `structures:pass`, `codex:regime` and `codex:uncertain`
all present in `dist/assets/main-*.js`.

## What is still only a proxy

Unchanged from round 2, and deliberately not overclaimed:

- Structures **record** ownership, upkeep and condition. They do not write
  field cells; `construction.js` still owns the physical terrain.
- Culture fidelity remains a hash roll, not a learned transmission model.
- Federation, polity and succession remain single-registry simulations with no
  inter-world persistence.
- The codex narrates; it does not yet feed back into the simulation.
- Evidence level for every culture model stays `proxy`, never `implemented`.

## Open (carried forward, unanswered)

- **A9** — staged `laws.js` `buffer_global` singleton migration. 85 call sites
  (37 in `solver.js`, 48 in 6 test files). Plan: `docs/A9-MIGRATION-PLAN.md`.
- **A10** — shared `render/core.js`.
- **A11** — split `multiplex.js`.
- **A12** — decompose `main.js` singletons. Now *more* valuable: `main.js` grew
  by roughly 90 lines this round and holds eight sibling module-level registries.
