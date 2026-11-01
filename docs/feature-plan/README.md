# VEPA Feature Plan

This directory is the consolidated planning surface for VEPA's feature concepts, implementation sequence, architectural constraints, and verification trail.

## Documents

| Document | Purpose |
|---|---|
| [Feature catalog](FEATURE_CATALOG.md) | Normalized inventory of the field-manual concepts and release-set designs |
| [Implementation plan](IMPLEMENTATION_PLAN.md) | Dependency-aware delivery sequence, gates, and completion criteria |
| [Decisions and risks](DECISIONS_AND_RISKS.md) | Cross-cutting architectural decisions, constraints, and failure modes |
| [Traceability](TRACEABILITY.md) | Links from planning claims to original design records and evidence needed to verify implementation |

## Authority and status rules

These documents reorganize existing planning material. They do not, by themselves, establish that every described feature exists in the current runtime.

Use the following status vocabulary:

- **Implemented claim**: an existing project document says the feature was implemented. This is a lead for verification, not independent proof.
- **Designed**: specified in an intent/design document, but implementation is not established here.
- **Proposed**: a candidate idea that still needs a decision or specification.
- **Verified**: source code and relevant tests/build evidence have been checked against explicit acceptance criteria.
- **Blocked / deferred**: a dependency, risk, or explicit scope decision prevents current delivery.

Do not promote an item to **Verified** without inspecting the current branch's code and tests. When implementation evidence conflicts with an older plan, current source and reproducible tests take precedence; retain the discrepancy in the traceability log rather than silently rewriting history.

## Reading order

1. Start with the feature catalog to understand scope.
2. Use the implementation plan to sequence work by dependency, not by document age alone.
3. Resolve shared constraints in decisions and risks before implementation.
4. Use traceability to connect each item to source records, code locations, and verification evidence.

## Source material consolidated

The collection was derived from:

- `GUIDE.md`: field-manual recipes, environmental controls, ecology, civilization, performance, and interaction guidance.
- `PLAN.md`: milestone history, implementation claims, and historical validation commands.
- `docs/dev/rrp-trilogy/intent.md` through `docs/dev/rrp-trilogy-6/intent.md`: E–T release-set designs.
- The corresponding RRP Mermaid diagrams and the R·S·T traceability matrix.

The source documents remain in their original locations. This planning directory is the structured index and synthesis, not a claim that the source records have been deleted or that their historical details are all current.
