# A9 Migration Plan — remove the `buffer_global` module singleton from `src/physics/laws.js`

**Status:** staged, not started. Tracked from `docs/CODEBASE-AUDIT-2026-09-30.md` §4.1 (A9).
**Why staged:** this is a physics-hot-path refactor touching 45 exported laws,
4 internal helpers, a second module-level singleton (HISTORY), and 85 call sites
across 7 files. A partial migration would leave the solver calling laws with
mismatched signatures — strictly worse than not starting. The inventory below
was measured, not estimated, so the work can be executed without re-discovery.

## Problem

`src/physics/laws.js` stores the particle buffer in a module-level mutable
binding:

```js
let buffer_global = null;
export function setBuffer(buffer) { buffer_global = buffer; ... }
```

`solver.js:266` calls `setBuffer(particleBuffer)` at the top of `solve()`.
46 exported functions then read `buffer_global` implicitly instead of receiving
the buffer. Consequences:

1. **Not testable in isolation** — exercising a law requires the global side
   effect of `setBuffer()` first.
2. **Not shard-safe** — `solve()` re-binds the singleton per call, so multiplex
   shards (which call `solve()` with their own buffer at
   `src/multiplex/multiplex.js:346`) work only because they run sequentially in
   one thread. Any concurrency or re-entrancy silently corrupts the law state.
3. **Two contracts in one loop** — `laws.js` uses the implicit global while
   `lawgroups/*` take an explicit `view` parameter. The solver imports both.

## Measured scope

| Item | Count |
|---|---:|
| Exported laws reading `buffer_global` | **45** (+`setBuffer` itself) |
| Internal helpers reading it | 4 — `readDNA`, `clearEntangleLink`, and the HISTORY accessors |
| Call sites in `src/physics/solver.js` | **37** |
| Call sites in tests | **48** across 6 files |
| Files importing `laws.js` in tests | 6 (`signal`, `batch_11/17/18/19/20`) |
| Second singleton (HISTORY) | 4 module vars: `historyField`, `historyLast`, `historyTick`, `historyBufferRef` |

Every affected law uses the uniform pointer-style signature
`(p1Ptr, p2Ptr, stride, …)`, so the transformation is mechanical:
`export function NAME(p1Ptr, …)` → `export function NAME(view, p1Ptr, …)`, and
`const buf = buffer_global` → `const buf = view`.

Full parameter list of the 45 is recorded in the audit doc §2.3 and can be
regenerated from the characterization test below.

## Ordered steps

Each step ends with `npm test`; do not proceed on a red suite.

1. **Add `view` as the first parameter** to the 45 exported laws and rewrite
   their bodies (`const buf = buffer_global` → `const buf = view`). The module
   compiles; the solver breaks at runtime, which is expected at this step.
2. **Thread `view` into the 4 internal helpers** (`readDNA`, `clearEntangleLink`,
   the HISTORY accessors) and give HISTORY an explicit context object instead of
   four module variables.
3. **Update the 37 solver call sites** to pass the `view` already in scope in
   `solve()`.
4. **Update the 48 test call sites**, dropping the now-unnecessary `setBuffer()`
   setup in each.
5. **Delete `buffer_global` and `setBuffer`**, then delete the
   `setBuffer(particleBuffer)` call and import in `solver.js`.
6. **Add a lint-style guard test** asserting `laws.js` contains no
   `buffer_global` and no module-level mutable buffer binding, so the pattern
   cannot return.

## Acceptance criteria

- `npm test` green (currently **980** tests / 111 files).
- `npm run repository:check` green.
- `rg 'buffer_global|setBuffer' src` returns nothing.
- `tests/unit/lawsSingleton.test.js` passes unmodified — it is written to
  characterize current behaviour, so it must keep passing after the migration
  *only if* the migration is behavior-preserving. Update it to call the new
  signatures as part of step 4.

## Risk notes

- Step 1 alone leaves the tree in a non-runnable state. Do not stop there.
- `applyHistoryCalc` / `applyHistoryWrite` also reset per-buffer state in
  `setBuffer`; moving that reset into `solve()` changes *when* history clears.
  Confirm the HISTORY tests in `tests/unit/laws.test.js` before committing.
- `nanGuard` in this module is deliberately narrower than
  `core/numeric.js` (NaN-only vs. NaN+Infinity). Do **not** "tidy" it as part of
  this migration — that is a separate physics-semantics decision, documented in
  the audit doc §6.2.
