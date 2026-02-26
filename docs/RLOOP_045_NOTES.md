# RLOOP-045 Notes — Quarantine Admin API Runtime + Error Contract

## Yapılanlar

1. **Runtime integration (framework-agnostic adapter)**
   - `src/features/reliability/quarantineAdminRuntime.ts` eklendi.
   - Router contract ile runtime request/response shape’i arasında adapter tanımlandı.
   - Sample wiring pattern (Express benzeri) dokümante edildi.

2. **Error contract finalization**
   - Standart payload shape: `{ error: { code, message, details? } }`
   - Yeni kodlar:
     - `unauthorized`
     - `bad_request`
     - `not_found`
     - `stale`
     - `idempotent_duplicate`
     - `internal_error`
   - `stale` vs `not_found` ayrımı runtime/repository hattında netleştirildi (`409` vs `404`).

3. **DB conflict handling draft (requestId dedup)**
   - `supabaseQuarantineControlPlane` içinde upsert/on-conflict stratejisi için draft not + binding shape eklendi.
   - Mevcut read-first dedupe korunurken DB-first insert-on-conflict yaklaşımı açıklandı.

4. **Observability emit noktaları**
   - action/outcome/reason dimension standardı korundu.
   - Hata kodu → metric outcome eşlemesi netleştirildi:
     - `idempotent_duplicate` -> `deduped`
     - `stale` -> `stale_conflict`
     - diğerleri -> `rejected`

5. **Testler**
   - Runtime adapter için yeni test eklendi.
   - Error code/status mapping senaryoları (stale/not_found/idempotent_duplicate) test kapsamına alındı.

## Değişen Dosyalar

- `src/features/reliability/quarantineAdminErrors.ts` (yeni)
- `src/features/reliability/quarantineAdminRuntime.ts` (yeni)
- `src/features/reliability/quarantineControlPlane.ts`
- `src/features/reliability/supabaseQuarantineControlPlane.ts`
- `src/features/reliability/quarantineAdminRouter.ts`
- `src/features/reliability/index.ts`
- `__tests__/quarantineControlPlane.rloop043.test.ts`
- `__tests__/quarantineAdminRuntime.rloop045.test.ts` (yeni)
- `docs/OBSERVABILITY_METRICS_RLOOP-044.md`
- `docs/QUARANTINE_API_ERROR_CONTRACT_RLOOP-045.md` (yeni)

## Validation

- `yarn lint`
- `yarn typecheck`
