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

export const createSupabaseReconcileJobRepository = (
  client: SupabaseClient = supabase,
): RuntimeReconcileJobRepository => ({
  claimNext: async leaseDurationMs => {
    // TODO: replace with transactional RPC (e.g. claim_reconcile_job) to avoid races.
    const nowIso = new Date().toISOString();

    const {data, error} = await client
      .from(JOB_TABLE)
      .select('*')
      .eq('status', 'queued')
      .or(`retry_after.is.null,retry_after.lte.${nowIso}`)
      .order('retry_after', {ascending: true, nullsFirst: true})
      .order('created_at', {ascending: true})
      .limit(1)
      .maybeSingle<ReconcileJobRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const leasedUntil = new Date(Date.now() + leaseDurationMs).toISOString();

    const {error: updateError} = await client
      .from(JOB_TABLE)
      .update({
        status: 'running',
        leased_until: leasedUntil,
      })
      .eq('id', data.id);

    if (updateError) {
      throw updateError;
    }

    return mapReconcileJobRowToDomain({
      ...data,
      status: 'running',
      leased_until: leasedUntil,
    });
  },

  markSucceeded: async (jobId, finishedAt) => {
    const {error} = await client
      .from(JOB_TABLE)
      .update({
        status: 'succeeded',
        leased_until: null,
        retry_after: null,
        last_error_code: null,
        last_error_message: null,
        updated_at: finishedAt,
      })
      .eq('id', jobId);

    if (error) {
      throw error;
    }
  },

  markFailed: async (jobId, errorCode, errorMessage, decision: RetryDecision) => {
    const {error} = await client
      .from(JOB_TABLE)
      .update({
        status: decision.nextStatus,
        leased_until: null,
        retry_after: decision.nextRetryAfter ?? null,
        last_error_code: errorCode,
        last_error_message: errorMessage,
      })
      .eq('id', jobId);

    if (error) {
      throw error;
    }
  },

  replay: async (input: ReconcileJobReplayInput): Promise<ReconcileJobReplayResult> => {
    // TODO: optionally write to a dedicated replay/audit table in next iteration.
    const replayRequestedAt = new Date().toISOString();

    const {error} = await client
      .from(JOB_TABLE)
      .update({
        status: 'queued',
        leased_until: null,
        retry_after: null,
        last_error_code: input.reasonCode,
        last_error_message: input.reasonMessage,
        updated_at: replayRequestedAt,
      })
      .eq('id', input.jobId);

    if (error) {
      throw error;
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
