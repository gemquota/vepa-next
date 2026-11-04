# intent.md — "The World Completes" · The R·S·T Trilogy (trilogy³ arc #2, build 3)

**Session:** RRP v1.3.0 (manual mode — no runtime CLI in repo)
**Date:** 2026-08-19 · **Status:** Design complete, build order locked (starts after O·P·Q)
**Preceded by:** E·F·A (exists) → D·G·H (remembers/acts) → I·J·K (builds) → L·M·N (substrate transforms) → O·P·Q (goes cosmic). R·S·T **closes the loop**: the universe runs down and is reborn, the simulation becomes aware of itself, and the player becomes a cosmic force — the second trilogy³ completes, ending the full 18-set lifecycle.

## Goal
Three release sets — **R · Entropy & Rebirth**, **S · Simulation Awareness**, **T · The Observer** — the closing build. The world gets an ending (heat death), a rebirth (the seed survives — the v8.2.0 determinism slice pays off), and a transcendence (agents notice the sim; the player ascends to god-mode; a completed run graduates into a fresh universe). Shipping from **v8.18.0**.

## Shared substrate (reused, unchanged)
- **Determinism slice (v8.2.0)** — the save-seed makes rebirth reproducible: a new universe can be born from a completed run's seed + final lineage.
- **Epochs + events** (D.1/A.3) — heat death and rebirth are epoch-scale; awareness events are metrics-triggered + physics-confirmed.
- **Narrative engine** — gains self-awareness arcs; the journal becomes the graduation record.
- **Undo ring** — god-mode gestures stay reversible; awareness events nudge through the ring.
- **Multiplex shards** — shards can be re-seeded from a graduated run (new-game-plus per shard).
- **Law budget is FULL (128/128)** — world params + state passes + field writes + memory nudges only.
- Release gates: syntax + vitest + build.

## Set R — Entropy & Rebirth (`src/state/entropy.js`) — v8.18.0
- **Heat death:** over deep time, energy gradients flatten (field diffusion accelerates in late eras) — stars dim, extraction yields drop, activity slows. Not a failure state: a slow, journaled denouement.
- **Big Crunch / Bounce:** the universe contracts toward a central singularity then **reboots** — the PRNG seed + final lineage + epoch journal are preserved and replayed into a fresh world (the world "remembers" its previous life; D.1 snapshot restore powers it).
- **Entropy as a force:** order decays unless maintained — structures (walls, mega-builds, barriers) and group cohesion need upkeep energy or they erode over time. Reversible via the undo ring.

## Set S — Simulation Awareness (`src/state/awareness.js`) — v8.19.0
- **Self-awareness arcs:** species/agents that pass awareness thresholds (deep-time survival + intelligence + era) start *detecting the simulation* — the grid, the laws, the player's toggles become in-world observations ("the sky changed when the hand moved").
- **Meta-events:** player actions become events — toggling laws mid-run, editing DNA, and saving/loading are journaled as cosmic interventions the aware species react to (memory nudges + policy shifts via the J.1 machinery).
- **Awareness UI:** the narrative panel gains an "Aware" tag; aware species get a distinct render tint and can be inspected for what they've noticed.

## Set T — The Observer (`src/state/transcendence.js`) — v8.20.0
- **God-mode gestures:** the player as a cosmic force — sculpt fields by hand (paint/erase EXOTIC + CURVATURE), create/annihilate matter, pause time, and grant mid-run law changes (already possible — now in-world and journaled).
- **Graduation:** a stable transcendent end-state — a run can *complete*: all major arcs resolved (a living lineage, at least one aware species, a finished epoch ladder) triggers the graduation journal (full history: lineage, epochs, events, species, interventions).
- **New-Game-Plus:** a graduated run's seed + final lineage + awareness memory become the starting state of a fresh universe — the 18-set lifecycle loops, and the new world is born already aware of its past life.

## Decisions log
| # | Decision | Choice |
|---|----------|--------|
| R.1 | heat death | field diffusion + dimming, journaled denouement |
| R.2 | rebirth | seed + lineage + epoch journal replay (D.1 restore) |
| R.3 | entropy upkeep | structures/cohesion decay unless maintained |
| S.1 | awareness trigger | deep-time + intelligence + era thresholds |
| S.2 | meta-events | player actions journaled as cosmic interventions |
| S.3 | awareness UI | narrative tag + tint + inspection |
| T.1 | god-mode | field paint + matter create/annihilate + pause |
| T.2 | graduation | journal completion when arcs resolve |
| T.3 | new-game-plus | graduated run seeds a fresh universe |

## Risks
1. **Heat death feels like a bug** — dimming must be slow, journaled, and reversible (undo ring); the rebirth button must be discoverable.
2. **Rebirth state corruption** — replaying seed + lineage touches the save/restore path; snapshot must be validated before replay (reuse worldSave compare).
3. **Awareness feedback loops** — aware species reacting to meta-events could thrash policy; cooldowns + the A.3 confirm gate.
4. **God-mode griefing** — paint/annihilate needs per-gesture caps + undo-ring reversibility.
5. **Graduation ambiguity** — "arcs resolved" must be measurable (a clear predicate) so graduation isn't random.

## Out of scope (shelved)
- True AGI/sentience claims (awareness is diegetic flavor + behavior nudges, not a claim about real intelligence).
- Real-time universe rendering at cosmic scale (the grid auto-scale caps at GRID_DIM 24).
- Third trilogy³ (V·W·X and beyond) — the 18-set lifecycle is the planned completion.
- Golden-run tick-trace tests.
