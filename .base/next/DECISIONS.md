# Rebuild decisions and review register

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D-001 | Preserve existing Next main; rebuild on `rebuild/source-faithful-baseline` | Reversible clean restart without destroying history | Accepted |
| D-002 | Use current `gemquota/vepa` as the first implementation base | Explicit user direction; consolidation is comparison/gap evidence | Accepted |
| D-003 | Treat consolidation as a secondary source register, not automatic code authority | It references multiple repos and older pins | Accepted |
| D-004 | Reproduce the existing VEPA visual identity before redesign | Avoid another unrelated demo UI | Accepted |
| D-005 | Port complete vertical slices, not infrastructure-only PRs | Ensure each feature becomes observable and usable | Accepted |
| D-006 | Keep stable behavior as default; expose intentional improvements behind explicit decisions | Protect compatibility and parity | Accepted |
| D-007 | Keep one authoritative simulation state shared by worker/local backend, UI and renderer | Prevent divergent duplicate worlds | Accepted |
| D-008 | Reuse Next modules only after source comparison and runtime integration review | Avoid carrying forward unvalidated abstractions | Accepted |
| D-009 | Maintain source-to-destination provenance and parity evidence for every port | Make omissions and deviations auditable | Accepted |

## Simplification and abstraction review checklist

For every component, inspect:
- duplicated logic across law groups, panels, state stores and adapters;
- repeated validation or serialization code;
- duplicated registries, constants, IDs, defaults and UI metadata;
- unnecessary wrapper layers and pass-through adapters;
- hot-loop abstraction overhead or per-particle allocation;
- cyclic imports and hidden global state;
- direct DOM/worker coupling in domain mechanics;
- inconsistent units, coordinate conventions and boundary rules;
- mutable state copied between worker, UI and renderer;
- duplicated generated documentation or hand-maintained inventories.

Candidate abstractions must have at least two real consumers or a clear stability boundary. Do not generalize speculative future requirements. Prefer data tables for repetitive law metadata, shared panel primitives for repeated UI patterns, explicit domain services for shared mechanics, and thin adapters at worker/storage/render boundaries.

## Change record template

For each proposed simplification:
- Original paths and behavior;
- duplicated/complexity evidence;
- proposed abstraction and ownership;
- expected reduction in code paths / state copies;
- hot-path/performance impact;
- compatibility risks;
- tests before/after;
- decision: adopt, defer or reject.
