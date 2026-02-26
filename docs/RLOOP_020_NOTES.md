# RLOOP-020 Notes — Backend Enforcement (Supabase)

## Objective
Lifecycle güvenilirliğini server-side otoriteye yaklaştırmak için executable enforcement hazırlığını teslim etmek.

## Delivered

### 1) DB Transition Guard (Executable Draft)
- Eklendi:
  - `docs/supabase/migrations/20260226130500_rloop020_user_reports_enforcement.sql`
- İçerik:
  - `user_reports.status` transition validator trigger
  - Invalid transition'ları DB katmanında `23514` ile bloklama

### 2) Versioning Preparation (`user_reports`)
- Migration içinde:
  - `version integer not null default 1`
  - `updated_at timestamptz not null default now(utc)`
- Her update'te:
  - `version` +1
  - `updated_at` current UTC timestamp

### 3) Reconciliation Job Plan
- Eklendi skeleton:
  - `docs/supabase/reconciliation/reconcile_stuck_processing.ts`
- Kapsam:
  - `processing` durumunda SLA aşan kayıtları bulma
  - `alert_only` / `retry` modları
  - privileged RPC (`requeue_stuck_user_report`) placeholder çağrısı

### 4) Client Compatibility (Minimal)
- `src/features/reports/reportsApi.ts` içinde `user_reports` select alanına `updated_at` + `version` eklendi.
- Mevcut UI/lifecycle davranışı korunur; metadata sadece freshness uyumluluğu içindir.

### 5) Plan Docs Update
- Güncellendi:
  - `docs/SUPABASE_BACKEND_PLAN.md`

## Validation
- `yarn lint`
- `yarn typecheck`

## Risks / Notes
- Reconciliation retry aksiyonu için `processing -> queued` geçişi guard tarafından bloklanır; bu nedenle recovery admin-RPC veya yeni report record stratejisi ile yapılmalıdır.
- Production rollout öncesi migration, staging data üzerinde dry-run edilmelidir.
