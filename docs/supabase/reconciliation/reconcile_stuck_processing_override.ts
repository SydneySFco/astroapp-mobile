/**
 * RLOOP-022 reconciliation skeleton (guard-compatible override path)
 *
 * Purpose:
 * - Find user_reports stuck in `processing` past SLA
 * - Enqueue privileged reconcile job instead of illegal status rollback
 *
 * Deployment:
 * - Supabase Edge Function + pg_cron (e.g. every 10 minutes)
 */

import {createClient} from '@supabase/supabase-js';

type ReconcileMode = 'enqueue' | 'alert_only';

const SLA_MINUTES = Number(process.env.REPORT_PROCESSING_SLA_MINUTES ?? '30');
const MODE = (process.env.RECONCILE_MODE ?? 'enqueue') as ReconcileMode;
const APPROVAL_REF = process.env.RECONCILE_APPROVAL_REF ?? '';
const INCIDENT_REF = process.env.RECONCILE_INCIDENT_REF ?? 'scheduled-reconcile';

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

async function reconcileStuckProcessingOverride() {
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
  let enqueued = 0;
  let failed = 0;

  for (const report of candidates) {
    if (MODE === 'alert_only') {
      console.log('[reconcile-override][alert_only] stuck report detected', report);
      continue;
    }

    if (!APPROVAL_REF) {
      throw new Error('RECONCILE_APPROVAL_REF is required when RECONCILE_MODE=enqueue');
    }

    const {data: rpcData, error: rpcError} = await supabase.rpc('enqueue_stuck_report_reconcile', {
      p_user_report_id: report.id,
      p_reason: `processing timeout > ${SLA_MINUTES}m`,
      p_incident_ref: INCIDENT_REF,
      p_approval_ref: APPROVAL_REF,
      p_max_age_minutes: SLA_MINUTES,
    });

    if (rpcError) {
      failed += 1;
      console.error('[reconcile-override] enqueue failed', {
        reportId: report.id,
        error: rpcError.message,
      });
      continue;
    }

    const first = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (first?.success) {
      enqueued += 1;
      console.log('[reconcile-override] enqueued', {
        reportId: report.id,
        reconcileJobId: first?.reconcile_job_id,
        requestId: first?.request_id,
      });
    } else {
      console.warn('[reconcile-override] noop', {
        reportId: report.id,
        message: first?.message,
      });
    }
  }

  return {
    thresholdIso,
    scanned: candidates.length,
    enqueued,
    failed,
    mode: MODE,
  };
}

reconcileStuckProcessingOverride()
  .then(result => {
    console.log('[reconcile-override] done', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('[reconcile-override] fatal', err);
    process.exit(1);
  });
