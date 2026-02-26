import type {SupabaseClient} from '@supabase/supabase-js';

import {supabase} from '../../services/supabase/client';
import {QuarantineAdminApiError} from './quarantineAdminErrors';
import {
  createQuarantineAdminMetricEvent,
  mapActionErrorToMetricOutcome,
  type QuarantineActionResult,
  type QuarantineAdminMetricEvent,
  type QuarantineAdminRepository,
  type QuarantineControlPlaneReadModel,
  type QuarantineDetail,
  type QuarantineDropInput,
  type QuarantineListItem,
  type QuarantineReadFilters,
  type QuarantineRedriveInput,
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

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const mapDbErrorToApiError = (
  error: PostgrestErrorLike,
  context: {replayId: string; action: 'manual_redrive_requested' | 'force_drop_requested'; requestId?: string},
): QuarantineAdminApiError => {
  if (error.code === 'P0002') {
    return new QuarantineAdminApiError({
      code: 'not_found',
      status: 404,
      message: 'Quarantine record not found',
      details: {replayId: context.replayId, sqlstate: error.code},
    });
  }

  if (error.code === 'P0001') {
    return new QuarantineAdminApiError({
      code: 'stale',
      status: 409,
      message: 'Quarantine state is stale for requested transition',
      details: {
        replayId: context.replayId,
        expectedStatus: 'pending_review',
        sqlstate: error.code,
        dbMessage: error.message,
      },
    });
  }

  if (error.code === '23505') {
    return new QuarantineAdminApiError({
      code: 'idempotent_duplicate',
      status: 409,
      message: 'Idempotent request already processed',
      details: {
        replayId: context.replayId,
        requestId: context.requestId,
        action: context.action,
        sqlstate: error.code,
      },
    });
  }

  return new QuarantineAdminApiError({
    code: 'internal_error',
    status: 500,
    message: 'Unexpected quarantine admin error',
    details: {
      replayId: context.replayId,
      action: context.action,
      requestId: context.requestId,
      sqlstate: error.code,
      dbMessage: error.message,
      dbDetails: error.details,
      dbHint: error.hint,
    },
  });
};

/**
 * DB-first requestId dedup contract.
 *
 * SQL note:
 * insert into replay_quarantine_audit_log (...)
 * values (...)
 * on conflict (replay_id, action, request_id) do nothing
 * returning replay_id;
 *
 * returning row => first-seen request
 * no row => idempotent duplicate (already processed)
 */
export type QuarantineAuditConflictBindings = {
  insertActionAuditOnce: (input: {
    replayId: string;
    action: 'manual_redrive_requested' | 'force_drop_requested';
    actorId: string;
    reason: string;
    approvalRef: string;
    requestId: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }) => Promise<{inserted: boolean}>;
};

type DbActionResultRow = {
  replay_id: string;
  final_status: 'redriven' | 'dropped';
  processed_at: string;
  deduped: boolean;
};

const runTransactionalAdminAction = async (
  client: SupabaseClient,
  input: {
    replayId: string;
    action: 'manual_redrive_requested' | 'force_drop_requested';
    audit: QuarantineRedriveInput['audit'] | QuarantineDropInput['audit'];
    note?: string;
  },
): Promise<QuarantineActionResult> => {
  const {data, error} = await client.rpc('replay_quarantine_apply_admin_action', {
    p_replay_id: input.replayId,
    p_action: input.action,
    p_actor_id: input.audit.actorId,
    p_reason: input.audit.reason,
    p_approval_ref: input.audit.approvalRef,
    p_request_id: input.audit.requestId ?? null,
    p_note: input.note ?? null,
    p_processed_at: nowIso(),
  });

  if (error) {
    throw mapDbErrorToApiError(error as PostgrestErrorLike, {
      replayId: input.replayId,
      action: input.action,
      requestId: input.audit.requestId,
    });
  }

  const row = (Array.isArray(data) ? data[0] : data) as DbActionResultRow | null;

  if (!row) {
    throw new QuarantineAdminApiError({
      code: 'internal_error',
      status: 500,
      message: 'Unexpected quarantine admin error',
      details: {replayId: input.replayId, action: input.action, requestId: input.audit.requestId},
    });
  }

  if (row.deduped) {
    throw new QuarantineAdminApiError({
      code: 'idempotent_duplicate',
      status: 409,
      message: 'Idempotent request already processed',
      details: {
        replayId: input.replayId,
        status: row.final_status,
        processedAt: row.processed_at,
        requestId: input.audit.requestId,
      },
    });
  }

  return {
    replayId: row.replay_id,
    status: row.final_status,
    processedAt: row.processed_at,
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

export type QuarantineMetricEmitter = {
  emit: (event: QuarantineAdminMetricEvent) => Promise<void> | void;
};

const emitAdminActionMetric = async (
  emitter: QuarantineMetricEmitter | undefined,
  input: {
    action: 'redrive' | 'drop';
    outcome: 'accepted' | 'deduped' | 'stale_conflict' | 'rejected';
    reason: string;
    replayId: string;
    requestId?: string;
  },
): Promise<void> => {
  if (!emitter) {
    return;
  }

  await emitter.emit(
    createQuarantineAdminMetricEvent({
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      replayId: input.replayId,
      requestId: input.requestId,
    }),
  );
};

export const createSupabaseQuarantineAdminRepository = (
  client: SupabaseClient = supabase,
  deps?: {metrics?: QuarantineMetricEmitter},
): QuarantineAdminRepository => {
  const processAction = async (
    input: {
      replayId: string;
      action: 'manual_redrive_requested' | 'force_drop_requested';
      audit: QuarantineRedriveInput['audit'] | QuarantineDropInput['audit'];
      note?: string;
    },
  ): Promise<QuarantineActionResult> => {
    const metricAction = input.action === 'manual_redrive_requested' ? 'redrive' : 'drop';

    try {
      const result = await runTransactionalAdminAction(client, input);
      await emitAdminActionMetric(deps?.metrics, {
        action: metricAction,
        outcome: 'accepted',
        reason: input.audit.reason,
        replayId: input.replayId,
        requestId: input.audit.requestId,
      });
      return result;
    } catch (error) {
      const errorCode = error instanceof QuarantineAdminApiError ? error.code : undefined;
      await emitAdminActionMetric(deps?.metrics, {
        action: metricAction,
        outcome: mapActionErrorToMetricOutcome(errorCode),
        reason: input.audit.reason,
        replayId: input.replayId,
        requestId: input.audit.requestId,
      });
      throw error;
    }
  };

  return {
    redrive: input =>
      processAction({
        replayId: input.replayId,
        action: 'manual_redrive_requested',
        audit: input.audit,
        note: input.note,
      }),
    forceDrop: input =>
      processAction({
        replayId: input.replayId,
        action: 'force_drop_requested',
        audit: input.audit,
        note: input.note,
      }),
  };
};
