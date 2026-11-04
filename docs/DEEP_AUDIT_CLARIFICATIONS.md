# Deep Audit Clarifications

**Status:** source-aligned clarification for VEPA4 9.1.3

## 1. The “100 particles” ambiguity

The value `100` is **not** a particle-count limit and is not an alternative to `128`.

| Concept | Live value | Meaning |
|---|---:|---|
| `PARTICLE_STRIDE` | 100 | Each particle occupies 100 `Float32` slots in the flat particle buffer. |
| `MAX_PARTICLES` | 10000 | Maximum population capacity allocated by the application. |
| `LAW_COUNT` | 136 | Registered law slots, indexed 0–135. |
| Legacy 128 reference | historical | The earlier registry/law-state boundary; it is not the current law count. |

A buffer containing `N` particles therefore uses `N × 100` floats. The stride is a memory-layout contract, not a population setting. The final four stride slots (96–99) are reserved/partially assigned state fields; changing the stride would invalidate worker, save/load, renderer, and law offsets.

## 2. Audit-suite versus `docs/audit`

This checkout does **not** contain a root `audit-suite/` directory. The active audit corpus is under:

```text
docs/audit/laws/a3/
```

The generated specification tree already references those paths. `GEMINI.md` and older governance text still mention `audit-suite/`, which is a documentation/provenance inconsistency rather than evidence that a second active corpus exists.

The audit corpus was not merged, deleted, or relocated in this change because it contains historical stage records, rollups, and generated evidence with unresolved consumer/provenance boundaries. The safe current ownership rule is:

- `docs/audit/` — retained audit evidence and historical reports.
- `docs/spec/` — generated structural/source-derived specifications.
- `src/` and executable tests — behavioral authority.
- This document — clarification and reconciliation record.

A future cleanup may rename the governance reference to `docs/audit/`, but that should be a separately reviewed documentation migration with link validation.

## 3. WebGPU status after this change

WebGPU is now an operational, opt-in worker backend when all of the following hold:

1. `runtimeConfig.computeEngine === 'gpu'`.
2. The browser exposes `navigator.gpu` and grants a device.
3. The worker can build the same spatial-grid neighbor-pair set used by the exact CPU path.
4. The GPU pass completes successfully.

The GPU computes the pairwise gravity pre-pass. CONTACT and COLL remain on the CPU because the exact solver owns positional correction and velocity-impulse semantics; the CPU also continues all DNA-dependent, lifecycle, field, chemistry, information, quantum, and other mechanics laws. If device acquisition, shader execution, mapping, or device loss fails, the worker disables the GPU backend for subsequent ticks and runs the exact CPU solver instead. GPU availability is therefore a capability report, not a claim that every browser executes on a device.

The CPU path remains the semantic reference. GPU parity still requires browser/device execution tests; Node tests verify deterministic fallback and contract behavior only.
