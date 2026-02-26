# ADMIN_OPS_SURFACE — RLOOP-023 Draft

## Objective
Admin ekibine reconcile override süreçlerinde **request -> approval -> execution timeline** görünürlüğü sağlamak.

## Minimal Data Model

### 1) `admin_reconcile_requests`
- `id: uuid`
- `report_id: uuid`
- `requested_by: uuid`
- `reason: text`
- `requested_state: text` (ör: `queued_reconcile`, `force_fail`)
- `status: pending | approved | rejected | executed`
- `created_at`, `updated_at`

### 2) `admin_reconcile_approvals`
- `id: uuid`
- `request_id: uuid`
- `decided_by: uuid`
- `decision: approved | rejected`
- `decision_note: text | null`
- `decided_at: timestamptz`

### 3) `reconcile_job_timeline`
- `id: uuid`
- `job_id: uuid`
- `event_type: enqueued | claimed | retry_scheduled | succeeded | failed | dead_lettered | admin_requeued`
- `event_actor: system | worker | admin`
- `event_payload: jsonb`
- `occurred_at: timestamptz`

## Endpoint Notes (Draft)

### Request / Approval
- `POST /admin/reconcile/requests`
  - Yeni override/reconcile isteği açar.
- `POST /admin/reconcile/requests/:id/approve`
  - İsteği approve eder ve job enqueue tetikler.
- `POST /admin/reconcile/requests/:id/reject`
  - İsteği reject eder.

### Job Ops
- `GET /admin/reconcile/jobs?status=dead_lettered`
  - Operasyon kuyruğu listesi.
- `GET /admin/reconcile/jobs/:jobId/timeline`
  - Job geçmişi.
- `POST /admin/reconcile/jobs/:jobId/requeue`
  - Dead-letter veya failed job yeniden kuyruğa alınır.

## Screen Notes (Draft)

### A) Request Inbox
- Filtreler: pending/approved/rejected/executed
- Kolonlar: report_id, requester, reason, status, created_at

### B) Request Detail
- Approval card
- Linked job list
- Timeline preview

### C) Job Ops Monitor
- Queue depth + running + dead-letter sayacı
- Job table: attempt_count, leased_until, retry_after, last_error

### D) Job Timeline Drawer
- Event stream (enqueued -> claimed -> retry -> finalized)
- JSON payload raw view (debug amaçlı)

## Authorization Notes
- `admin_ops` rolü request oluşturabilir.
- `admin_approver` rolü approve/reject yapabilir.
- `admin_supervisor` dead-letter replay yapabilir.
- Tüm aksiyonlar immutable audit log’a yazılır.

## E2E Test Scenario (Ops)
1. Stuck processing report için request aç.
2. Approver `approve` etsin, job enqueue olsun.
3. Worker job’ı finalizesin.
4. Admin timeline’da event zinciri ve actor bilgisi doğrulansın.
5. Client telemetry eventleri backend timeline ile korele edilsin.
