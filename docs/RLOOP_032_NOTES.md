# RLOOP-032 Notes — Real Parallel Race Harness + Perf/Consistency Metrics

## Summary
RLOOP-031’deki deterministic seed + ephemeral lifecycle tabanı korunarak harness gerçek paralel fan-out modeline geçirildi.
Ayrıca latency percentile, outcome sequence consistency ve retry/idempotency drift metrikleri JSON rapora eklendi.

## Delivered

1. **Real parallel execution fan-out**
   - `scripts/concurrency-harness-rloop029.sh` artık her iteration’da `WORKERS` kadar finalize çağrısını aynı anda background process olarak çalıştırıyor.
   - Iteration bariyeri: bir iterasyondaki tüm worker’lar bitmeden bir sonraki iterasyona geçilmiyor.
   - Deterministic fixture akışı korunuyor:
     - `HARNESS_JOB_ID`
     - `HARNESS_LEASE_TOKEN`
     - `HARNESS_LEASE_REVISION`
     - optional SQL seed (`SUPABASE_DB_URL`)

2. **Latency metrics (p50/p95/p99)**
   - Her attempt için `latency_ms` ölçülüyor.
   - Rapora eklendi:
     - `latency_ms.p50`
     - `latency_ms.p95`
     - `latency_ms.p99`

3. **Consistency + drift metrics**
   - Sequence consistency:
     - Referans olarak iteration-1 outcome sequence’i alınıyor.
     - Worker slot bazında iteration’lar arası match oranı hesaplanıyor.
     - Rapora `consistency.sequence_match_ratio`, `consistency.by_worker_slot` eklendi.
   - Retry/idempotency drift:
     - Iteration bazında `idempotent_ratio` hesaplanıyor.
     - `idempotent_ratio_drift_delta` (max-min) raporlanıyor.
     - İlk `applied` sonrası gelen retry outcome sayısı (`retry_outcomes_after_first_applied`) raporlanıyor.

4. **Extended assertions (opt-in fail gates)**
   - `FAIL_ON_P95_LATENCY_BREACH` + `P95_LATENCY_FAIL_THRESHOLD_MS`
   - `FAIL_ON_CONSISTENCY_BREACH` + `CONSISTENCY_MIN_RATIO`
   - `FAIL_ON_IDEMPOTENCY_DRIFT_BREACH` + `IDEMPOTENCY_DRIFT_MAX_DELTA`

## Validation
- `yarn lint`
- `yarn typecheck`

## Suggested next (RLOOP-033)
- Multi-job/multi-lease chaos matrix (aynı anda birden fazla `job_id`) + DB wait/lock telemetry (pg_stat_activity/lock wait sampling) ile kök neden sınıflandırması.