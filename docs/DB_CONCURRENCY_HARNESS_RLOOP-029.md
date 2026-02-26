# DB-backed Concurrency Harness (RLOOP-029 → RLOOP-033 update)

## Purpose
`finalize_reconcile_job` concurrency davranışını production-like yarış koşulunda ölçmek ve nightly CI’da assertion-fail odaklı çalıştırmak.

Hedef metrikler:
- outcome dağılımı: `applied:idempotent:stale_blocked:unknown`
- stale conflict ratio
- unknown fallback ratio
- latency percentiles (`p50/p95/p99`)
- outcome sequence consistency ratio
- retry/idempotency drift

---

## RLOOP-031 Baseline

### 1) Ephemeral schema + deterministic seed/teardown
Script: `scripts/concurrency-harness-rloop029.sh`

- safe schema naming (`SCHEMA_SAFE`)
- `HARNESS_USE_EPHEMERAL_SCHEMA=1` ise run başında create schema
- deterministic seed key üretimi (`HARNESS_SEED_NAMESPACE`, workload, timestamp)
- deterministic fixture auto wiring:
  - `HARNESS_JOB_ID`
  - `HARNESS_LEASE_TOKEN`
  - `HARNESS_LEASE_REVISION`
- `SUPABASE_DB_URL` varsa `public.reconcile_jobs` deterministic upsert
- `trap EXIT` ile drop schema garantisi (best-effort + warning)

### 2) Production-like race input wiring
- `HARNESS_AUTO_FIXTURE_INPUTS=1` default
- fixture alanları env verilmezse otomatik deterministic üretilir
- RPC payload bu fixture’lardan beslenir

### 3) Unknown fallback reduction + strict assertions
- outcome extractor, error payload’ındaki stale/conflict ipuçlarını `stale_blocked`a sınıflandırır
- `FAIL_ON_UNKNOWN_RATIO_BREACH=1`
- `UNKNOWN_RATIO_FAIL_THRESHOLD=0.0500`

---

## RLOOP-032 Delta

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

## RLOOP-033 Delta

### 1) Multi-job chaos mode
- Tek job yerine aynı anda `JOB_POOL_SIZE` kadar job fixture üretilir/seed edilir.
- Job başına parallel finalize fan-out `WORKER_FAN_OUT` ile kontrol edilir.
- Iteration başına toplam yarış: `JOB_POOL_SIZE * WORKER_FAN_OUT`.

### 2) Contention classification
- Attempt seviyesinde sınıf etiketleri:
  - `network`
  - `db-lock`
  - `stale-race`
  - `unknown`
- Sınıflandırma raw RPC response/error payload ipuçlarından yapılır.

### 3) Lock telemetry correlation draft
- `LOCK_TELEMETRY_FILE` (NDJSON) verildiğinde sample veriden contention windows çıkarılır.
- `LATENCY_SPIKE_THRESHOLD_MS` üzerindeki latency spike’lar bu window’larla eşleştirilir.
- Korelasyon oranı raporlanır.
- DB erişimi olmayan ortamlarda docs + parser iskeleti olarak çalışır.

### 4) Report extensions
- `job_pool_metrics`
- `contention_correlation`
- `contention_classes`

---

## CI Integration
Workflow: `.github/workflows/nightly-concurrency-harness.yml`

Akış:
1. install
2. harness run (strict assertions)
3. artifact upload (`*.json` + `history.ndjson`)
4. optional webhook notify

Secrets/vars:
- Required (rpc_http): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional seed/schema lifecycle: `SUPABASE_DB_URL`
- Optional notify: `CONCURRENCY_HARNESS_WEBHOOK_URL`

---

## Suggested thresholds (initial)
- `p95 latency`: warn > `800ms`, fail gate optional > `1000ms`
- `sequence_match_ratio`: warn < `0.90`, fail gate optional < `0.85`
- `idempotent_ratio_drift_delta`: warn > `0.20`, fail gate optional > `0.30`

Not: threshold’lar ilk 1-2 haftalık historical baseline sonrası kalibre edilmelidir.