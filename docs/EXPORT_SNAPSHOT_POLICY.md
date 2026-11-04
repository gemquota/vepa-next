# Export Snapshot Policy — Batch 5

**Release context:** VEPA4 9.1.3  
**Scope:** `exports/`

## Ownership

| Artifact | Role | Producer/status |
|---|---|---|
| `vepa-full-codebase-concat.md` | Current hierarchical source snapshot | Produced by `generate-vepa-all.mjs` and `generate-full-concat.mjs`; retained derived artifact |
| `vepa-docs-concat.md` | Documentation snapshot | Produced by `generate-docs-concat.mjs`; retained derived artifact |
| `vepa-codebase-full-concat.md` | Existing parallel/legacy full snapshot | Producer provenance is not uniquely established; retain pending review |

The runtime source of truth remains `src/`. Export files are review and handoff artifacts and must never be imported by the application or treated as a second source tree.

## Regeneration

```bash
npm run concat
```

The orchestrator invokes the maintained generators. Large outputs should be regenerated deliberately because they can create broad diffs and may embed historical metadata from source files they contain.

The read-only inventory is available through:

```bash
node scripts/repository-artifact-report.mjs
node scripts/repository-artifact-report.mjs --json
```

## Retention decision

The export snapshots are retained for now because their consumers and historical handoff purpose are not fully mapped. Before removal or untracking, record:

1. Which snapshot is canonical for each use case.
2. Whether the use case can be replaced by a reproducible command.
3. Which branches/releases depend on the existing file.
4. A reversible archive or commit boundary.

No deletion or relocation is authorized by this policy.
