# intent.md — "The World Remembers" · The D·G·H Trilogy (trilogy² → trilogy³ arc)

**Session:** RRP v1.3.0 (manual mode — no runtime CLI in repo)
**Date:** 2026-08-18 · **Status:** Design complete, build order locked
**Preceded by:** E·F·A trilogy (E.1 v8.2.0 · F v8.3.0 · A v8.4.0) — the first trilogy of the "trilogy of trilogies" arc.

## Goal
Three release sets — **D · Deep Time & Epochs**, **G · Memory & Culture**, **H · Agency & Narrative** — built on the E·F·A substrate. Where E·F·A made the dish *exist* (fields → civilizations → living world), D·G·H makes it *remember and act*. Shipping from **v8.6.0**; each set gets the next version when it lands.

## Shared substrate (reused, unchanged)
- **EventBus + metrics ring** (A.2) — one thin subscriber; trends/events read the ring.
- **`writeField` API** (E.1) — the single field-write entry point for epoch/agency responses.
- **Undo ring + `captureWorldState`/`restoreWorldState`** (v7.4+) — reversible nudges + era snapshots.
- **`runtimeConfig.simSpeed`** — already multiplies solver dt; D.2 exposes it as a live knob.
- **Timeline / lineage / narrative / goal engines** — D restores eras; H makes narrative an actor.
- Release gates: syntax + vitest + build (no fixed ladder; deterministic seed already in saves).

## Set D — Deep Time & Epochs (`src/engines/epochEngine.js`) — v8.6.0
- **Eras:** the world advances through named epochs on a tick boundary (`EPOCH_LENGTH`); each boundary snapshots the full world (era snapshot) so any era can be restored.
- **Extinction / recovery:** population collapse past `EXTINCTION_THRESHOLD` marks an extinction; rebound past `RECOVERY_THRESHOLD` marks a recovery — both are epoch-anchored events.
- **Time controls:** new TIME world-param group — `TIME_SPEED` (0.1–10 → `runtimeConfig.simSpeed`), `EPOCH_LENGTH`, `EXTINCTION_THRESHOLD`, `RECOVERY_THRESHOLD`. Pause/fast/slow is now a real solver-dt change, not just UI.
- **Reversible response:** extinction/recovery commit an undo checkpoint first, then write INFO-field drought/fertilization cells (same pattern as A.3 world events) and journal.

## Set G — Memory & Culture (`src/state/memoryBuffers.js`) — v8.7.0
- **Persistent buffers:** per-species and per-group memory vectors (Float32Array) that survive individual particles and generations — unlike the per-particle stride cache.
- **Cultural transmission:** learned traits propagate parent→offspring and group→recruit alongside DNA (not in the genome), seeded by `CULTURAL_TRANSMISSION`.
- **Behavioral adaptation:** species/group activity shifts from field/world conditions (drought = seek INFO wells, bloom = disperse, threat = clump) via memory thresholds + the metrics ring.

## Set H — Agency & Narrative (`src/engines/agencyEngine.js`) — v8.8.0
- **Narrative as actor:** the Narrative Consciousness gains bounded hands — it can toggle a law, nudge a world param, or write a field cell, always through an undo-ring checkpoint and journaled.
- **Goal-driven species:** per-species behavioral goals (seek resources / flee threats / defend nests) expressed as velocity nudges on the main thread after the solve.
- **World milestones:** emergent "quests" (first speciation, first civilization, first collapse, era milestones) detected from metrics and journaled to the narrative log.

## Decisions log
| # | Decision | Choice |
|---|----------|--------|
| D.1 | eras | tick-boundary epochs with restorable full-world snapshots |
| D.2 | time | `TIME_SPEED` knob → `runtimeConfig.simSpeed` (solver dt) |
| D.3 | extinction/recovery | threshold-gated population deltas, epoch-anchored |
| G.1 | memory store | JS-side per-species/per-group Float32Array (not stride) |
| G.2 | culture | trait copy parent→offspring + group→recruit, gated by CULTURAL_TRANSMISSION |
| G.3 | adaptation | metric+field driven activity shift, bounded nudges |
| H.1 | agency power | bounded autonomous writes through undo ring + journal |
| H.2 | goals | post-solve velocity nudges, per-species goal state |
| H.3 | milestones | metric-triggered, once-only, journaled |

## Risks
1. **Era snapshot memory** — full-world snapshots are ~1 MB each; cap eras (e.g. 16) with oldest evicted.
2. **Time knob explosion** — extreme `TIME_SPEED` amplifies dt; clamp to the solver's stability envelope.
3. **Culture → stride drift** — culture lives in JS buffers, must be kept in sync with species slots after speciation/extinction.
4. **Agency storms** — the actor must be rate-limited + reversible (undo checkpoint per action).
5. **Goal nudges vs. physics** — velocity nudges must stay under MAX_FORCE/MAX_VELOCITY.

## Out of scope (shelved)
- Fission (group reproduction) — still a one-liner if wanted.
- Golden-run tick-trace tests.
- A fourth trilogy (completing the literal 3×3×3 "trilogy³") — design deferred until D·G·H ships.
