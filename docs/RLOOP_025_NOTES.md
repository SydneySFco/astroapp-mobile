# RLOOP-025 NOTES — Runtime-to-DB Adapter + Admin Ops Endpoint Draft

## Summary
Bu iterasyonda reconcile worker runtime taslağı DB adapter seviyesine taşındı ve admin ops için endpoint skeletonları eklendi. Amaç: runtime tarafındaki `claim/finalize/replay` contract'larını netleştirmek ve read-model bazlı admin operasyonlarına implementasyon yolu açmak.

---

## 1) Runtime-to-DB Adapter Skeleton

### Yeni dosyalar
- `src/features/reconcile/reconcileJobRepository.ts`
  - `RuntimeReconcileJobRepository` contract:
    - `claimNext(leaseDurationMs)`
    - `markSucceeded(jobId, finishedAt)`
    - `markFailed(jobId, errorCode, errorMessage, decision)`
    - `replay({jobId, reasonCode, reasonMessage, requestedBy})`
  - read-model satır tipleri ve mapping yardımcıları.

- `src/features/reconcile/supabaseReconcileJobRepository.ts`
  - Supabase tabanlı temel adapter implementasyonu.
  - `createSupabaseReconcileJobRepository()`
  - `createSupabaseReconcileAdminReadModel()`

### Notlar
- `claimNext` şu an transactional RPC yerine iki adımlı skeleton olarak bırakıldı (`select + update`).
- Production-ready race-safe claim için sonraki iterasyonda SQL RPC (`claim_reconcile_job`) önerilir.

---

## 2) Admin Ops Endpoints Implementation Draft

### Yeni dosya
- `src/features/reconcile/adminOpsEndpoints.ts`

### Skeleton handlerlar
- `listReconcileJobsHandler`
- `getReconcileJobDetailHandler`
- `replayReconcileJobHandler`

### İçerik
- minimal request validation
  - `jobId` zorunluluğu
  - pagination (`limit`, `offset`) kontrolleri
- response DTO taslağı (`ReconcileJobDto`)
- handler dönüşü framework-agnostic (`{status, data}`)

---

## 3) Read-Model Integration

Admin ops list/detail handlerları doğrudan `ReconcileAdminReadModel` contract'ı üzerinden çalışır.
Bu contract'ın Supabase implementasyonu:
- read model kaynağı: `reconcile_job_ops_view`
- referans migration: `docs/supabase/migrations/20260226162000_rloop024_admin_ops_read_model.sql`

Replay endpoint ise write-path için `RuntimeReconcileJobRepository.replay` metodunu kullanır.

---

## 4) Scope Boundaries

Bu iterasyon:
- endpoint skeleton + contract + DTO sağlar,
- framework route binding (Express/Fastify/Edge) yapmaz,
- replay için audit/replay queue tablosu eklemez (TODO bırakıldı).

