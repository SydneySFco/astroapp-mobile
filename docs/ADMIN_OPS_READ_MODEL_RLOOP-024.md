# ADMIN OPS READ MODEL — RLOOP-024

## Objective
Admin ops ekranlarında reconcile queue sağlığını hızlı okunabilir hale getirmek.

## Read Model Fields

### Job list/detail alanları
- `job_id`
- `report_id`
- `status`
- `attempt_count`
- `max_attempts`
- `queue_depth_bucket` (`queued|running|failed|dead_lettered`)
- `retry_after`
- `retry_age_seconds`
- `leased_until`
- `lease_expiry_seconds`
- `last_error_code`
- `failure_reason` (code + message birleşik)
- `created_at`
- `updated_at`
- `finished_at`

### Metric aggregation
- status bazında `job_count`
- claimable queued count
- expired lease count

---

## SQL View / Materialized View Draft

Migration dosyası:
- `docs/supabase/migrations/20260226162000_rloop024_admin_ops_read_model.sql`

Üretilen yapılar:
1. `public.reconcile_job_ops_view`
   - list/detail için satır bazlı okunabilir projection
2. `public.reconcile_queue_depth_view`
   - queue depth aggregate
3. `public.reconcile_job_ops_mv` (opsiyonel)
   - ağır sorgularda dashboard performansı için MV

---

## API Contract Draft

### 1) List
`GET /admin/ops/reconcile/jobs?status=queued&limit=20&cursor=<opaque>`

#### Response 200 (örnek)
```json
{
  "items": [
    {
      "jobId": "cb7c152d-7c2f-4e45-bf57-8d96bbf40cf0",
      "reportId": "d52cbebf-6fd5-46ff-a7df-f3081963e7c6",
      "status": "running",
      "attemptCount": 2,
      "maxAttempts": 5,
      "retryAfter": null,
      "retryAgeSeconds": null,
      "leasedUntil": "2026-02-26T13:40:00.000Z",
      "leaseExpirySeconds": 191,
      "lastErrorCode": "NETWORK_TIMEOUT",
      "failureReason": "NETWORK_TIMEOUT: upstream reconcile service timed out",
      "updatedAt": "2026-02-26T13:36:49.000Z"
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI2VDEzOjM2OjQ5LjAwMFoiLCJpZCI6ImNiN2MxNTJkLTdjMmYtNGU0NS1iZjU3LThkOTZiYmY0MGNmMCJ9"
}
```

### 2) Detail
`GET /admin/ops/reconcile/jobs/:jobId`

#### Response 200 (örnek)
```json
{
  "job": {
    "jobId": "cb7c152d-7c2f-4e45-bf57-8d96bbf40cf0",
    "reportId": "d52cbebf-6fd5-46ff-a7df-f3081963e7c6",
    "status": "dead_lettered",
    "attemptCount": 5,
    "maxAttempts": 5,
    "retryAfter": "2026-02-26T13:25:00.000Z",
    "retryAgeSeconds": 820,
    "leasedUntil": "2026-02-26T13:20:00.000Z",
    "leaseExpirySeconds": -480,
    "lastErrorCode": "WORKER_RUNTIME_ERROR",
    "failureReason": "WORKER_RUNTIME_ERROR: transaction lock timeout",
    "createdAt": "2026-02-26T11:20:00.000Z",
    "updatedAt": "2026-02-26T13:30:00.000Z",
    "finishedAt": "2026-02-26T13:30:00.000Z"
  },
  "timeline": [
    {"eventType": "enqueued", "occurredAt": "2026-02-26T11:20:00.000Z"},
    {"eventType": "claimed", "occurredAt": "2026-02-26T11:20:05.000Z"},
    {"eventType": "retry_scheduled", "occurredAt": "2026-02-26T11:20:10.000Z"},
    {"eventType": "dead_lettered", "occurredAt": "2026-02-26T13:30:00.000Z"}
  ]
}
```

---

## E2E Scripted Flow Draft

### Preconditions
- `reconcile_jobs` tablosu hazır.
- Worker runtime tick fonksiyonu deploy/test edilebilir.
- Telemetry sink erişilebilir.

### Steps
1. **Seed**
   - test report üret.
   - stuck `processing` simülasyonu oluştur.
2. **Enqueue**
   - `reconcile_jobs` içine `queued` kayıt insert et.
3. **Worker run**
   - `runReconcileWorkerTick(...)` çağır.
   - job `running` ve `attempt_count +1` doğrula.
4. **Finalize**
   - başarı senaryosu: `succeeded + finished_at`
   - hata senaryosu: retry planı veya `dead_lettered`
5. **Telemetry verify**
   - `reconcile_job_claimed` event var.
   - `reconcile_job_finalized` event var.
6. **Read model verify**
   - `reconcile_job_ops_view` satırı beklenen `retry_age_seconds`, `lease_expiry_seconds`, `failure_reason` değerlerini üretiyor.
   - `reconcile_queue_depth_view` aggregate sayaçları güncel.

### Optional dead-letter replay check
- Max attempt aşımı ile job `dead_lettered` edilir.
- `onDeadLettered` hook tarafından replay queue/event payload’unun üretildiği doğrulanır.

---

## Operational Notes
- `retry_age_seconds` negatif olabilir (gelecek retry zamanı için), UI clamp edebilir.
- `lease_expiry_seconds` negatifse lease süresi geçmiş demektir.
- MV kullanılıyorsa refresh interval dashboard SLA’sına göre ayarlanmalı (örn 30-60 sn).
