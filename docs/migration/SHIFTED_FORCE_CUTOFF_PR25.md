# Shifted-force cutoff model (PR #25)

Adds an opt-in `cutoffMode: 'shifted-force'` for gravity and electric pair forces. The default remains `hard` to preserve existing simulations and saved configurations.

For the softened radial potential (u(r)=s/sqrt{r^2+\epsilon^2}), the shifted-force potential is (U(r)=u(r)-u(R)-(r-R)u'(R)) for (r<R), and zero at/outside cutoff (R). This makes both potential and radial force approach zero at the cutoff. The solver force multiplier and independent energy-budget reference use the same expression.

Tests compare analytic solver accelerations with central finite-difference derivatives of the independent potential for gravity and electric interactions, and verify continuity at the cutoff. The model is still a finite-range pair approximation, not a periodic-image lattice solution. The hard cutoff remains available and remains the default. This change does not imply SI dimensional validation or universal physical validity.
