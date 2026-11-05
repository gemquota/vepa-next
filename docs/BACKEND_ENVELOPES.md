# Backend Error and Performance Envelopes

**Project:** VEPA4 9.1.22
**Benchmark:** `npm run bench:backends` (`bench/backend-compare.mjs`)
**Fixture:** deterministic SplitMix-style gravity kernel, world size `WORLD_SIZE`,
softening `0.5`, seeds `0x9e3779b9` (CLI) and `0x12345678` (tests).
**Status:** repeatable envelope evidence — gravity kernel only

## 1. Scope and promotion rules

This is a **gravity-kernel comparison fixture**, not full-solver parity. DNA
modifiers, collision, lifecycle, GPU device execution, and full solver
scheduling are outside this comparison (restated by the benchmark's own
`interpretation` field).

Promotion rules (remediation plan §4.3):

1. The **exact CPU direct sum remains the parity reference** for every
   approximate backend.
2. An approximate backend must carry an **explicit tolerance envelope**:
   `rmsRelative ≤ 0.1` and `maxAbsolute ≤ 1.0` on the standard fixtures
   (reporting policy, not a scientific-equivalence claim).
3. **A backend cannot become the default solely because it is faster** on one
   fixture. Envelope status, not wall-clock time, gates promotion.
4. Every measurement below is reproducible with
   `node bench/backend-compare.mjs --count <n>`.

## 2. Measured envelope — CLI seed `0x9e3779b9`

| Count | Backend | rmsRelative | maxAbsolute | within envelope | ms (approx) |
|------:|---------|------------:|------------:|:---------------:|------------:|
| 32    | Barnes–Hut octree | 7.06e-2 | 4.91e-6 | **yes** | 2.1 |
| 32    | FMM cell evaluator | 1.68e+0 | 6.30e-5 | no  | 2.8 |
| 128   | Barnes–Hut octree | 7.15e-2 | 2.41e-5 | **yes** | 7.1 |
| 128   | FMM cell evaluator | 1.61e+0 | 2.43e-4 | no  | 11.0 |
| 512   | Barnes–Hut octree | 7.57e-2 | 9.44e-5 | **yes** | 14.0 |
| 512   | FMM cell evaluator | 1.15e+0 | 9.30e-4 | no  | 23.1 |
| 2048  | Barnes–Hut octree | 1.09e-1 | 4.52e-4 | no (marginal, 0.109 vs 0.1) | 56.6 |
| 2048  | FMM cell evaluator | 2.02e-1 | 8.99e-4 | no | 48.8 |

Reading:

- **Barnes–Hut** stays within the envelope through 512 particles and is
  marginal at 2048 (theta error grows with scale). It is a supported opt-in
  backend with a documented envelope; the regression tests pin the ≤512 band.
- **FMM** is outside the `rmsRelative` envelope at **every** measured scale
  (its absolute error is tiny because softened far-field forces are tiny, but
  the error is comparable to the signal itself). This is the measurement behind
  the FMM decision below.

## 3. FMM decision (remediation plan §5.1)

**Decision: RETAIN EXPERIMENTAL.**

| Path | Verdict | Rationale |
|------|---------|-----------|
| Complete | rejected | Envelope parity is not demonstrated: rmsRelative 1.15–2.02 across 32–2048 fixtures. |
| Retire to historical | rejected | The cell builder and evaluator are real (the former `cellNeighbours` placeholder is now an implemented toroidal minimum-image stencil with parity tests), are useful as a research path, and cost nothing on the default path. |
| **Retain experimental** | **chosen** | Opt-in via `runtimeConfig.gravEngine === 'fmm'`, never default, misleading completion language replaced, explicit unsupported-case tests pin the out-of-envelope status. |

Consequences:

- `docs/FEATURE_STATUS_MATRIX.md` §3/§6 records the experimental status and the
  measured evidence.
- `tests/unit/fmmParity.test.js` pins: octree within envelope (≤512), FMM
  finite but **outside** the envelope — if FMM accuracy improves, that test
  fails and the status docs must be updated in the same change.
- Known FMM limitations remain as documented in `src/physics/fmm.js` header:
  quadrupole truncation, DNA modifiers absent from far-field contributions,
  minimum-image wrapping on cell centres.

## 4. WebGPU envelope status

WebGPU gravity has **no envelope row here by design**: hardware device
execution is an external-environment gate. The browser spec
(`tests/e2e/physics-worker.spec.js`) compares GPU vs CPU on a fixed fixture
(tolerance `1e-4`) when a device is granted, and asserts a bounded `null`
fallback when `navigator.gpu` is absent. Node contract tests
(`tests/unit/webgpuContract.test.js`) cover the deterministic CPU fallback,
gravity/collision gating, and pair-shape parity. Exact CPU CONTACT/COLL remain
CPU-owned (no double application) — asserted by
`tests/unit/backendArchitecture.test.js`.

## 5. Reproduce

```bash
npm run bench:backends                 # JSON envelope report, default seed
node bench/backend-compare.mjs --count 2048
npx vitest run tests/unit/fmmParity.test.js   # regression band (seed 0x12345678)
```
