# RLOOP-028 Notes — Finalize Outcome Standardization + Conflict Telemetry + CI Concurrency Skeleton

## Summary
Bu iterasyonda reconcile finalize akışı üç ana başlıkta iyileştirildi:

1. `finalize` için explicit outcome contract standardı (`applied | idempotent | stale_blocked`)
2. stale finalize conflict için ayrı telemetry event/counter
3. CI dostu concurrency test planı + lightweight test skeleton

## Changes

### 1) Finalize outcome contract
- Yeni migration:
  - `docs/supabase/migrations/20260226190000_rloop028_finalize_outcome_contract.sql`
- `finalize_reconcile_job` artık stale durumda exception fırlatmak yerine `stale_blocked` outcome döner.
- Return type: `table(outcome text, job reconcile_jobs)`

### 2) Adapter + runtime alignment
- `FinalizeOutcome` tipi eklendi (`reconcileWorker.ts`).
- Repository finalize methods artık outcome döndürüyor.
- Runtime:
  - `applied/idempotent` -> `reconcile_job_finalized`
  - `stale_blocked` -> `reconcile_job_finalize_stale_conflict`

### 3) Concurrency tests (CI-friendly)
- Matrix güncellendi (RLOOP-028 contract + telemetry doğrulamaları).
- Unit test skeleton eklendi:
  - outcome davranışı
  - stale conflict telemetry routing

## Validation
- `yarn lint`
- `yarn typecheck`

## Follow-up (RLOOP-029 suggestion)
- Supabase integration-level concurrency test harness (ephemeral schema / seeded jobs)
- finalize race senaryolarını parallel workers ile gerçek DB transaction seviyesinde koşturup CI nightly pipeline’a bağlama
- stale/idempotent ratio için SLO alert önerisi
