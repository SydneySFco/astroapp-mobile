# RLOOP-026 NOTES — Race-safe Claim RPC + Admin Authz Hardening

Bu iterasyonda iki ana iyileştirme yapıldı:

1. Reconcile worker claim akışı race-safe hale getirildi.
2. Admin ops endpointlerinde rol tabanlı authz ve replay audit metadata zorunluluğu eklendi.

---

## 1) Race-safe claim RPC

### Migration
- `docs/supabase/migrations/20260226133000_rloop026_race_safe_claim_authz_hardening.sql`

### Eklenenler
- `public.claim_reconcile_job(lease_duration_ms integer) returns public.reconcile_jobs`
  - `FOR UPDATE SKIP LOCKED` ile tek transaction içinde aday job seçer.
  - `status in ('queued', 'running')` + `leased_until <= now()` şartı ile lease’i bitmiş running job tekrar claim edilebilir.
  - Lease set + status update atomik şekilde yapılır.

### Runtime adapter değişikliği
- `src/features/reconcile/supabaseReconcileJobRepository.ts`
  - Eski iki adımlı `select + update` flow kaldırıldı.
  - Claim işlemi RPC (`claim_reconcile_job`) üstünden yapılır.

---

## 2) Endpoint authz hardening

### Dosya
- `src/features/reconcile/adminOpsEndpoints.ts`

### Değişiklik
- Request context’e `roles` / `actorId` eklendi.
- Role guard:
  - List + Detail: `admin_ops` veya `admin_approver`
  - Replay: sadece `admin_approver`
- Unauthorized response standardı:
  - HTTP `403`
  - Body:
    ```json
    {
      "error": {
        "code": "ADMIN_OPS_UNAUTHORIZED",
        "message": "Admin ops role required",
        "requiredAnyRole": ["admin_ops", "admin_approver"]
      }
    }
    ```

---

## 3) Replay path audit metadata

### Input contract
- `src/features/reconcile/reconcileJobRepository.ts`
  - `replay` input’unda zorunlu alanlar:
    - `actorId`
    - `reason`
    - `approvalRef`

### Endpoint validation
- `replayReconcileJobHandler`
  - `actorId`, `reason`, `approvalRef` yoksa `400` döner.

### Audit write
- `src/features/reconcile/supabaseReconcileJobRepository.ts`
  - Replay sonrası `reconcile_audit_log` tablosuna `admin_replay_requested` kaydı insert edilir.

### DB guard
- Migration trigger:
  - `trg_reconcile_audit_log_replay_requirements`
  - `action='admin_replay_requested'` için DB seviyesinde zorunlu alanları enforce eder (`actor_id`, `payload.reason`, `payload.approvalRef`).
