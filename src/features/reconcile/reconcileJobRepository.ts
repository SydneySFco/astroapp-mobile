import type {ReconcileJob, ReconcileJobRepository} from './reconcileWorker';

export type ReconcileJobRow = {
  id: string;
  report_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'dead_lettered';
  attempt_count: number;
  max_attempts: number;
  leased_until: string | null;
  retry_after: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  updated_at: string | null;
};

export type ReconcileJobReplayInput = {
  jobId: string;
  reasonCode: string;
  reasonMessage: string;
  requestedBy?: string;
};

export type ReconcileJobReplayResult = {
  jobId: string;
  replayRequestedAt: string;
};

/**
 * Runtime-to-DB adapter contract used by reconcile worker orchestration.
 */
export type RuntimeReconcileJobRepository = ReconcileJobRepository & {
  replay: (input: ReconcileJobReplayInput) => Promise<ReconcileJobReplayResult>;
};

export const mapReconcileJobRowToDomain = (row: ReconcileJobRow): ReconcileJob => ({
  id: row.id,
  reportId: row.report_id,
  status: row.status,
  attemptCount: row.attempt_count,
  maxAttempts: row.max_attempts,
  leasedUntil: row.leased_until ?? undefined,
  retryAfter: row.retry_after ?? undefined,
  lastErrorCode: row.last_error_code ?? undefined,
  lastErrorMessage: row.last_error_message ?? undefined,
});

export type ReconcileJobOpsViewRow = {
  id: string;
  report_id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  leased_until: string | null;
  retry_after: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  queue_depth: number | null;
  retry_age_seconds: number | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Read-model contract for admin operations endpoints.
 * Backed by `reconcile_job_ops_view` (RLOOP-024).
 */
export type ReconcileAdminReadModel = {
  listJobs: (filters?: {status?: string; limit?: number; offset?: number}) => Promise<ReconcileJobOpsViewRow[]>;
  getJobDetail: (jobId: string) => Promise<ReconcileJobOpsViewRow | null>;
};
