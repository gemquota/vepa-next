# V3 Worker Randomness Port Plan

**Source pin:** `gemquota/vepa-v3` commit `ccd2285ddf241c3d1ee2f6ebb4c8eea81824d973`  
**File:** `src/worker/physics.worker.js` (blob `12f7d9fb5d59e9c9feab123310796df59cac72db`)  
**Audit date:** 2026-10-31

## Inventory

The pinned worker contains **34 ambient `Math.random()` calls across 23 source lines**, spanning 12 behavior groups. Counts below are individual draws, not matching lines.

| Source line(s) | Draws | Feature gate / behavior | Proposed stream identity |
|---|---:|---|---|
| 97 | 1 | Senescence death probability; inside living-particle biology pass | `biology.death` / stable particle identity |
| 103–106 | 3 | Genotype drift gate, trait index (0–41), mutation delta | `biology.genetic-drift` / stable particle identity |
| 133–134 | 2 | Isomerization gate and replacement species (0–11) | `chemistry.isomerization` / stable particle identity |
| 143 | 1 | Reproduction/spawn gate; one world-level draw per substep | `biology.spawn-gate` / world identity |
| 148–155 | 7 | Child position x/y/z, velocity x/y/z and species (0–11) | `biology.spawn-init` / newly allocated child identity |
| 175 | 3 | Heat-law acceleration jitter x/y/z | `thermal.heat` / stable particle identity |
| 186 | 3 | Melt-law acceleration jitter x/y/z | `thermal.melt` / stable particle identity |
| 191 | 3 | Boil-law acceleration jitter x/y/z | `thermal.boil` / stable particle identity |
| 202 | 3 | Intrinsic/pure jitter x/y/z | `physics.intrinsic-jitter` / stable particle identity |
| 207–208 | 4 | Chaos gate plus acceleration jitter x/y/z | `chaos.perturbation` / stable particle identity |
| 325 | 1 | Allotropic species increment gate, inside neighbor-pair traversal | `chemistry.allotropy` / canonical unordered particle-pair identity |
| 332 | 1 | Dimensional phase-through gate, inside neighbor-pair traversal | `dimensional.phase-through` / canonical unordered particle-pair identity |
| 337 | 2 | Exothermic heat-transfer acceleration jitter x/y | `chemistry.exothermic-heat` / canonical unordered particle-pair identity |

The rows total 34 draws. The three coordinate/vector components in a row are distinct draws and must retain their authored order when parity is the objective.

## Behavioral observations

1. Biology and chemistry draws occur in the first particle-index traversal. A successful death changes `aliveCount`, while genotype/isomerization draws mutate particle state before the physics pass.
2. The reproduction gate is world-level and occurs once after the biology traversal for each substep. It is not a per-parent gate. A successful gate pops dead particle slots from `deadIndices` and initializes each child with seven draws.
3. Heat, melt, boil, intrinsic jitter and chaos perturbations occur in the per-particle physics pass. The heat/melt/boil/intrinsic/chaos vector draws are x, then y, then z.
4. Allotropy, phase-through and exothermic heat draws occur inside neighbor-pair traversal. A future port must define whether each unordered pair is visited once and use a canonical pair key; using one stream per current loop index would make results sensitive to traversal order.
5. The worker init message currently carries particle and optional DNA buffers but no explicit seed, stable particle identity table, allocation generation, or serializable PRNG state.
6. Particle slots are reused for newborns. A slot number alone is not a permanent identity: a recycled slot needs a generation/lineage token or an explicit persistent particle ID before it can own a stable per-particle stream.

## Required runtime contract

The keyed stream manager in PR #12 establishes versioned SplitMix32 streams keyed by `(domain, entityId)` and stores their states in execution snapshots. Before any V3 random feature is migrated:

- Worker INIT must require or explicitly default a documented seed and identify the PRNG algorithm/version.
- Every live particle must have a stable ID that survives save/restore. If IDs are slot-derived, the slot generation counter must also be saved and restored.
- Reproduction must allocate child identity deterministically before child-initialization draws. The global spawn gate remains a world stream; child initialization uses the new child's identity.
- Pair-scoped chemistry/dimensional streams must use a canonical pair key based on sorted stable IDs, with a documented ownership rule for one-sided versus symmetric effects.
- Stream state and identity allocator/generation state must be part of snapshots and restored atomically with particle state.
- Feature gates must not consume draws when their legacy law gate is false, unless an intentional behavior change is documented and versioned.
- Keep a compatibility mode only if its semantics are explicit; never silently mix legacy nondeterminism with a claimed deterministic replay.

## Port order

1. Add stable particle IDs and a generation-aware allocator; include both in checkpoints.
2. Port the reproduction gate and child initialization as one atomic feature with fixed fixture seeds.
3. Port biology death, genotype drift and isomerization with per-particle streams.
4. Port per-particle thermal and intrinsic jitter features.
5. Port chaos perturbations.
6. Port pair-scoped allotropy, phase-through and exothermic heat after pair traversal semantics are fixed.
7. Add same-seed full-state replay, different-seed divergence, snapshot continuation, reordered-iteration tests, particle-slot-reuse tests and paired stable-source fixtures.

## Acceptance gates

- Same seed + same initial state/config produces byte-identical future particle state and event output.
- Snapshot/restore at any tick produces the same future state as uninterrupted execution.
- Reordering independent particle processing does not change per-particle random draws.
- Reusing a dead particle slot does not inherit the prior occupant's stream.
- No migrated path calls ambient `Math.random()`.
- Parity claims are limited to features with matching stable-source fixtures; the infrastructure PR alone does not satisfy these gates.

## Current implementation boundary

PR #12 adds deterministic keyed stream infrastructure to Next's worker and in-process execution adapters, including snapshot continuation tests. It does **not** yet wire any of the 34 V3 draws into the Next solver. This plan is the behavior inventory and dependency order for that follow-on port.
