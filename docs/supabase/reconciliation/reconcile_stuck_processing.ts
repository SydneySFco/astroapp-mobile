/**
 * RLOOP-020 reconciliation skeleton
 *
 * Purpose:
 * - Find user_reports stuck in `processing` past SLA
 * - Safely reconcile to `queued` (retry) or alert
 *
 * Deployment target:
 * - Supabase Edge Function + pg_cron (e.g. every 10 minutes)
 */

import {createClient} from '@supabase/supabase-js';

type ReconcileMode = 'retry' | 'alert_only';

const SLA_MINUTES = Number(process.env.REPORT_PROCESSING_SLA_MINUTES ?? '30');
const MODE = (process.env.RECONCILE_MODE ?? 'retry') as ReconcileMode;

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

async function reconcileStuckProcessing() {
  const thresholdIso = new Date(Date.now() - SLA_MINUTES * 60_000).toISOString();

  const {data, error} = await supabase
    .from('user_reports')
    .select('id,user_id,report_catalog_id,status,updated_at,version')
    .eq('status', 'processing')
    .lt('updated_at', thresholdIso)
    .order('updated_at', {ascending: true})
    .limit(500);

  if (error) {
    throw new Error(`failed to fetch stuck reports: ${error.message}`);
  }

  const candidates = data ?? [];

  for (const report of candidates) {
    if (MODE === 'alert_only') {
      console.log('[reconcile][alert_only] stuck report detected', report);
      continue;
    }

    // Lifecycle guard currently disallows processing -> queued.
    // So recovery path should be one of:
    // 1) set to ready with fallback content by trusted pipeline, OR
    // 2) insert a fresh queued record tied to same order, OR
    // 3) allow privileged override in separate admin RPC.
    // This skeleton uses an audit-first update via rpc placeholder.
    const {error: rpcError} = await supabase.rpc('requeue_stuck_user_report', {
      p_user_report_id: report.id,
      p_reason: `processing timeout > ${SLA_MINUTES}m`,
    });

    if (rpcError) {
      console.error('[reconcile] failed', {reportId: report.id, error: rpcError.message});
      continue;
    }

    console.log('[reconcile] recovered', {reportId: report.id});
  }

  return {
    thresholdIso,
    scanned: candidates.length,
    mode: MODE,
  };
}

reconcileStuckProcessing()
  .then(result => {
    console.log('[reconcile] done', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('[reconcile] fatal', err);
    process.exit(1);
  });
