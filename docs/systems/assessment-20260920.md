# Systems atlas assessment — 2026-09-20

**Baseline:** VEPA4 9.1.15 on `main` (`54c2994`), with the zero-particle startup change merged. The review compared every pre-existing live Markdown file under `docs/systems/` with the current runtime, shared lifecycle substrate, version markers, roadmap status, and static publication workflow.

## Decision policy

- **Update** when a file contains stale version text, an outdated implementation boundary, or a status claim that no longer describes the Phase 2–5 substrate.
- **Retain** when its source anchors, boundaries, phase semantics, and publication guidance remain accurate.
- Before updating a live file, its prior content is copied to the matching path under `docs/systems/past/0/`.

## Files requiring update

| Live file | Finding | Archive |
|---|---|---|
| `README.md` | Scope said 9.1.12; lacked the current lifecycle module and review status. | `past/0/README.md` |
| `overview.md` | Needed the 9.1.15 review baseline and an explicit row for shared lifecycle evidence. | `past/0/overview.md` |
| `implementation-gaps.md` | Needed to distinguish the new shared lifecycle substrate from domain-gap closure. | `past/0/implementation-gaps.md` |
| `roadmap-overview.md` | Needed a current status header and an explicit Phase 6 boundary after shared Phases 1–5. | `past/0/roadmap-overview.md` |
| `roles/README.md` | Its blanket statement that no named system is implemented conflicted with the implemented runtime systems. | `past/0/roles/README.md` |

## Files reviewed and retained unchanged

These files were checked and remain accurate for the current source boundary:

- `analysis-framework.md`
- `comparison-matrix.md`
- `deployment-publication.md`
- `meta-model.md`
- `module-decomposition.md`
- `ontology.md`
- `roadmap-civilization.md`
- `roadmap-culture-memory.md`
- `roadmap-ecology.md`
- `roadmap-economy-governance.md`
- `roadmap-family-kinship.md`
- `roadmap-group-tribe-clan.md`
- `roadmap-infrastructure.md`
- `roadmap-mating-reproduction.md`
- `roadmap-nation-polity.md`
- `roadmap-relationship-laboratory.md`
- `roadmap-species-lineage.md`
- `roadmap-synthetic-society.md`
- `roles/culture-memory.md`
- `roles/ecology.md`
- `roles/economy-governance.md`
- `roles/family-kinship.md`
- `roles/group-tribe-clan.md`
- `roles/infrastructure.md`
- `roles/mating-reproduction.md`
- `roles/nation-civilization.md`
- `roles/relationship-laboratory.md`
- `roles/species-lineage.md`
- `roles/synthetic-society.md`

## Current conclusion

The atlas now distinguishes three layers consistently:

1. **Domain runtime:** particle, species, lineage, groups, economy, governance, infrastructure, ecology, synthetic state, and relationship exploration.
2. **Shared evidence infrastructure:** `systemFoundation.js` and `systemLifecycle.js`, which make records, events, bounded emergence evidence, and reports comparable across all twelve systems.
3. **Analytical projections:** family, tribe, clan, nation, civilization, and other labels that require domain-specific evidence before becoming first-class entities.

This assessment file is the new review ledger; no additional runtime module was warranted by this documentation-only assessment. The next architectural candidates remain the modules listed in `module-decomposition.md`, beginning with relationship recording and kinship projections.
