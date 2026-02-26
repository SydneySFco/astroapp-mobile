import {
  claimNextReconcileJob,
  finalizeReconcileJob,
  type DeadLetterReplayHook,
  type ReconcileFinalizeInput,
  type ReconcileJob,
  type ReconcileJobRepository,
  type RetryDecision,
} from './reconcileWorker';

export type ReconcileTelemetryEvent =
  | {
      type: 'reconcile_job_claimed';
      jobId: string;
      reportId: string;
      attemptCount: number;
      leasedUntil?: string;
    }
  | {
      type: 'reconcile_job_finalized';
      jobId: string;
      reportId: string;
      result: 'succeeded' | 'failed';
      nextStatus?: RetryDecision['nextStatus'];
      nextRetryAfter?: string;
      errorCode?: string;
    };

export type ReconcileRuntimeDeps = {
  repository: ReconcileJobRepository;
  leaseDurationMs: number;
  executeJob: (job: ReconcileJob) => Promise<void>;
  emitTelemetry?: (event: ReconcileTelemetryEvent) => Promise<void> | void;
  onDeadLettered?: DeadLetterReplayHook;
};

const toFailureInput = (error: unknown): ReconcileFinalizeInput => {
  if (error instanceof Error) {
    return {
      result: 'failed',
      errorCode: 'WORKER_RUNTIME_ERROR',
      errorMessage: error.message,
    };
  }

  return {
    result: 'failed',
    errorCode: 'WORKER_RUNTIME_UNKNOWN',
    errorMessage: 'Unknown worker error',
  };
};

export const runReconcileWorkerTick = async (
  deps: ReconcileRuntimeDeps,
): Promise<{claimed: boolean; decision: RetryDecision | null}> => {
  const job = await claimNextReconcileJob(deps.repository, deps.leaseDurationMs);

  if (!job) {
    return {claimed: false, decision: null};
  }

  await deps.emitTelemetry?.({
    type: 'reconcile_job_claimed',
    jobId: job.id,
    reportId: job.reportId,
    attemptCount: job.attemptCount,
    leasedUntil: job.leasedUntil,
  });

  try {
    await deps.executeJob(job);

    const decision = await finalizeReconcileJob(
      deps.repository,
      job,
      {result: 'succeeded'},
      new Date(),
      {onDeadLettered: deps.onDeadLettered},
    );

    await deps.emitTelemetry?.({
      type: 'reconcile_job_finalized',
      jobId: job.id,
      reportId: job.reportId,
      result: 'succeeded',
    });

    return {claimed: true, decision};
  } catch (error) {
    const input = toFailureInput(error) as Extract<
      ReconcileFinalizeInput,
      {result: 'failed'}
    >;

    const decision = await finalizeReconcileJob(
      deps.repository,
      job,
      input,
      new Date(),
      {onDeadLettered: deps.onDeadLettered},
    );

    await deps.emitTelemetry?.({
      type: 'reconcile_job_finalized',
      jobId: job.id,
      reportId: job.reportId,
      result: 'failed',
      nextStatus: decision?.nextStatus,
      nextRetryAfter: decision?.nextRetryAfter,
      errorCode: input.errorCode,
    });

    return {claimed: true, decision};
  }
};

export const createDeadLetterReplayHook = (
  enqueueReplay: (payload: {
    jobId: string;
    reportId: string;
    reasonCode: string;
    reasonMessage: string;
  }) => Promise<void>,
): DeadLetterReplayHook => {
  return async (job, reason) => {
    await enqueueReplay({
      jobId: job.id,
      reportId: job.reportId,
      reasonCode: reason.errorCode,
      reasonMessage: reason.errorMessage,
    });
  };
};
