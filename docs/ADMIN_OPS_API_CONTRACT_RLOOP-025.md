# ADMIN OPS API CONTRACT — RLOOP-025 (Draft)

Bu doküman admin operasyonları için endpoint contract taslağını tanımlar.
Read-model kaynağı: `reconcile_job_ops_view`.

---

## 1) List Jobs

`GET /admin/ops/reconcile/jobs`

### Query Params
- `status?: string`
- `limit?: number` (min 1)
- `offset?: number` (min 0)

### 200 Response
```json
{
  "items": [
    {
      "id": "job_123",
      "reportId": "report_123",
      "status": "queued",
      "attemptCount": 1,
      "maxAttempts": 5,
      "leasedUntil": null,
      "retryAfter": null,
      "lastErrorCode": null,
      "lastErrorMessage": null,
      "queueDepth": 18,
      "retryAgeSeconds": 0,
      "createdAt": "2026-02-26T11:00:00.000Z",
      "updatedAt": "2026-02-26T11:00:00.000Z"
    }
  ]
}
```

### 400 Response
```json
{
  "error": "Invalid pagination query params"
}
```

---

## 2) Job Detail

`GET /admin/ops/reconcile/jobs/:jobId`

### 200 Response
```json
{
  "item": {
    "id": "job_123",
    "reportId": "report_123",
    "status": "failed",
    "attemptCount": 3,
    "maxAttempts": 5,
    "leasedUntil": null,
    "retryAfter": "2026-02-26T11:10:00.000Z",
    "lastErrorCode": "WORKER_RUNTIME_ERROR",
    "lastErrorMessage": "Timeout",
    "queueDepth": 22,
    "retryAgeSeconds": 120,
    "createdAt": "2026-02-26T10:30:00.000Z",
    "updatedAt": "2026-02-26T11:08:00.000Z"
  }
}
```

### 400 / 404 Responses
```json
{"error":"jobId is required"}
```
```json
{"error":"Job not found"}
```

---

## 3) Replay Job

`POST /admin/ops/reconcile/jobs/:jobId/replay`

### Request Body
```json
{
  "reasonCode": "MANUAL_REPLAY",
  "reasonMessage": "Ops replay after incident mitigation",
  "requestedBy": "ops@sydneysf.co"
}
```

### 202 Response
```json
{
  "jobId": "job_123",
  "replayRequestedAt": "2026-02-26T11:20:00.000Z"
}
```

### 400 Response
```json
{"error":"jobId is required"}
```

---

## Read-Model Note

List/detail endpointleri write tablolarına doğrudan bakmaz; `reconcile_job_ops_view` üstünden çalışır.
Böylece queue depth / retry age gibi operasyonel metrikler endpoint DTO'suna taşınabilir.

