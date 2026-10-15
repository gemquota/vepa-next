/**
 * Minimal semantic transaction coordinator.
 * Validation is pure and runs before commit side effects. Adapters must provide
 * a rollback strategy for any side effect that can fail after commit starts.
 */
export function createTransactionCoordinator({ getCurrent, validate, apply, restore }) {
  if (![getCurrent, validate, apply, restore].every((fn) => typeof fn === 'function')) {
    throw new TypeError('getCurrent, validate, apply and restore callbacks are required');
  }
  let sequence = 0;
  let busy = false;

  return {
    async transact(proposal, context = {}) {
      if (busy) return { status: 'rejected', reason: 'transaction-busy', sequence: sequence + 1 };
      busy = true;
      const transactionId = ++sequence;
      const before = await getCurrent();
      try {
        const verdict = await validate(proposal, { ...context, transactionId, before });
        if (!verdict || verdict.valid !== true) {
          return {
            status: 'rejected',
            transactionId,
            reason: verdict?.reason ?? 'validation-failed',
            errors: verdict?.errors ?? [],
            before,
          };
        }
        const candidate = verdict.value ?? proposal;
        try {
          const applied = await apply(candidate, { ...context, transactionId, before });
          return { status: 'committed', transactionId, before, candidate, applied };
        } catch (error) {
          try {
            await restore(before, { ...context, transactionId, error });
            return {
              status: 'rolled-back',
              transactionId,
              before,
              reason: 'apply-failed',
              error: error instanceof Error ? error.message : String(error),
            };
          } catch (restoreError) {
            return {
              status: 'blocked',
              transactionId,
              before,
              reason: 'apply-and-restore-failed',
              error: error instanceof Error ? error.message : String(error),
              restoreError: restoreError instanceof Error ? restoreError.message : String(restoreError),
            };
          }
        }
      } finally {
        busy = false;
      }
    },
    get sequence() { return sequence; },
    get busy() { return busy; },
  };
}
