# Project cleanup and documentation triple pass

## Purpose

The triple pass makes repository hygiene repeatable and prevents hand-maintained documentation from drifting away from executable source. It is a validation and generation workflow, not permission to rewrite architecture or silently change simulation behavior.

Run:

```sh
npm ci
npm run docs:triple-pass
git status --short
git diff --check
```

The default build base is `/vepa-next/`; override `VITE_BASE` only when validating a different hosting path.

## Pass 1 — source and publication hygiene

- JavaScript syntax validation.
- Source-pin/provenance validation.
- Export/publication contract validation.

Review any change that alters a public export, source pin, or package boundary. Do not "fix" a failing check by weakening the check.

## Pass 2 — source-derived documentation

- Regenerate canonical specifications from source.
- Regenerate the UI module report from panel markup, help registry, UI modules and styles.

Generated files must be committed in the same PR as the source change that makes them stale. Do not hand-edit generated inventories to make them look current.

## Pass 3 — correctness and release build

- Product and SIM tests.
- Repository/spec/UI report consistency.
- Syntax validation after generation.
- Production build using the configured Pages base path.

A passing build does not authorize deployment. Release and deployment remain separately approved actions.

## Cleanup review rules

1. Remove dead code only after confirming there are no dynamic imports, event-bus consumers, generated references or public exports.
2. Consolidate duplicated behavior only when semantics and ownership match. In particular, compact product relationship state and the sparse semantic relationship graph are different storage contracts until an explicit adapter proves otherwise.
3. Keep physics hot loops allocation-conscious. Prefer typed scratch storage and stable iteration order.
4. Preserve product solver behavior, deterministic draw order, existing worlds and save compatibility unless a separately tested migration explicitly changes them.
5. Generated reports are evidence, not decoration. If generation fails or reports stale output, the gate remains open.
6. Record unverified browser, hardware, memory and performance claims as gaps rather than promoting them to accepted behavior.

## Current known follow-up

The UI module report was observed stale in the Gate 3 validation run. Pass 2 regenerates it before Pass 3 checks consistency. The resulting generated-file diff must be reviewed and committed; this workflow does not auto-commit it.
