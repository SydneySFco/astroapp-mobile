# RLOOP-027 Notes — Idempotent Finalize + Optimistic Lease Token Hardening

## Summary
Bu iterasyonda reconcile worker finalize akışı, stale worker çakışmalarına karşı optimistic ownership kontrolü ile sertleştirildi ve duplicate finalize çağrıları idempotent hale getirildi.

## Changes

### 1) Lease token + revision strategy
- `reconcile_jobs` tablosuna eklendi:
  - `lease_token uuid`
  - `lease_revision bigint not null default 0`
  - `finalized_lease_token uuid`
  - `finalized_lease_revision bigint`
  - `finalized_result_status text`
- `claim_reconcile_job` artık her claim’de:
  - `lease_revision = lease_revision + 1`
  - `lease_token = gen_random_uuid()`
  üretir.

### 2) Idempotent finalize behavior
- Yeni RPC: `finalize_reconcile_job(...)`
- Finalize accepted only if:
  - job `running`
  - `(lease_token, lease_revision)` eşleşiyor.
- Duplicate same finalize request:
  - `finalized_lease_token/revision/result_status` match ise no-op + consistent return.
- Mismatch durumunda:
  - stale finalize exception ile bloklanır.

### 3) Runtime adapter updates
- Worker domain model `leaseToken` + `leaseRevision` taşıyor.
- Supabase repository finalize çağrıları DB update yerine `finalize_reconcile_job` RPC üzerinden gidiyor.
- `reconcile_job_claimed` telemetry eventine lease metadata eklendi.

### 4) Read model alignment
- `reconcile_job_ops_view` view tanımı lease sütunlarını (`lease_token`, `lease_revision`) içerecek şekilde güncellendi.

## Migration
- `docs/supabase/migrations/20260226174000_rloop027_idempotent_finalize_lease_token_hardening.sql`

## Risk / Notes
- Stale finalize artık explicit exception üretir; caller retry stratejisinde bu exception’ı “ownership lost” olarak ele almalı.
- Replay/admin requeue akışında `lease_token` temizlenir, `lease_revision` monotonic kalır.

## Next suggestion (RLOOP-028)
- `finalize_reconcile_job` için structured return (`applied|idempotent|stale_blocked`) + explicit SQLSTATE code standardization.
- Worker runtime’da stale finalize exception metric ayrıştırması (`finalize_stale_conflict_count`).
- Concurrent integration tests (DB-level) CI pipeline’a ekleme.
