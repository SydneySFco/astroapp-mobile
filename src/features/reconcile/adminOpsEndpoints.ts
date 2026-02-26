import type {
  ReconcileAdminReadModel,
  ReconcileJobOpsViewRow,
  RuntimeReconcileJobRepository,
} from './reconcileJobRepository';

export type AdminOpsRole = 'admin_ops' | 'admin_approver';

export type AdminOpsUnauthorizedError = {
  error: {
    code: 'ADMIN_OPS_UNAUTHORIZED';
    message: string;
    requiredAnyRole: AdminOpsRole[];
  };
};

export type AdminOpsRequestContext = {
  actorId?: string;
  roles?: string[];
};

export type AdminOpsRequest<TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown> = {
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  context?: AdminOpsRequestContext;
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
  actorId?: unknown;
  reason?: unknown;
  approvalRef?: unknown;
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

const unauthorized = (requiredAnyRole: AdminOpsRole[]): AdminOpsResponse<AdminOpsUnauthorizedError> => ({
  status: 403,
  data: {
    error: {
      code: 'ADMIN_OPS_UNAUTHORIZED',
      message: 'Admin ops role required',
      requiredAnyRole,
    },
  },
});

const hasAnyRole = (context: AdminOpsRequestContext | undefined, roles: AdminOpsRole[]): boolean => {
  const userRoles = context?.roles ?? [];
  return roles.some(role => userRoles.includes(role));
};

export const listReconcileJobsHandler = async (
  req: AdminOpsRequest<Record<string, string>, ListJobsQuery>,
  deps: AdminOpsEndpointDeps,
): Promise<AdminOpsResponse<{items: ReconcileJobDto[]} | {error: string} | AdminOpsUnauthorizedError>> => {
  const requiredAnyRole: AdminOpsRole[] = ['admin_ops', 'admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

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
): Promise<AdminOpsResponse<{item: ReconcileJobDto} | {error: string} | AdminOpsUnauthorizedError>> => {
  const requiredAnyRole: AdminOpsRole[] = ['admin_ops', 'admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

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
): Promise<AdminOpsResponse<{jobId: string; replayRequestedAt: string} | {error: string} | AdminOpsUnauthorizedError>> => {
  const requiredAnyRole: AdminOpsRole[] = ['admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

  const jobId = parseOptionalString(req.params?.jobId);
  if (!jobId) {
    return {status: 400, data: {error: 'jobId is required'}};
  }

  const reasonCode = parseOptionalString(req.body?.reasonCode) ?? 'ADMIN_REPLAY_REQUESTED';
  const reasonMessage = parseOptionalString(req.body?.reasonMessage) ?? 'Replay requested by admin ops endpoint';
  const actorId = parseOptionalString(req.body?.actorId) ?? req.context?.actorId;
  const reason = parseOptionalString(req.body?.reason);
  const approvalRef = parseOptionalString(req.body?.approvalRef);

  if (!actorId || !reason || !approvalRef) {
    return {
      status: 400,
      data: {error: 'actorId, reason and approvalRef are required'},
    };
  }

  const replay = await deps.repository.replay({
    jobId,
    reasonCode,
    reasonMessage,
    actorId,
    reason,
    approvalRef,
  });

  return {
    status: 202,
    data: replay,
  };
};
