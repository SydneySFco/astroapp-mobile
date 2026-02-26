# RLOOP-022 Notes — Privileged Override Policy + Reconcile Path

## Objective
`user_reports.status='processing'` durumunda SLA'yı aşan ve pipeline tarafından ilerlemeyen kayıtlar için, **RLOOP-020 lifecycle guard'ını bozmadan** güvenli recovery akışı tanımlamak.

## What Changed

### 1) Policy & Governance
- `docs/PRIVILEGED_OVERRIDE_POLICY.md` eklendi.
- Kapsam:
  - Actor constraints (kim tetikleyebilir, kim onaylar)
  - Two-person approval flow (requestor + approver ayrımı)
  - Audit schema (immutable olay günlüğü)
  - Rollback / kill-switch ilkeleri

### 2) Executable Reconcile Path (Guard-Compatible)
- Yeni SQL draft eklendi:
  - `docs/supabase/migrations/20260226142000_rloop022_privileged_reconcile_override_draft.sql`
- Yeni edge function skeleton eklendi:
  - `docs/supabase/reconciliation/reconcile_stuck_processing_override.ts`

Temel strateji:
- `processing -> queued` gibi geçersiz transition denemek yerine,
- `public.user_report_reconcile_jobs` tablosuna **idempotent reconcile job** enqueue edilir,
- Worker bu job'u tüketip aynı kaydı tekrar işlemeye zorlar veya kontrollü finalize eder,
- `user_reports` lifecycle kuralları (queued->processing->ready) korunur.

### 3) Failure Matrix
- `docs/FAILURE_MODE_TEST_MATRIX_RLOOP-022.md` eklendi.
- Senaryolar:
  - timeout
  - duplicate event
  - stale update
  - partial failure

### 4) Client Note (UI/Telemetry)
- Bu notlar policy dokümanında ve matrix içinde referanslandı.
- Minimal UI durumları:
  - `reconcile_in_progress`
  - `reconcile_resolved`
- Telemetry olayları:
  - `report_reconcile_requested`
  - `report_reconcile_completed`
  - `report_reconcile_failed`

## RLOOP-021 ile Reconcile
RLOOP-021 draft RPC (`requeue_stuck_user_report`) doğrudan `processing -> queued` denediği için guard ile çatışma riski taşıyordu. RLOOP-022’de yaklaşım, statü geri sarımı yerine **out-of-band reconcile job** üretimine taşındı.

## Validation
- `yarn lint`
- `yarn typecheck`

(Çıktı detayları PR özetinde raporlanır.)
