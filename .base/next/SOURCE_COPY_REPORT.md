# Stable source import report

**Result:** stable application source copied into the rebuild branch.  
**Target:** `gemquota/vepa-next`, branch `rebuild/source-faithful-baseline`.  
**Source:** `gemquota/vepa@24b56aff316d6de5a960943d6bcb9192a8d569ce`.  
**Import workflow:** run [41271037213](https://github.com/gemquota/vepa-next/actions/runs/41271037213), completed successfully.

## Verification

The Git tree comparison found 1,947 source entries outside the source `.github` directory and 1,947 corresponding destination entries outside Next's `.github` and the preserved `.base` library. All ordinary source paths were copied with matching blob IDs except the source's `vepa-archive` gitlink, which is a submodule pointer (mode 160000) and is not materialized by `git archive`. It is not an ordinary source file and has not been silently replaced with a guessed directory.

Direct blob comparisons confirmed byte-identical copies for:
- `src/main.js`
- `src/physics/solver.js`
- `src/constants.js`
- `src/render/renderer.js`
- `src/ui/ui.js`
- `style.css`
- `index.html`
- `package.json`
- `README.md`

The former Next prototype implementation path `src/sim/solver.js` is absent; the stable source path `src/physics/solver.js` is present.

## Deliberately preserved / not copied

- `.base/next/` is retained as the new port library and recreation specification.
- `.github/` remains from the Next repository because the GitHub App connection cannot overwrite workflow files without the separate Actions/workflows permission. This means deployment/CI workflow configuration is not yet the stable source version and must be reconciled separately.
- The `vepa-archive` submodule pointer is not materialized. Consolidation records the archive repository as an integrity-pending recovery source.

## Important qualification

This proves the source files were copied; it does not prove the copied application builds, passes tests, or works in a browser. The next gates are dependency install, source unit/audit tests, spec checks, production build, worker tests and actual browser interaction. No release or deployment claim is made.
