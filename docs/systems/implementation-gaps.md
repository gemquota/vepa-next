# Implementation gaps and next slices

**Review baseline:** VEPA4 9.1.15, reviewed 2026-09-20. `systemFoundation.js` and `systemLifecycle.js` now provide shared evidence infrastructure; they do not close domain-specific ontology gaps.

## Confirmed partial or missing systems

| Gap | Current proxy | What is missing | Priority |
|---|---|---|---:|
| Mating | compatibility + REPRO + lineage | explicit mate choice, courtship, pair lifecycle, rejection, mate memory | P1 |
| Family | ancestry records | kin recognition, caregiving, household membership, kin resource flow | P1 |
| Individual recognition | particle memory/relationship state | stable individual IDs and pair-specific history | P1 |
| Tribe/clan | groups + memory + alliances | multi-group identity, kin/culture federation, fission/fusion | P2 |
| Nation | group governance | polity container, jurisdiction, citizenship, succession, institutions | P2 |
| Civilization | group economy/infrastructure/epochs | cumulative culture and multi-group continuity across member turnover | P2 ✅ |
| Structure ownership | `src/state/structures.js` | durable object registry, ownership, maintenance, dependencies | P2 ✅ |
| Cultural transmission | signal/memory/culture laws | explicit symbol/norm objects, fidelity, mutation, horizontal/vertical lineage | P2 ✅ |
| Relationship graph | bond slots + semantic utilities | sparse typed edge registry, per-edge history, graph queries | P1 |
| Reproductive architectures | one REPRO lifecycle path | unary/binary/multi-parent/budding/fragmentation/colony measurements | P2 |
| Emergent boundaries | group density and roles | statistical organism boundary, merge/split events, collective fitness | P2 |
| Codex ontology | `src/state/continuity.js` + `src/state/codex.js` | observer-generated regime names with evidence and confidence | P3 ✅ |

## What is already safe to claim

- Species and lineage are real runtime systems.
- Groups, economy, governance, construction, artifacts, infrastructure, memory, ecology, epochs, and synthetic state have runtime modules.
- ACCR preserves separate particle identities; ALLOY is the one-body fusion path.
- Relationship compatibility and exploration are implemented support layers.
- All twelve ranked systems now have shared lifecycle records, causal events, bounded emergence evidence, and reports; these are cross-system observations rather than domain-specific entity registries.
- Culture, kin, federation and polity have explicit entity registries (`src/state/civilization.js`); structures, era continuity and the codex followed in `src/state/structures.js`, `src/state/continuity.js` and `src/state/codex.js`. See `docs/CIVILIZATION-SEQUEL-PLAN-2026-09-30.md`.
- Regime names and observer statements are derived from measured social evidence with an explicit confidence, and are structurally prevented from being reconstructed from law state. This is `proxy`-level fidelity: it accounts for what was observed, it does not model culture or cognition.

## What must not yet be claimed as complete

- Full mating or family simulation.
- Explicit tribe, clan, nation, or civilization entities.
- Structures as *physical* objects. `structures.js` records ownership, upkeep and condition; it does not yet write field cells, so `construction.js` still owns terrain.
- Individual recognition and pair-specific historical memory.
- General-purpose social graph persistence.
- Open-ended evolution of institutions or relationship grammars.

## Recommended next implementation sequence

1. Add a bounded sparse relationship graph with stable pair keys and save/restore support; feed it through the existing lifecycle event contract.
2. Add kin edges and care/resource transfer without changing lineage semantics.
3. Add group-to-group federation edges and shared cultural memory.
4. Promote structures to durable records with ownership and maintenance.
5. Add multi-epoch continuity metrics and a regime catalog.
6. Build Codex explanations from evidence, never from law names alone.
