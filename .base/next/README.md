# VEPA Next — source-faithful recreation

Status: baseline/reconnaissance in progress. This directory is the canonical port library and remake specification for the browser recreation.

## Source authority

1. **Primary implementation base:** `gemquota/vepa`, branch `master`, pinned initial source commit `24b56aff316d6de5a960943d6bcb9192a8d569ce` (re-pin before every port batch).
2. **Gap and history reference:** `gemquota/vepa-consolidation`, branch `main`, pinned at `2100e4b0667b98b3e9b5ac9af955ab217b370c41`.
3. **Existing Next work:** historical reference only. Reuse a module only after comparison proves it is correct, useful, and compatible with the source baseline.

The current stable repository is VEPA4 9.1.2. Its root source tree contains approximately 1,949 tree entries. The current Next tree has approximately 176. The stable README describes a substantial existing application: typed particle state, 136-law inventory, fields, DNA/species, spatial acceleration, worker physics, Canvas renderer, extensive UI panels, intelligence, ecology, civilizations, deep time, exotic matter, relativity, quantum macroscale, stellar systems and multiplexing.

## Working rules

- Do not delete or rewrite `main` during the rebuild. This branch is the clean replacement workspace; the old implementation remains recoverable.
- First reproduce the stable application and establish a baseline. Do not redesign the product before feature parity.
- Port complete vertical slices: state + mechanics + UI + worker/protocol + persistence + tests. A helper or contract alone is not a completed feature.
- Keep stable behavior as the default. Every intentional deviation needs a decision record and regression coverage.
- Keep the visual language recognizably VEPA: dark scientific/laboratory aesthetic, compact high-density controls, categorized law controls, bottom drawer/panels, HUD and overlays. Improve hierarchy and responsiveness without replacing the visual identity.
- Do not mark features complete based on files, docs or CI alone. Require a working browser path and observable behavior.
- Preserve provenance down to source commit and source path. Every port gets a ledger entry and focused parity tests.

## Documents

- [SOURCE_BASELINE.md](SOURCE_BASELINE.md) — pinned sources, repository comparison and baseline gates.
- [OPERATION_MAP.md](OPERATION_MAP.md) — runtime boot, state ownership, simulation tick, worker and rendering pipelines.
- [PORT_LIBRARY.md](PORT_LIBRARY.md) — component-level source-to-Next migration catalogue.
- [UI_RECREATION_SPEC.md](UI_RECREATION_SPEC.md) — visual and interaction reconstruction requirements.
- [ROADMAPS.md](ROADMAPS.md) — phased browser recreation roadmaps.
- [ATOMIC_TODO.md](ATOMIC_TODO.md) — hierarchical, independently verifiable work items.
- [DECISIONS.md](DECISIONS.md) — simplification, abstraction and compatibility decisions.

## Definition of done

A feature is done only when its source behavior is understood, the destination module is integrated into the live app, its UI/control path works, state/save/replay behavior is covered where relevant, tests pass, and browser evidence demonstrates it. A roadmap phase is not complete while any required atomic task is open or unverified.
