import type {SupabaseClient} from '@supabase/supabase-js';

import {supabase} from '../../services/supabase/client';
import type {RetryDecision} from './reconcileWorker';
import type {
  ReconcileAdminReadModel,
  ReconcileJobOpsViewRow,
  ReconcileJobReplayInput,
  ReconcileJobReplayResult,
  ReconcileJobRow,
  RuntimeReconcileJobRepository,
} from './reconcileJobRepository';
import {mapReconcileJobRowToDomain} from './reconcileJobRepository';

const JOB_TABLE = 'reconcile_jobs';
const OPS_VIEW = 'reconcile_job_ops_view';
const CLAIM_RPC = 'claim_reconcile_job';
const FINALIZE_RPC = 'finalize_reconcile_job';
const AUDIT_TABLE = 'reconcile_audit_log';

const finalizeWithLease = async (
  client: SupabaseClient,
  input: {
    jobId: string;
    leaseToken?: string;
    leaseRevision: number;
    resultStatus: 'succeeded' | 'queued' | 'dead_lettered';
    errorCode?: string;
    errorMessage?: string;
    retryAfter?: string;
    finishedAt?: string;
  },
): Promise<void> => {
  const {error} = await client.rpc(FINALIZE_RPC, {
    p_job_id: input.jobId,
    p_lease_token: input.leaseToken ?? null,
    p_lease_revision: input.leaseRevision,
    p_result_status: input.resultStatus,
    p_error_code: input.errorCode ?? null,
    p_error_message: input.errorMessage ?? null,
    p_retry_after: input.retryAfter ?? null,
    p_finished_at: input.finishedAt ?? null,
  });

  if (error) {
    throw error;
  }
};

export const createSupabaseReconcileJobRepository = (
  client: SupabaseClient = supabase,
): RuntimeReconcileJobRepository => ({
  claimNext: async leaseDurationMs => {
    const {data, error} = await client.rpc(CLAIM_RPC, {
      lease_duration_ms: leaseDurationMs,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return mapReconcileJobRowToDomain(data as ReconcileJobRow);
  },

  markSucceeded: async (job, finishedAt) => {
    await finalizeWithLease(client, {
      jobId: job.id,
      leaseToken: job.leaseToken,
      leaseRevision: job.leaseRevision,
      resultStatus: 'succeeded',
      finishedAt,
    });
  },

  markFailed: async (job, errorCode, errorMessage, decision: RetryDecision) => {
    const resultStatus =
      decision.nextStatus === 'dead_lettered' ? 'dead_lettered' : 'queued';

    await finalizeWithLease(client, {
      jobId: job.id,
      leaseToken: job.leaseToken,
      leaseRevision: job.leaseRevision,
      resultStatus,
      errorCode,
      errorMessage,
      retryAfter: decision.nextRetryAfter,
      finishedAt: resultStatus === 'dead_lettered' ? new Date().toISOString() : undefined,
    });
  },

  replay: async (input: ReconcileJobReplayInput): Promise<ReconcileJobReplayResult> => {
    const replayRequestedAt = new Date().toISOString();

    const {error} = await client
      .from(JOB_TABLE)
      .update({
        status: 'queued',
        leased_until: null,
        lease_token: null,
        retry_after: null,
        last_error_code: input.reasonCode,
        last_error_message: input.reasonMessage,
        updated_at: replayRequestedAt,
      })
      .eq('id', input.jobId);

    if (error) {
      throw error;
    }

    const {error: auditError} = await client.from(AUDIT_TABLE).insert({
      aggregate_type: 'reconcile_job',
      aggregate_id: input.jobId,
      action: 'admin_replay_requested',
      actor_id: input.actorId,
      payload: {
        reasonCode: input.reasonCode,
        reasonMessage: input.reasonMessage,
        reason: input.reason,
        approvalRef: input.approvalRef,
        replayRequestedAt,
      },
      created_at: replayRequestedAt,
    });

    if (auditError) {
      throw auditError;
    }

    return {
      jobId: input.jobId,
      replayRequestedAt,
    };
  },
});

export const createSupabaseReconcileAdminReadModel = (
  client: SupabaseClient = supabase,
): ReconcileAdminReadModel => ({
  listJobs: async filters => {
    let query = client.from(OPS_VIEW).select('*').order('updated_at', {ascending: false});

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (typeof filters?.offset === 'number' && typeof filters?.limit === 'number') {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    } else if (typeof filters?.limit === 'number') {
      query = query.limit(filters.limit);
    }

    const {data, error} = await query.returns<ReconcileJobOpsViewRow[]>();

    if (error) {
      throw error;
    }

    return data ?? [];
  },

  getJobDetail: async jobId => {
    const {data, error} = await client
      .from(OPS_VIEW)
      .select('*')
      .eq('id', jobId)
      .maybeSingle<ReconcileJobOpsViewRow>();

    if (error) {
      throw error;
    }

    return data ?? null;
  },
});
