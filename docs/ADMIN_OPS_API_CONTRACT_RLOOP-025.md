# ADMIN OPS API CONTRACT — RLOOP-025/RLOOP-026 (Draft)

Bu doküman admin operasyonları için endpoint contract taslağını tanımlar.
Read-model kaynağı: `reconcile_job_ops_view`.

RLOOP-026 ile role-based authz ve replay metadata zorunlulukları eklenmiştir.

---

## AuthZ

- `GET /admin/ops/reconcile/jobs` → `admin_ops` veya `admin_approver`
- `GET /admin/ops/reconcile/jobs/:jobId` → `admin_ops` veya `admin_approver`
- `POST /admin/ops/reconcile/jobs/:jobId/replay` → `admin_approver`

### Unauthorized Response Standard (403)
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
  "actorId": "8d72b8ae-b3e6-49de-9ed3-b040f151ab9e",
  "reason": "Incident INC-129 closed; safe to replay",
  "approvalRef": "APR-2026-02-26-17"
}
```

### Required fields (RLOOP-026)
- `actorId`
- `reason`
- `approvalRef`

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
```json
{"error":"actorId, reason and approvalRef are required"}
```

---

## Read-Model Note

List/detail endpointleri write tablolarına doğrudan bakmaz; `reconcile_job_ops_view` üstünden çalışır.
Böylece queue depth / retry age gibi operasyonel metrikler endpoint DTO'suna taşınabilir.
