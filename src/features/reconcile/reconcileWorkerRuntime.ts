import {
  claimNextReconcileJob,
  finalizeReconcileJob,
  type DeadLetterReplayHook,
  type FinalizeOutcome,
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
      leaseToken?: string;
      leaseRevision: number;
    }
  | {
      type: 'reconcile_job_finalized';
      jobId: string;
      reportId: string;
      result: 'succeeded' | 'failed';
      outcome: Exclude<FinalizeOutcome, 'stale_blocked'>;
      nextStatus?: RetryDecision['nextStatus'];
      nextRetryAfter?: string;
      errorCode?: string;
    }
  | {
      type: 'reconcile_job_finalize_stale_conflict';
      jobId: string;
      reportId: string;
      leaseRevision: number;
      counterName: 'reconcile_job_finalize_stale_conflict_count';
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

const emitStaleFinalizeConflict = async (
  deps: ReconcileRuntimeDeps,
  job: Pick<ReconcileJob, 'id' | 'reportId' | 'leaseRevision'>,
) => {
  await deps.emitTelemetry?.({
    type: 'reconcile_job_finalize_stale_conflict',
    jobId: job.id,
    reportId: job.reportId,
    leaseRevision: job.leaseRevision,
    counterName: 'reconcile_job_finalize_stale_conflict_count',
  });
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
    leaseToken: job.leaseToken,
    leaseRevision: job.leaseRevision,
  });

  try {
    await deps.executeJob(job);

    const finalizeResult = await finalizeReconcileJob(
      deps.repository,
      job,
      {result: 'succeeded'},
      new Date(),
      {onDeadLettered: deps.onDeadLettered},
    );

    if (finalizeResult.outcome === 'stale_blocked') {
      await emitStaleFinalizeConflict(deps, job);
      return {claimed: true, decision: null};
    }

    await deps.emitTelemetry?.({
      type: 'reconcile_job_finalized',
      jobId: job.id,
      reportId: job.reportId,
      result: 'succeeded',
      outcome: finalizeResult.outcome,
    });

    return {claimed: true, decision: finalizeResult.decision};
  } catch (error) {
    const input = toFailureInput(error) as Extract<
      ReconcileFinalizeInput,
      {result: 'failed'}
    >;

    const finalizeResult = await finalizeReconcileJob(
      deps.repository,
      job,
      input,
      new Date(),
      {onDeadLettered: deps.onDeadLettered},
    );

    if (finalizeResult.outcome === 'stale_blocked') {
      await emitStaleFinalizeConflict(deps, job);
      return {claimed: true, decision: null};
    }

    await deps.emitTelemetry?.({
      type: 'reconcile_job_finalized',
      jobId: job.id,
      reportId: job.reportId,
      result: 'failed',
      outcome: finalizeResult.outcome,
      nextStatus: finalizeResult.decision?.nextStatus,
      nextRetryAfter: finalizeResult.decision?.nextRetryAfter,
      errorCode: input.errorCode,
    });

    return {claimed: true, decision: finalizeResult.decision};
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
