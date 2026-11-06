# Product/SIM boundary integration contracts

Scope: G1.3 worker boundary, G1.4 random-stream ownership, G1.5 persistence conversion, and G2.1 solver phase contract.
Baseline: VEPA 9.3.5 remains the production runtime; SIM remains isolated.

## Worker protocol (G1.3)

The product worker is an unversioned protocol. The SIM worker uses its own request/response protocol. The new adapter adds a versioned, correlated envelope and maps only commands with established counterparts: INIT→INIT, CONFIG→CONFIGURE, TICK→STEP, GET_STATE→READ_STATE, RESTORE→RESTORE, PING→STATUS. TOGGLE_LAW fails closed because product law indices are not SIM law IDs. Responses are checked for protocol, version, request correlation, response type and error shape. This adapter is not connected to the live product worker.

## Random ownership (G1.4)

Both codebases use SplitMix32-compatible state transitions. The bridge proves state handoff and future-sequence equivalence without redirecting any product RNG consumer. Keyed SIM streams remain infrastructure until stable particle IDs and consumer-by-consumer migration are complete.

## Persistence conversion (G1.5)

Product in-memory save v1 converts to a checksummed SIM snapshot v2 and back. Particle and DNA buffers are copied and validated; law masks remain opaque product-indexed words. WRAP at product index 130 is never reinterpreted as historical INERTIA. Product saves do not include PRNG state, so the adapter records prngState=null and deterministic continuation as unavailable. Exported JSON/base64 saves must first pass through the product parser/decoder.

## Solver phase ownership (G2.1)

The phase contract names preparation, field cadence, backend selection, neighbor construction, force evaluation, mechanics/boundaries, integration, lifecycle, main-thread post-tick work and render projection. It records ownership and write domains. It is descriptive and tested for ordering/ownership drift; it does not instrument or reorder the production solver.

## Safety

- No production worker is replaced or redirected.
- No solver phase is moved or reordered.
- No save writer/version is changed.
- No existing world is rewritten.
- No RNG consumer is migrated.
- Adapters are explicit, copy-based and opt-in. Runtime integration still requires browser worker parity, stable IDs, save migration fixtures and deterministic continuation evidence.