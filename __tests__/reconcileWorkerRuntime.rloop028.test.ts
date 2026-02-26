import {
  finalizeReconcileJob,
  type ReconcileJobRepository,
} from './reconcileWorker';
import {runReconcileWorkerTick} from './reconcileWorkerRuntime';

const baseJob = {
  id: 'job-1',
  reportId: 'report-1',
  status: 'running' as const,
  attemptCount: 1,
  maxAttempts: 3,
  leaseRevision: 1,
  leaseToken: 'token-1',
};

describe('finalize outcome contract', () => {
  it('returns idempotent when repository reports idempotent replay', async () => {
    const repository: ReconcileJobRepository = {
      claimNext: jest.fn(),
      markSucceeded: jest.fn().mockResolvedValue('idempotent'),
      markFailed: jest.fn(),
    };

    const result = await finalizeReconcileJob(repository, baseJob, {result: 'succeeded'});

    expect(result.outcome).toBe('idempotent');
    expect(result.decision).toBeNull();
  });

  it('returns stale_blocked for failed finalize conflict', async () => {
    const repository: ReconcileJobRepository = {
      claimNext: jest.fn(),
      markSucceeded: jest.fn(),
      markFailed: jest.fn().mockResolvedValue('stale_blocked'),
    };

    const result = await finalizeReconcileJob(repository, baseJob, {
      result: 'failed',
      errorCode: 'E_TEST',
      errorMessage: 'x',
    });

    expect(result.outcome).toBe('stale_blocked');
    expect(result.decision?.nextStatus).toBe('queued');
  });
});

describe('runReconcileWorkerTick telemetry routing', () => {
  it('emits stale conflict event instead of finalized event for stale_blocked', async () => {
    const emitTelemetry = jest.fn();

    const repository: ReconcileJobRepository = {
      claimNext: jest.fn().mockResolvedValue(baseJob),
      markSucceeded: jest.fn().mockResolvedValue('stale_blocked'),
      markFailed: jest.fn(),
    };

    const result = await runReconcileWorkerTick({
      repository,
      leaseDurationMs: 1000,
      executeJob: jest.fn().mockResolvedValue(undefined),
      emitTelemetry,
    });

    expect(result.claimed).toBe(true);
    expect(result.decision).toBeNull();

    expect(emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reconcile_job_finalize_stale_conflict',
        counterName: 'reconcile_job_finalize_stale_conflict_count',
      }),
    );

    expect(emitTelemetry).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reconcile_job_finalized',
      }),
    );
  });
});
