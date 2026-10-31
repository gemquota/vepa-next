# Periodic Ewald solver (PR #27)

## Model

This PR adds a three-dimensional cubic-cell Ewald solver for the periodic Poisson Green function of point particles. The source charges are scalar values (q_i), and the pair coupling is (K). Electrostatics uses (q_i=Q_i, K=k_e); mean-density-subtracted gravity uses (q_i=m_i, K=-G), with a uniform compensating background.

The energy includes real-space pair images, real-space self images, reciprocal-space diagonal and pair terms, the Ewald self correction, and the uniform-background term when selected. The force is the negative energy gradient. Reciprocal vectors use one deterministic half-space ordering. The returned force is equal-and-opposite for each pair contribution.

## Neutrality and background

Electrostatics defaults to requiring net charge zero within a configurable tolerance. A non-neutral system must explicitly select `neutrality: 'uniform-background'`; this changes the physical model and adds the analytic background energy. Periodic gravity with positive masses uses the same uniform-background convention, equivalent to removing the mean-density (k=0) mode in the periodic Poisson equation.

## Truncation and precision

Real-space integer image vectors and reciprocal integer vectors are explicitly truncated. Shell maxima are bounded to limit untrusted workloads. The Ewald splitting parameter `alpha` is configurable. Truncation-level comparisons are empirical diagnostics only; this implementation does not assert a rigorous error bound. Summation uses deterministic order; pairwise energy and force accumulation are performed in that order.

## Important limitations

- Point-particle unsoftened (1/r) model; no finite-radius softening or shifted-force cutoff.
- Cubic, three-dimensional periodic box only.
- No slab, wire, dielectric-interface, conducting-boundary or non-cubic cell support.
- No exact finite-shell guarantee. Production accuracy requires convergence studies for the chosen alpha and both shells.
- The existing minimum-image solver remains the default. Ewald is opt-in and only supports gravity/charge laws; incompatible physics combinations are rejected.

## Adaptive stepping

When adaptive substepping is enabled, the execution adapter estimates the maximum acceleration from the configured gravity/charge pair model (including the Ewald model when selected) and combines it with the current maximum speed using `v_max * dt + 0.5 * a_max * dt²`. This is used as a deterministic displacement heuristic. It is **not** a local truncation-error estimator, a rigorous CFL condition, or a bound on unmodeled extended laws, contacts, drag, or future force changes. The step result reports the modeled acceleration estimate and its limitations.
