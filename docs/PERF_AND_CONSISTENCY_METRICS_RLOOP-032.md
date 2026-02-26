# Perf & Consistency Metrics (RLOOP-032)

## Added report fields
Harness report (`reports/concurrency-harness-*.json`) now includes:

- `latency_ms`
  - `p50`
  - `p95`
  - `p99`
- `consistency`
  - `sequence_match_ratio`
  - `sequence_matches`
  - `sequence_total`
  - `by_worker_slot[]`
- `retry_idempotency_drift`
  - `idempotent_ratio_by_iteration[]`
  - `idempotent_ratio_drift_delta`
  - `retry_outcomes_after_first_applied`

## Metric definitions

### 1) Latency percentiles
- Granularity: per finalize attempt
- Unit: milliseconds
- Calculation: linear-interpolated percentile over all attempts in run

### 2) Outcome sequence consistency
- Baseline: iteration-1 outcome sequence (by `worker_slot`)
- For each slot and iteration, current outcome is compared against baseline slot outcome
- `sequence_match_ratio = sequence_matches / sequence_total`

### 3) Retry/idempotency drift
- `idempotent_ratio_by_iteration = idempotent_count / worker_count`
- `idempotent_ratio_drift_delta = max(ratio_i) - min(ratio_i)`
- `retry_outcomes_after_first_applied`: first `applied` sonrasında görülen non-unknown retry outcome adedi

## Suggested thresholds

Aşağıdaki değerler başlangıç önerisidir; 1-2 haftalık run geçmişi sonrası kalibre edilmelidir.

- **Latency**
  - Warn: `p95 > 800ms`
  - Fail gate (opsiyonel): `FAIL_ON_P95_LATENCY_BREACH=1`, `P95_LATENCY_FAIL_THRESHOLD_MS=1000`
- **Consistency**
  - Warn: `sequence_match_ratio < 0.90`
  - Fail gate (opsiyonel): `FAIL_ON_CONSISTENCY_BREACH=1`, `CONSISTENCY_MIN_RATIO=0.85`
- **Idempotency drift**
  - Warn: `idempotent_ratio_drift_delta > 0.20`
  - Fail gate (opsiyonel): `FAIL_ON_IDEMPOTENCY_DRIFT_BREACH=1`, `IDEMPOTENCY_DRIFT_MAX_DELTA=0.30`
- **Existing gates (recommended keep strict)**
  - `applied_count == 0` => fail
  - `stale_conflict_ratio >= STALE_RATIO_FAIL_THRESHOLD` => fail
  - `unknown_ratio >= UNKNOWN_RATIO_FAIL_THRESHOLD` => fail

## CI rollout suggestion
1. 1. hafta: yeni metrikleri sadece observe et (`FAIL_ON_*_BREACH=0`).
2. 2. hafta: warn threshold’ları dashboard/webhook mesajına ekle.
3. 3. hafta: p95 + unknown ratio için fail gate aktif et.
4. 4. hafta: consistency/idempotency drift gate’lerini düşük risk branch’lerde pilotla.