# FINALIZE OUTCOME CONTRACT — RLOOP-028

## Objective
`finalize_reconcile_job` çağrısında outcome semantiğini standartlaştırmak:

- `applied`
- `idempotent`
- `stale_blocked`

Bu contract, runtime/adapter/telemetry katmanlarında aynı şekilde yorumlanır.

## SQL Contract (RPC)
Function:
- `public.finalize_reconcile_job(...)`

Return type:
- `table(outcome text, job reconcile_jobs)`

Outcome mapping:
1. `applied`
   - Job `running` durumunda ve `(lease_token, lease_revision)` current owner ile eşleşiyorsa finalize update uygulanır.
2. `idempotent`
   - Aynı finalize isteği (`finalized_lease_token/revision/result_status`) daha önce uygulanmışsa no-op dönüş.
3. `stale_blocked`
   - Ownership eşleşmiyorsa veya stale finalize gelmişse update yapılmaz; exception yerine explicit outcome döner.

## Adapter Mapping
File: `src/features/reconcile/supabaseReconcileJobRepository.ts`

- RPC response içindeki `outcome` doğrudan `FinalizeOutcome` tipine map edilir.
- Repository methods:
  - `markSucceeded(...) => Promise<FinalizeOutcome>`
  - `markFailed(...) => Promise<FinalizeOutcome>`

## Runtime Behavior
File: `src/features/reconcile/reconcileWorkerRuntime.ts`

- `outcome=applied|idempotent`:
  - standart `reconcile_job_finalized` telemetry eventi emit edilir.
- `outcome=stale_blocked`:
  - finalize eventi yerine `reconcile_job_finalize_stale_conflict` telemetry eventi emit edilir.

## Telemetry Naming
Lifecycle zinciri ile uyumlu event isimleri:
- `reconcile_job_claimed`
- `reconcile_job_finalized`
- `reconcile_job_finalize_stale_conflict` (yeni)

Counter semantic:
- `reconcile_job_finalize_stale_conflict_count`

## Why this matters
- Exception parsing yerine deterministic outcome contract.
- DB concurrency yarışlarında caller davranışı sadeleşir.
- Stale conflict görünürlüğü (observability) ayrı metric/event ile netleşir.
