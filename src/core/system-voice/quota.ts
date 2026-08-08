/**
 * A self-imposed ceiling well below the provider's own, so a runaway loop
 * spends a fraction of the budget rather than all of it and leaves the free
 * tier intact for the days that follow.
 */
export const DAILY_REQUEST_LIMIT = 50;

/** Consecutive failures that take the provider out for the rest of the day. */
export const FAILURE_THRESHOLD = 3;

export type QuotaState = {
  readonly requests: number;
  readonly consecutiveFailures: number;
  readonly tripped: boolean;
};

export function emptyQuota(): QuotaState {
  return { requests: 0, consecutiveFailures: 0, tripped: false };
}

export function canGenerate(state: QuotaState): boolean {
  return !state.tripped && state.requests < DAILY_REQUEST_LIMIT;
}

/**
 * A failure spends quota just as a success does — the request was made and
 * the provider may well have counted it. Assuming otherwise would let a
 * failing day exceed the ceiling it exists to enforce.
 */
export function afterFailure(state: QuotaState): QuotaState {
  const consecutiveFailures = state.consecutiveFailures + 1;
  return {
    requests: state.requests + 1,
    consecutiveFailures,
    // One-way for the day. Three failures in a row means something upstream
    // is broken, and retrying it every hour would just spend the budget on
    // discovering that again.
    tripped: state.tripped || consecutiveFailures >= FAILURE_THRESHOLD,
  };
}

export function afterSuccess(state: QuotaState): QuotaState {
  return {
    requests: state.requests + 1,
    consecutiveFailures: 0,
    tripped: state.tripped,
  };
}
