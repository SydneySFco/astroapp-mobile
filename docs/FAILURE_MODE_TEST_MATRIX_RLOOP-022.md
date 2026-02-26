# FAILURE MODE TEST MATRIX — RLOOP-022

## Scope
Privileged reconcile akışında timeout, duplicate event, stale update ve partial failure dayanımını doğrulamak.

| ID | Scenario | Setup | Expected Result | Assertions |
|---|---|---|---|---|
| FM-01 | Timeout while enqueue RPC | DB/RPC timeout simülasyonu | İşlem `failed` dönmeli, audit log yazılmalı | `job_enqueued` yok, `job_failed` var, error_code set |
| FM-02 | Duplicate scheduler event | Aynı report için 2 paralel enqueue çağrısı | Tek aktif job oluşturulmalı (idempotent/noop) | unique partial index ihlal edilmiyor, ikinci çağrı `duplicate_open_job` mesajı |
| FM-03 | Stale update on report row | Report status eşzamanlı `ready` oldu | enqueue RPC `noop` dönmeli | `success=false`, reason=`INVALID_STATE` veya `NOT_STUCK`, status mutate yok |
| FM-04 | Partial failure after job create | Job insert başarılı, audit insert fail (simülasyon) | Transaction rollback veya deterministic failure | Orphan job oluşmuyor, audit tutarlılığı korunuyor |
| FM-05 | Worker crash mid-run | Job `running` sonrası worker ölür | Retry mekanizması job’u reclaim eder | `updated_at` + lease timeout ile yeniden alınır |
| FM-06 | Approval missing | Request approved edilmeden execute | RPC reject | `42501`/policy error, job oluşmaz |
| FM-07 | Self-approval attempt | requestor=approver | Onay reddedilir | audit `request_rejected`, reason `SELF_APPROVAL_BLOCKED` |
| FM-08 | High backlog burst | 1k stuck kayıt | batch limit ile kontrollü enqueue | run metrikleri: scanned/enqueued/failed, timeout olmadan tamamlanır |

## Test Data Notes
- Seed report states:
  - `processing` old enough (eligible)
  - `processing` fresh (not eligible)
  - `ready` (invalid for reconcile)
- Her testte `incident_ref` unique tutulmalı.

## Telemetry Checks
- Event order:
  1. `report_reconcile_requested`
  2. `report_reconcile_completed` veya `report_reconcile_failed`
- `reconcile_job_id` korelasyonu zorunlu.

## Exit Criteria
- FM-01..FM-08 tamamı geçer.
- Duplicate ve stale senaryolarda lifecycle guard ihlali olmadan deterministic noop/failure üretilir.
