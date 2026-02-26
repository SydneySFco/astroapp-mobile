export type QuarantineStatus = 'pending_review' | 'redriven' | 'dropped';

export type QuarantineReason =
  | 'max_replay_cap_reached'
  | 'poison_message_fatal_error'
  | 'operator_force_drop'
  | 'unknown';

export type QuarantineListItem = {
  replayId: string;
  eventId: string;
  route: string;
  status: QuarantineStatus;
  quarantineReason: QuarantineReason | string;
  replayCount: number;
  failedAt: string | null;
  quarantinedAt: string;
  lastErrorClassification: 'retryable' | 'fatal' | 'unknown' | null;
  lastErrorMessage: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type QuarantineDetail = QuarantineListItem & {
  dedupKey: string | null;
  payload: Record<string, unknown> | null;
  headers: Record<string, string> | null;
  originalDeadLetter: Record<string, unknown> | null;
  auditTrail: QuarantineAuditEvent[];
};

export type QuarantineAuditEvent = {
  action: 'quarantined' | 'manual_redrive_requested' | 'force_drop_requested' | 'status_changed';
  actorId: string;
  reason: string;
  approvalRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type QuarantineReadFilters = {
  status?: QuarantineStatus;
  route?: string;
  reason?: string;
  limit?: number;
  offset?: number;
};

export type QuarantineControlPlaneReadModel = {
  listQuarantined: (filters?: QuarantineReadFilters) => Promise<QuarantineListItem[]>;
  getQuarantinedDetail: (replayId: string) => Promise<QuarantineDetail | null>;
};

export type QuarantineAuditInput = {
  actorId: string;
  reason: string;
  approvalRef: string;
  requestId?: string;
};

export type QuarantineRedriveInput = {
  replayId: string;
  audit: QuarantineAuditInput;
  note?: string;
};

export type QuarantineDropInput = {
  replayId: string;
  audit: QuarantineAuditInput;
  note?: string;
};

export type QuarantineActionResult = {
  replayId: string;
  status: Exclude<QuarantineStatus, 'pending_review'>;
  processedAt: string;
};

export type QuarantineAdminRepository = {
  redrive: (input: QuarantineRedriveInput) => Promise<QuarantineActionResult>;
  forceDrop: (input: QuarantineDropInput) => Promise<QuarantineActionResult>;
};

export type QuarantineAdminRole = 'admin_ops' | 'admin_approver';

export type QuarantineAdminUnauthorizedError = {
  error: {
    code: 'QUARANTINE_ADMIN_UNAUTHORIZED';
    message: string;
    requiredAnyRole: QuarantineAdminRole[];
  };
};

export type QuarantineAdminContext = {
  actorId?: string;
  roles?: string[];
};

export type QuarantineAdminRequest<
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
  TBody = unknown,
> = {
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  context?: QuarantineAdminContext;
};

export type QuarantineAdminResponse<TData> = {
  status: number;
  data: TData;
};

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

const unauthorized = (
  requiredAnyRole: QuarantineAdminRole[],
): QuarantineAdminResponse<QuarantineAdminUnauthorizedError> => ({
  status: 403,
  data: {
    error: {
      code: 'QUARANTINE_ADMIN_UNAUTHORIZED',
      message: 'Quarantine admin role required',
      requiredAnyRole,
    },
  },
});

const hasAnyRole = (context: QuarantineAdminContext | undefined, roles: QuarantineAdminRole[]): boolean => {
  const userRoles = context?.roles ?? [];
  return roles.some(role => userRoles.includes(role));
};

export const listQuarantinedHandler = async (
  req: QuarantineAdminRequest<Record<string, string>, Record<string, unknown>>,
  deps: {readModel: QuarantineControlPlaneReadModel},
): Promise<
  QuarantineAdminResponse<{items: QuarantineListItem[]} | {error: string} | QuarantineAdminUnauthorizedError>
> => {
  const requiredAnyRole: QuarantineAdminRole[] = ['admin_ops', 'admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

  const status = parseOptionalString(req.query?.status) as QuarantineStatus | undefined;
  const route = parseOptionalString(req.query?.route);
  const reason = parseOptionalString(req.query?.reason);
  const limit = parseOptionalNumber(req.query?.limit);
  const offset = parseOptionalNumber(req.query?.offset);

  if ((limit !== undefined && limit < 1) || (offset !== undefined && offset < 0)) {
    return {status: 400, data: {error: 'Invalid pagination query params'}};
  }

  if (
    status !== undefined &&
    status !== 'pending_review' &&
    status !== 'redriven' &&
    status !== 'dropped'
  ) {
    return {status: 400, data: {error: 'Invalid status filter'}};
  }

  const rows = await deps.readModel.listQuarantined({status, route, reason, limit, offset});

  return {
    status: 200,
    data: {items: rows},
  };
};

export const getQuarantinedDetailHandler = async (
  req: QuarantineAdminRequest<{replayId: string}>,
  deps: {readModel: QuarantineControlPlaneReadModel},
): Promise<
  QuarantineAdminResponse<{item: QuarantineDetail} | {error: string} | QuarantineAdminUnauthorizedError>
> => {
  const requiredAnyRole: QuarantineAdminRole[] = ['admin_ops', 'admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

  const replayId = parseOptionalString(req.params?.replayId);
  if (!replayId) {
    return {status: 400, data: {error: 'replayId is required'}};
  }

  const row = await deps.readModel.getQuarantinedDetail(replayId);
  if (!row) {
    return {status: 404, data: {error: 'Quarantine record not found'}};
  }

  return {
    status: 200,
    data: {item: row},
  };
};

type QuarantineActionBody = {
  actorId?: unknown;
  reason?: unknown;
  approvalRef?: unknown;
  requestId?: unknown;
  note?: unknown;
};

export const redriveQuarantinedHandler = async (
  req: QuarantineAdminRequest<{replayId: string}, Record<string, unknown>, QuarantineActionBody>,
  deps: {repository: QuarantineAdminRepository},
): Promise<
  QuarantineAdminResponse<QuarantineActionResult | {error: string} | QuarantineAdminUnauthorizedError>
> => {
  const requiredAnyRole: QuarantineAdminRole[] = ['admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

  const replayId = parseOptionalString(req.params?.replayId);
  if (!replayId) {
    return {status: 400, data: {error: 'replayId is required'}};
  }

  const actorId = parseOptionalString(req.body?.actorId) ?? req.context?.actorId;
  const reason = parseOptionalString(req.body?.reason);
  const approvalRef = parseOptionalString(req.body?.approvalRef);
  const requestId = parseOptionalString(req.body?.requestId);
  const note = parseOptionalString(req.body?.note);

  if (!actorId || !reason || !approvalRef) {
    return {status: 400, data: {error: 'actorId, reason and approvalRef are required'}};
  }

  const result = await deps.repository.redrive({
    replayId,
    audit: {actorId, reason, approvalRef, requestId},
    note,
  });

  return {status: 202, data: result};
};

export const dropQuarantinedHandler = async (
  req: QuarantineAdminRequest<{replayId: string}, Record<string, unknown>, QuarantineActionBody>,
  deps: {repository: QuarantineAdminRepository},
): Promise<
  QuarantineAdminResponse<QuarantineActionResult | {error: string} | QuarantineAdminUnauthorizedError>
> => {
  const requiredAnyRole: QuarantineAdminRole[] = ['admin_approver'];
  if (!hasAnyRole(req.context, requiredAnyRole)) {
    return unauthorized(requiredAnyRole);
  }

  const replayId = parseOptionalString(req.params?.replayId);
  if (!replayId) {
    return {status: 400, data: {error: 'replayId is required'}};
  }

  const actorId = parseOptionalString(req.body?.actorId) ?? req.context?.actorId;
  const reason = parseOptionalString(req.body?.reason);
  const approvalRef = parseOptionalString(req.body?.approvalRef);
  const requestId = parseOptionalString(req.body?.requestId);
  const note = parseOptionalString(req.body?.note);

  if (!actorId || !reason || !approvalRef) {
    return {status: 400, data: {error: 'actorId, reason and approvalRef are required'}};
  }

  const result = await deps.repository.forceDrop({
    replayId,
    audit: {actorId, reason, approvalRef, requestId},
    note,
  });

  return {status: 202, data: result};
};

export const quarantineMetricNames = {
  volume: 'replay_quarantine_volume_total',
  redriveSuccessRate: 'replay_quarantine_redrive_success_rate',
  dropRate: 'replay_quarantine_drop_rate',
} as const;

export const computeQuarantineRates = (input: {
  quarantinedCount: number;
  redrivenCount: number;
  droppedCount: number;
}): {redriveSuccessRate: number; dropRate: number} => {
  const denominator = Math.max(1, input.quarantinedCount);

  return {
    redriveSuccessRate: input.redrivenCount / denominator,
    dropRate: input.droppedCount / denominator,
  };
};
