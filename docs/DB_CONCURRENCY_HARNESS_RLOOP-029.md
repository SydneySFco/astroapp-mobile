# DB-backed Concurrency Harness (RLOOP-029 → RLOOP-032 update)

## Purpose
`finalize_reconcile_job` concurrency davranışını gerçek RPC outcome’larına bağlamak ve nightly CI’ı assertion-fail odaklı çalıştırmak.

Hedef metrikler:
- outcome dağılımı: `applied:idempotent:stale_blocked`
- stale conflict ratio
- unknown fallback ratio
- run-to-run trend notu (önceki run ile karşılaştırma)

---

## RLOOP-031 Delta

### 1) Harness wiring (RPC adapter contract)
Script: `scripts/concurrency-harness-rloop029.sh`

Yeni/özel akış:
- safe schema naming (`SCHEMA_SAFE`)
- `HARNESS_USE_EPHEMERAL_SCHEMA=1` ise run başında create schema
- deterministic seed key üretimi (`HARNESS_SEED_NAMESPACE`, workload, timestamp)
- deterministic fixture auto wiring:
  - `HARNESS_JOB_ID`
  - `HARNESS_LEASE_TOKEN`
  - `HARNESS_LEASE_REVISION`
- `SUPABASE_DB_URL` varsa `public.reconcile_jobs` deterministic upsert
- `trap EXIT` ile drop schema garantisi (best-effort + warning)

Command adapter contract:
- `FINALIZE_RPC_ADAPTER_CMD` çıktısı JSON olmalı
- Beklenen alan: `outcome` (`applied|idempotent|stale_blocked`)

### 3) Unknown fallback reduction + assertions
- outcome extractor, error payload’ındaki stale/conflict ipuçlarını `stale_blocked`a sınıflandırır
- yeni guard:
  - `FAIL_ON_UNKNOWN_RATIO_BREACH=1`
  - `UNKNOWN_RATIO_FAIL_THRESHOLD=0.0500`

Breach durumlarında job fail edilir:
- `applied_count == 0 && total_attempts > 0`
- `stale_conflict_ratio >= STALE_RATIO_FAIL_THRESHOLD`
- `unknown_ratio >= UNKNOWN_RATIO_FAIL_THRESHOLD`

### 4) JSON report metadata
Standart rapora eklendi:
- `seed.*` (namespace/key/job/lease/revision/seed_sql_applied)
- `schema_lifecycle.*` (ephemeral enabled/create/drop durumu)

### 1) Real parallel finalize fan-out
- Harness artık her iteration’da `WORKERS` kadar finalize çağrısını **eşzamanlı** (background process) çalıştırır.
- Iteration bariyeri sayesinde gerçek yarış koşulu korunur: tüm worker’lar bitmeden bir sonraki iterasyona geçilmez.

### 2) Latency metrics
Report’a eklendi:
- `latency_ms.p50`
- `latency_ms.p95`
- `latency_ms.p99`

### 3) Consistency metrics
Report’a eklendi:
- `consistency.sequence_match_ratio`
- `consistency.sequence_matches`
- `consistency.sequence_total`
- `consistency.by_worker_slot[]`

### 4) Retry/idempotency drift
Report’a eklendi:
- `retry_idempotency_drift.idempotent_ratio_by_iteration[]`
- `retry_idempotency_drift.idempotent_ratio_drift_delta`
- `retry_idempotency_drift.retry_outcomes_after_first_applied`

### 5) Optional new fail gates
- `FAIL_ON_P95_LATENCY_BREACH` + `P95_LATENCY_FAIL_THRESHOLD_MS`
- `FAIL_ON_CONSISTENCY_BREACH` + `CONSISTENCY_MIN_RATIO`
- `FAIL_ON_IDEMPOTENCY_DRIFT_BREACH` + `IDEMPOTENCY_DRIFT_MAX_DELTA`

---

## CI Integration
Workflow: `.github/workflows/nightly-concurrency-harness.yml`

Trigger:
- nightly schedule (UTC)
- manual dispatch

Secrets/vars:
- Required (rpc_http): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional notify: `CONCURRENCY_HARNESS_WEBHOOK_URL`

---

## Remaining follow-up (RLOOP-032 adayı)
- Gerçek paralel finalize yarışı (background process/fan-out) ve p95 latency/sequence telemetry
- Ephemeral schema isolation’ı function/search_path seviyesinde gerçek DB sandbox’a genişletmek