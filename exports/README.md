# VEPA4 — Concatenated Snapshots

Machine-readable single-file exports of the current working tree. These files are derived artifacts, not runtime source or documentation SSOT. Their headers and contents are regenerated from the worktree; do not treat embedded branch, commit, or version text as current repository metadata.

| File | What it is | Regenerate |
|------|------------|------------|
| `vepa-full-codebase-concat.md` | Generated hierarchical source snapshot; excludes generated documentation, audit corpora, and its own large output files. | `npm run concat` |
| `vepa-docs-concat.md` | Derived documentation snapshot generated from the documentation paths currently present in the repository. It is not the documentation SSOT. | `npm run concat` |
| `vepa-codebase-full-concat.md` | Existing parallel/legacy full snapshot retained for provenance; its producer and consumer mapping require review before removal. | No canonical regeneration command established |

The maintained full snapshot generator is `exports/generate-full-concat.mjs`, invoked by `exports/generate-vepa-all.mjs` from the repository path rather than from `.dist/`. Large generated outputs remain review artifacts and are not runtime inputs. See [the retention policy](../docs/EXPORT_SNAPSHOT_POLICY.md) and run `node scripts/repository-artifact-report.mjs` before changing them.

**Verify the codebase snapshot runs:**
```bash
node exports/vepa-codebase-concat.mjs   # headless smoke: 500 particles, 60 ticks
```
