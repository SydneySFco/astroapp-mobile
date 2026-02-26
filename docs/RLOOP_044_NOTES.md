# RLOOP-044 Notes — Supabase Adapter Wiring + Endpoint Hardening

## Summary
RLOOP-043 taslağı, uygulamaya yakın bir wiring seviyesine taşındı:

1. **Supabase adapter binding (draft)**
   - `src/features/reliability/supabaseQuarantineControlPlane.ts`
   - Quarantine list/detail için read-model adapter
   - Redrive/drop için admin repository adapter
   - SQL draft alanları ile birebir kolon eşlemesi (`replay_quarantine_messages`, `replay_quarantine_audit_log`)

2. **Endpoint router wiring (minimal)**
   - `src/features/reliability/quarantineAdminRouter.ts`
   - Endpoints:
     - `GET /admin/ops/reliability/quarantine`
     - `GET /admin/ops/reliability/quarantine/:replayId`
     - `POST /admin/ops/reliability/quarantine/:replayId/redrive`
     - `POST /admin/ops/reliability/quarantine/:replayId/drop`
   - `requestId` çözümleme sırası:
     1) body.requestId
     2) `idempotency-key` header
     3) `x-request-id` header

3. **Idempotency + stale guard**
   - requestId varsa `replay_quarantine_audit_log` üzerinde replayId+action+requestId dedup kontrolü
   - Durum geçişi `status = pending_review` koşulu ile optimistic concurrency korumalı
   - Geçiş başarısızsa `quarantine_stale_or_not_found` hatası ile stale/not-found ayrımı dokümante edildi

4. **Observability hardening**
   - Yeni metric adları:
     - `replay_quarantine_admin_action_total`
     - `replay_quarantine_idempotency_deduped_total`
     - `replay_quarantine_stale_conflict_total`
   - `createQuarantineAdminMetricEvent` helper ile action/outcome/reason boyutları standardize edildi

## Files
- `src/features/reliability/supabaseQuarantineControlPlane.ts`
- `src/features/reliability/quarantineAdminRouter.ts`
- `src/features/reliability/quarantineControlPlane.ts`
- `src/features/reliability/index.ts`
- `__tests__/quarantineAdminRouter.rloop044.test.ts`
- `__tests__/quarantineControlPlane.rloop043.test.ts`
- `docs/QUARANTINE_CONTROL_PLANE_RLOOP-043.md` (updated)
- `docs/OBSERVABILITY_METRICS_RLOOP-044.md`
