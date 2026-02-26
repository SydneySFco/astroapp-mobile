# RECONCILE_WORKER_SPEC — RLOOP-023

## Goal
`processing` state’te takılı kalan user report kayıtlarını güvenli bir worker ile yeniden değerlendirip deterministic şekilde final state’e geçirmek.

## Lifecycle

```text
queued -> running -> succeeded
                 -> failed (retryable)
                 -> dead_lettered (max attempts exceeded)
```

## Queue Job Model (Minimal)
- `id: uuid`
- `report_id: uuid`
- `status: queued | running | succeeded | failed | dead_lettered`
- `attempt_count: int` (default 0)
- `max_attempts: int` (default 5)
- `leased_until: timestamptz | null`
- `retry_after: timestamptz | null`
- `last_error_code: text | null`
- `last_error_message: text | null`
- `created_at`, `updated_at`, `finished_at`

## Lease / Claim Policy
1. Worker yalnızca aşağıdaki işleri claim eder:
   - `status = queued`
   - `retry_after IS NULL OR retry_after <= now()`
   - `leased_until IS NULL OR leased_until <= now()`
2. Claim sırasında tek transaction içinde:
   - `status = running`
   - `attempt_count = attempt_count + 1`
   - `leased_until = now() + lease_duration`
3. Lease süresi biten `running` job, başka worker tarafından tekrar claim edilebilir.

## Retry / Backoff Policy
- Exponential backoff + jitter:
  - Base: 30s
  - Formula: `base * 2^(attempt-1)`
  - Cap: 30m
  - Jitter: ±20%
- Retryable error örnekleri:
  - Network timeout
  - 5xx backend error
  - Transient DB lock/contention

## Dead-letter Policy
- `attempt_count >= max_attempts` olduğunda job `dead_lettered` olur.
- Dead-letter kayıtları otomatik silinmez; admin intervention gerekir.
- Admin operasyonları:
  - `requeue` (attempt reset veya controlled continue)
  - `force_fail`
  - `attach_note`

## State Transition Guardrails
- `succeeded` ve `dead_lettered` terminal state’tir.
- Terminal state’lerden `running`/`queued`’ya dönüş sadece admin explicit action ile yapılır.
- Her transition audit log üretmelidir.

## Worker Skeleton (Code Draft)
`src/features/reconcile/reconcileWorker.ts`

İçerik:
- Status/type tanımları
- `computeBackoffMs` (exp + jitter)
- `toRetryDecision`
- `claimNextReconcileJob` / `finalizeReconcileJob`

## E2E Scenario (Acceptance)
1. Seed: report `processing`’te SLA üstü stuck.
2. Reconcile enqueue job oluşturur (`queued`).
3. Worker claim eder (`running`, lease set).
4. Finalize başarılıysa `succeeded`, hata varsa retry veya `dead_lettered`.
5. Client telemetry’de event zinciri görünür:
   - `reconcile_job_enqueued`
   - `reconcile_job_claimed`
   - `reconcile_job_finalized`

## Out of Scope (RLOOP-023)
- Production scheduler implementation
- Dashboard rendering
- Multi-region queue sharding
