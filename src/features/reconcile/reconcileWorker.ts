export type ReconcileJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'dead_lettered';

export type ReconcileJob = {
  id: string;
  reportId: string;
  status: ReconcileJobStatus;
  attemptCount: number;
  maxAttempts: number;
  leasedUntil?: string;
  retryAfter?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
};

export type RetryDecision = {
  shouldRetry: boolean;
  nextRetryAfter?: string;
  nextStatus: ReconcileJobStatus;
};

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;
const JITTER_RATIO = 0.2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const computeBackoffMs = (
  attemptCount: number,
  randomRatio = Math.random(),
): number => {
  const safeAttempt = Math.max(1, attemptCount);
  const exponential = BASE_BACKOFF_MS * 2 ** (safeAttempt - 1);
  const capped = Math.min(exponential, MAX_BACKOFF_MS);

  const jitter = (clamp(randomRatio, 0, 1) * 2 - 1) * JITTER_RATIO;
  const withJitter = capped * (1 + jitter);

  return Math.round(Math.max(BASE_BACKOFF_MS, withJitter));
};

export const toRetryDecision = (
  job: Pick<ReconcileJob, 'attemptCount' | 'maxAttempts'>,
  now = new Date(),
  randomRatio?: number,
): RetryDecision => {
  if (job.attemptCount >= job.maxAttempts) {
    return {
      shouldRetry: false,
      nextStatus: 'dead_lettered',
    };
  }

  const backoffMs = computeBackoffMs(job.attemptCount, randomRatio);
  const nextRetryAt = new Date(now.getTime() + backoffMs);

  return {
    shouldRetry: true,
    nextRetryAfter: nextRetryAt.toISOString(),
    nextStatus: 'queued',
  };
};

export type ReconcileJobRepository = {
  claimNext: (leaseDurationMs: number) => Promise<ReconcileJob | null>;
  markSucceeded: (
    job: Pick<ReconcileJob, 'id' | 'leaseToken' | 'leaseRevision'>,
    finishedAt: string,
  ) => Promise<void>;
  markFailed: (
    jobId: string,
    errorCode: string,
    errorMessage: string,
    decision: RetryDecision,
  ) => Promise<void>;
};

export type DeadLetterReplayHook = (
  job: Pick<ReconcileJob, 'id' | 'reportId' | 'attemptCount' | 'maxAttempts'>,
  reason: {errorCode: string; errorMessage: string},
) => Promise<void>;

export type FinalizeReconcileJobOptions = {
  onDeadLettered?: DeadLetterReplayHook;
};

export const claimNextReconcileJob = async (
  repository: ReconcileJobRepository,
  leaseDurationMs: number,
): Promise<ReconcileJob | null> => repository.claimNext(leaseDurationMs);

export type ReconcileFinalizeInput =
  | {result: 'succeeded'}
  | {result: 'failed'; errorCode: string; errorMessage: string};

export const finalizeReconcileJob = async (
  repository: ReconcileJobRepository,
  job: Pick<ReconcileJob, 'id' | 'reportId' | 'attemptCount' | 'maxAttempts'>,
  input: ReconcileFinalizeInput,
  now = new Date(),
  options?: FinalizeReconcileJobOptions,
): Promise<RetryDecision | null> => {
  if (input.result === 'succeeded') {
    await repository.markSucceeded(job, now.toISOString());
    return null;
  }

  const failedInput = input;

  const decision = toRetryDecision(
    {
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
    },
    now,
  );

  await repository.markFailed(
    job,
    failedInput.errorCode,
    failedInput.errorMessage,
    decision,
  );

  if (decision.nextStatus === 'dead_lettered' && options?.onDeadLettered) {
    await options.onDeadLettered(job, {
      errorCode: failedInput.errorCode,
      errorMessage: failedInput.errorMessage,
    });
  }

  return decision;
};
