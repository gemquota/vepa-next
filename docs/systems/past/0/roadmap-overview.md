# Ranked systems roadmap

## Breadth ranking

The ranking measures current runtime breadth, not conceptual importance. Rank 1 is the smallest current implementation; rank 12 is the broadest.

| Rank | System | Current evidence | Phase 1 result |
|---:|---|---|---|
| 1 | Family / kinship | Scaffold | Evidence contract and lineage anchors |
| 2 | Group / tribe / clan | Scaffold | Group-scale boundary contract |
| 3 | Mating / reproduction | Proxy | Pair/lifecycle contract |
| 4 | Nation / polity | Proxy | Governance/economy evidence contract |
| 5 | Civilization | Proxy | Multi-epoch accumulation contract |
| 6 | Culture / memory | Substrate | Transmission-observation contract |
| 7 | Relationship laboratory | Implemented | Experiment-observation contract |
| 8 | Synthetic society | Proxy | Program/group evidence contract |
| 9 | Ecology / niches | Implemented | Metric and evidence contract |
| 10 | Economy / governance | Proxy | Ledger/policy boundary contract |
| 11 | Infrastructure | Proxy | Structure/network evidence contract |
| 12 | Species / lineage | Implemented | Genome/history contract |

## Synchronized delivery rule

Each phase is completed for every system before the next phase begins. No phase may add a new stride field or reinterpret an existing field without updating the compatibility tests and all affected roadmaps.

- **Phase 1 — Evidence contract:** stable IDs, implementation status, source anchors, observation boundaries, and baseline tests.
- **Phase 2 — Durable records:** sparse records or projections with lifecycle, serialization, and deterministic IDs.
- **Phase 3 — Causal integration:** connect records to existing laws/engines through explicit events, not hidden cross-module mutation.
- **Phase 4 — Emergent behavior:** feedback, adaptation, topology, continuity, and multi-scale interactions.
- **Phase 5 — Analysis and UI:** metrics, Codex interpretation, replay, comparison views, and user controls.
- **Phase 6 — Stress and evolution:** long-run validation, save/restore, performance budgets, and evolutionary experiments.

Every system roadmap uses this shared ordering while specializing its deliverables and acceptance criteria.

## Current delivery status

Phases 1–5 are implemented as a shared, additive substrate in `src/state/systemFoundation.js` and `src/state/systemLifecycle.js`. Phase 2 stores deterministic records, Phase 3 stores explicit causal events, Phase 4 derives bounded emergence evidence, and Phase 5 produces per-system analysis reports. These are cross-system capabilities; domain-specific adapters remain the next step and no scaffolded system is being mislabeled as a first-class runtime entity.
