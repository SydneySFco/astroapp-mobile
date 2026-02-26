# RLOOP-024 NOTES — Worker Runtime Wiring + Admin Ops Read Model

## Summary
RLOOP-023 ile bırakılan reconcile worker taslağı, bu iterasyonda runtime entegrasyonuna daha yakın bir execution skeleton haline getirildi. Ayrıca admin operasyonları için okunabilir bir read model ve endpoint contract taslağı eklendi.

---

## 1) Worker Runtime Wiring

### Eklenenler
- `src/features/reconcile/reconcileWorkerRuntime.ts`
  - `runReconcileWorkerTick(deps)`:
    - claim
    - execute
    - finalize
    - telemetry emit
  - `createDeadLetterReplayHook(...)`:
    - dead-letter finalize sonrası replay kuyruğuna minimal payload atar.

### Güncellenenler
- `src/features/reconcile/reconcileWorker.ts`
  - `finalizeReconcileJob` artık optional `onDeadLettered` hook kabul ediyor.
  - `dead_lettered` kararında hook tetikleniyor.

### Runtime akışı (tek tick)
1. `claimNextReconcileJob()` ile claimable iş alınır.
2. `executeJob(job)` çalıştırılır.
3. Sonuç başarılıysa `finalize(..., {result:'succeeded'})`.
4. Hata varsa `finalize(..., {result:'failed', ...})`.
5. `toRetryDecision` sonucu `dead_lettered` ise replay hook tetiklenir.
6. Claim/finalize adımlarında telemetry eventleri emit edilir.

---

## 2) Admin Ops Read Model

Detaylar: `docs/ADMIN_OPS_READ_MODEL_RLOOP-024.md`

Amaç alanları:
- queue depth
- retry age
- lease expiry
- failure reason

SQL taslağı:
- `docs/supabase/migrations/20260226162000_rloop024_admin_ops_read_model.sql`
  - `reconcile_job_ops_view`
  - `reconcile_queue_depth_view`
  - `reconcile_job_ops_mv` (opsiyonel materialized view)

---

## 3) API / Endpoint Draft

Detaylar read model dokümanında yer alır.

Minimal kontratlar:
- `GET /admin/ops/reconcile/jobs`
- `GET /admin/ops/reconcile/jobs/:jobId`

Bu endpointlerde read model alanları doğrudan taşınır.

---

## 4) E2E Scripted Flow Draft

Detaylı script: `docs/ADMIN_OPS_READ_MODEL_RLOOP-024.md` içinde.

Özet:
1. Seed
2. Enqueue
3. Worker run (tick)
4. Finalize
5. Telemetry + read model doğrulama

---

## Notes / Constraints
- Bu iterasyon üretim scheduler veya queue daemon implement etmez.
- Replay hook intentionally minimal bırakıldı (runtime consumer implement edecektir).
- Materialized view refresh stratejisi (cron/event-driven) operasyonel karara bağlıdır.
