import type {
  ReconcileAdminReadModel,
  ReconcileJobOpsViewRow,
  RuntimeReconcileJobRepository,
} from './reconcileJobRepository';

export type AdminOpsRequest<TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown> = {
  params?: TParams;
  query?: TQuery;
  body?: TBody;
};

export type AdminOpsResponse<TData> = {
  status: number;
  data: TData;
};

export type ReconcileJobDto = {
  id: string;
  reportId: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  leasedUntil: string | null;
  retryAfter: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  queueDepth: number | null;
  retryAgeSeconds: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ListJobsQuery = {
  status?: unknown;
  limit?: unknown;
  offset?: unknown;
};

export type ReplayRequestBody = {
  reasonCode?: unknown;
  reasonMessage?: unknown;
  requestedBy?: unknown;
};

export type AdminOpsEndpointDeps = {
  readModel: ReconcileAdminReadModel;
  repository: RuntimeReconcileJobRepository;
};

const toJobDto = (row: ReconcileJobOpsViewRow): ReconcileJobDto => ({
  id: row.id,
  reportId: row.report_id,
  status: row.status,
  attemptCount: row.attempt_count,
  maxAttempts: row.max_attempts,
  leasedUntil: row.leased_until,
  retryAfter: row.retry_after,
  lastErrorCode: row.last_error_code,
  lastErrorMessage: row.last_error_message,
  queueDepth: row.queue_depth,
  retryAgeSeconds: row.retry_age_seconds,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

export const listReconcileJobsHandler = async (
  req: AdminOpsRequest<Record<string, string>, ListJobsQuery>,
  deps: AdminOpsEndpointDeps,
): Promise<AdminOpsResponse<{items: ReconcileJobDto[]} | {error: string}>> => {
  const status = parseOptionalString(req.query?.status);
  const limit = parseOptionalNumber(req.query?.limit);
  const offset = parseOptionalNumber(req.query?.offset);

  if ((limit !== undefined && limit < 1) || (offset !== undefined && offset < 0)) {
    return {status: 400, data: {error: 'Invalid pagination query params'}};
  }

  const rows = await deps.readModel.listJobs({status, limit, offset});

  return {
    status: 200,
    data: {items: rows.map(toJobDto)},
  };
};

export const getReconcileJobDetailHandler = async (
  req: AdminOpsRequest<{jobId: string}>,
  deps: Pick<AdminOpsEndpointDeps, 'readModel'>,
): Promise<AdminOpsResponse<{item: ReconcileJobDto} | {error: string}>> => {
  const jobId = parseOptionalString(req.params?.jobId);
  if (!jobId) {
    return {status: 400, data: {error: 'jobId is required'}};
  }

  const row = await deps.readModel.getJobDetail(jobId);
  if (!row) {
    return {status: 404, data: {error: 'Job not found'}};
  }

  return {
    status: 200,
    data: {item: toJobDto(row)},
  };
};

export const replayReconcileJobHandler = async (
  req: AdminOpsRequest<{jobId: string}, Record<string, unknown>, ReplayRequestBody>,
  deps: Pick<AdminOpsEndpointDeps, 'repository'>,
): Promise<AdminOpsResponse<{jobId: string; replayRequestedAt: string} | {error: string}>> => {
  const jobId = parseOptionalString(req.params?.jobId);
  if (!jobId) {
    return {status: 400, data: {error: 'jobId is required'}};
  }

  const reasonCode = parseOptionalString(req.body?.reasonCode) ?? 'ADMIN_REPLAY_REQUESTED';
  const reasonMessage = parseOptionalString(req.body?.reasonMessage) ?? 'Replay requested by admin ops endpoint';
  const replay = await deps.repository.replay({
    jobId,
    reasonCode,
    reasonMessage,
  });

  return {
    status: 202,
    data: replay,
  };
};
