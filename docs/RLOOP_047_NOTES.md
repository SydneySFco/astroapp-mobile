# RLOOP-047 Notes — RPC Integration Tests + Failure Injection + Rollout Safety

## Summary

RLOOP-047 ile DB-first RPC admin action hattı için entegrasyon test matrisi genişletildi; failure-injection senaryoları ve rollout güvenlik checklist’i dokümante edildi.

## Added

1. **RPC integration test matrix (`__tests__/supabaseQuarantineControlPlane.rloop047.test.ts`)**
   - first request -> `accepted`
   - duplicate request (idempotent) -> `idempotent_duplicate` + metric `deduped`
   - stale (`P0001`) -> `stale` + metric `stale_conflict`
   - not_found (`P0002`) -> `not_found` + metric `rejected`

2. **Failure injection scenarios (test-level simulation)**
   - audit insert fail (injected SQLSTATE/message)
   - state update fail (injected SQLSTATE/message)
   - expectation: API mapping `internal_error(500)` + metric `rejected`
   - boundary: no partial success contract (RPC transactional scope varsayımı)

3. **Metrics contract verification**
   - Repository metric emitter üzerinden outcome set doğrulandı:
     - `accepted`
     - `deduped`
     - `stale_conflict`
     - `rejected`

## Caveats

- Failure injection burada mock-RPC seviyesinde yapılır; gerçek DB/ephemeral schema üzerinde fault-injection testi rollout öncesi ek güven katmanı olarak önerilir.
- Rollout adımları için `docs/RLOOP_047_ROLLOUT_CHECKLIST.md` izlenmelidir.
