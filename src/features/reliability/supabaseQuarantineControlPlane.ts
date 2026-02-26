import type {SupabaseClient} from '@supabase/supabase-js';

import {supabase} from '../../services/supabase/client';
import type {
  QuarantineActionResult,
  QuarantineAdminRepository,
  QuarantineControlPlaneReadModel,
  QuarantineDetail,
  QuarantineDropInput,
  QuarantineListItem,
  QuarantineReadFilters,
  QuarantineRedriveInput,
} from './quarantineControlPlane';

const QUARANTINE_TABLE = 'replay_quarantine_messages';
const QUARANTINE_AUDIT_TABLE = 'replay_quarantine_audit_log';

type QuarantineMessageRow = {
  replay_id: string;
  event_id: string;
  dedup_key: string | null;
  route: string;
  status: 'pending_review' | 'redriven' | 'dropped';
  quarantine_reason: string;
  replay_count: number;
  failed_at: string | null;
  quarantined_at: string;
  last_error_classification: 'retryable' | 'fatal' | 'unknown' | null;
  last_error_message: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  payload: Record<string, unknown> | null;
  headers: Record<string, string> | null;
  original_dead_letter: Record<string, unknown> | null;
  updated_at: string;
};

type QuarantineAuditRow = {
  action: 'quarantined' | 'manual_redrive_requested' | 'force_drop_requested' | 'status_changed';
  actor_id: string;
  reason: string;
  approval_ref: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const mapListItem = (row: QuarantineMessageRow): QuarantineListItem => ({
  replayId: row.replay_id,
  eventId: row.event_id,
  route: row.route,
  status: row.status,
  quarantineReason: row.quarantine_reason,
  replayCount: row.replay_count,
  failedAt: row.failed_at,
  quarantinedAt: row.quarantined_at,
  lastErrorClassification: row.last_error_classification,
  lastErrorMessage: row.last_error_message,
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
});

const mapDetail = (row: QuarantineMessageRow, auditTrail: QuarantineAuditRow[]): QuarantineDetail => ({
  ...mapListItem(row),
  dedupKey: row.dedup_key,
  payload: row.payload,
  headers: row.headers,
  originalDeadLetter: row.original_dead_letter,
  auditTrail: auditTrail.map(audit => ({
    action: audit.action,
    actorId: audit.actor_id,
    reason: audit.reason,
    approvalRef: audit.approval_ref,
    createdAt: audit.created_at,
    metadata: audit.metadata ?? undefined,
  })),
});

const nowIso = () => new Date().toISOString();

const ensurePendingReviewTransition = async (
  client: SupabaseClient,
  replayId: string,
  nextStatus: 'redriven' | 'dropped',
  processedAt: string,
): Promise<void> => {
  const patch =
    nextStatus === 'redriven'
      ? {status: nextStatus, redriven_at: processedAt, reviewed_at: processedAt, updated_at: processedAt}
      : {status: nextStatus, dropped_at: processedAt, reviewed_at: processedAt, updated_at: processedAt};

  const {data, error} = await client
    .from(QUARANTINE_TABLE)
    .update(patch)
    .eq('replay_id', replayId)
    .eq('status', 'pending_review')
    .select('replay_id')
    .maybeSingle<{replay_id: string}>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('quarantine_stale_or_not_found');
  }
};

const logAuditEvent = async (
  client: SupabaseClient,
  input: {
    replayId: string;
    action: 'manual_redrive_requested' | 'force_drop_requested' | 'status_changed';
    actorId: string;
    reason: string;
    approvalRef: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  const {error} = await client.from(QUARANTINE_AUDIT_TABLE).insert({
    replay_id: input.replayId,
    action: input.action,
    actor_id: input.actorId,
    reason: input.reason,
    approval_ref: input.approvalRef,
    request_id: input.requestId ?? null,
    metadata: input.metadata ?? null,
    created_at: nowIso(),
  });

  if (error) {
    throw error;
  }
};

const dedupeActionByRequestId = async (
  client: SupabaseClient,
  input: {
    replayId: string;
    action: 'manual_redrive_requested' | 'force_drop_requested';
    requestId?: string;
  },
): Promise<QuarantineActionResult | null> => {
  if (!input.requestId) {
    return null;
  }

  const {data, error} = await client
    .from(QUARANTINE_AUDIT_TABLE)
    .select('request_id, metadata')
    .eq('replay_id', input.replayId)
    .eq('action', input.action)
    .eq('request_id', input.requestId)
    .order('created_at', {ascending: false})
    .limit(1)
    .maybeSingle<{request_id: string | null; metadata: Record<string, unknown> | null}>();

  if (error) {
    throw error;
  }

  const status = input.action === 'manual_redrive_requested' ? 'redriven' : 'dropped';
  const processedAt =
    data?.metadata && typeof data.metadata.processedAt === 'string' ? data.metadata.processedAt : null;

  if (!data || !processedAt) {
    return null;
  }

  return {
    replayId: input.replayId,
    status,
    processedAt,
  };
};

export const createSupabaseQuarantineControlPlaneReadModel = (
  client: SupabaseClient = supabase,
): QuarantineControlPlaneReadModel => ({
  listQuarantined: async (filters?: QuarantineReadFilters): Promise<QuarantineListItem[]> => {
    let query = client.from(QUARANTINE_TABLE).select('*').order('quarantined_at', {ascending: false});

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.route) {
      query = query.eq('route', filters.route);
    }

    if (filters?.reason) {
      query = query.eq('quarantine_reason', filters.reason);
    }

    if (typeof filters?.offset === 'number' && typeof filters?.limit === 'number') {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    } else if (typeof filters?.limit === 'number') {
      query = query.limit(filters.limit);
    }

    const {data, error} = await query.returns<QuarantineMessageRow[]>();
    if (error) {
      throw error;
    }

    return (data ?? []).map(mapListItem);
  },

  getQuarantinedDetail: async (replayId: string): Promise<QuarantineDetail | null> => {
    const [{data: message, error: messageError}, {data: auditRows, error: auditError}] = await Promise.all([
      client
        .from(QUARANTINE_TABLE)
        .select('*')
        .eq('replay_id', replayId)
        .maybeSingle<QuarantineMessageRow>(),
      client
        .from(QUARANTINE_AUDIT_TABLE)
        .select('action, actor_id, reason, approval_ref, created_at, metadata')
        .eq('replay_id', replayId)
        .order('created_at', {ascending: false})
        .returns<QuarantineAuditRow[]>(),
    ]);

    if (messageError) {
      throw messageError;
    }

    if (auditError) {
      throw auditError;
    }

    if (!message) {
      return null;
    }

    return mapDetail(message, auditRows ?? []);
  },
});

const processAction = async (
  client: SupabaseClient,
  input: {
    replayId: string;
    action: 'manual_redrive_requested' | 'force_drop_requested';
    audit: QuarantineRedriveInput['audit'] | QuarantineDropInput['audit'];
    note?: string;
  },
): Promise<QuarantineActionResult> => {
  const deduped = await dedupeActionByRequestId(client, {
    replayId: input.replayId,
    action: input.action,
    requestId: input.audit.requestId,
  });

  if (deduped) {
    return deduped;
  }

  const status = input.action === 'manual_redrive_requested' ? 'redriven' : 'dropped';
  const processedAt = nowIso();

  await ensurePendingReviewTransition(client, input.replayId, status, processedAt);

  await logAuditEvent(client, {
    replayId: input.replayId,
    action: input.action,
    actorId: input.audit.actorId,
    reason: input.audit.reason,
    approvalRef: input.audit.approvalRef,
    requestId: input.audit.requestId,
    metadata: {
      note: input.note,
      processedAt,
      outcome: status,
    },
  });

  await logAuditEvent(client, {
    replayId: input.replayId,
    action: 'status_changed',
    actorId: input.audit.actorId,
    reason: input.audit.reason,
    approvalRef: input.audit.approvalRef,
    requestId: input.audit.requestId,
    metadata: {
      fromStatus: 'pending_review',
      toStatus: status,
      note: input.note,
      processedAt,
    },
  });

  return {
    replayId: input.replayId,
    status,
    processedAt,
  };
};

export const createSupabaseQuarantineAdminRepository = (
  client: SupabaseClient = supabase,
): QuarantineAdminRepository => ({
  redrive: input =>
    processAction(client, {
      replayId: input.replayId,
      action: 'manual_redrive_requested',
      audit: input.audit,
      note: input.note,
    }),
  forceDrop: input =>
    processAction(client, {
      replayId: input.replayId,
      action: 'force_drop_requested',
      audit: input.audit,
      note: input.note,
    }),
});
