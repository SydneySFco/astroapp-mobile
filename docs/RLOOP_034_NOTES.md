# RLOOP-034 Notes — Live Lock Telemetry Collector + Correlation Confidence

## Summary
RLOOP-033’te eklenen lock telemetry correlation draft, bu iterasyonda live collection skeleton + confidence scoring ile bir adım ileri taşındı.

## Delivered

1. **Live telemetry collector skeleton**
   - Yeni script: `scripts/live-lock-telemetry-collector-rloop034.sh`
   - `pg_locks` + `pg_stat_activity` sample’larını timestamped NDJSON olarak yazar.
   - Collector env’leri:
     - `LOCK_TELEMETRY_DB_URL`
     - `LOCK_TELEMETRY_OUTPUT_FILE`
     - `LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC`
     - `LOCK_TELEMETRY_MAX_SAMPLES`

2. **Harness ile live collector entegrasyonu (opsiyonel)**
   - `scripts/concurrency-harness-rloop029.sh` yeni env’ler:
     - `LOCK_TELEMETRY_LIVE_COLLECT=1`
     - `LOCK_TELEMETRY_DB_URL` (default `SUPABASE_DB_URL`)
     - `LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC`
     - `LOCK_TELEMETRY_MAX_SAMPLES`
   - Live collect açıkken collector harness başlangıcında background çalışır; cleanup sırasında sonlandırılır.

3. **Correlation confidence scoring**
   - `contention_class` sonuçlarına score + band eklendi.
   - Confidence band mapping:
     - `low`: `< 0.45`
     - `medium`: `0.45 - 0.7499`
     - `high`: `>= 0.75`
   - Class bazında confidence:
     - `network`
     - `db-lock`
     - `stale-race`
     - `unknown`
   - Dominant contention class + score + band hesaplanır.

4. **Report enhancement**
   - Rapor JSON’a yeni alan eklendi:
     - `contention_confidence`
   - `contention_correlation.confidence` içinde class-confidence breakdown taşınır.

## Validation
- `yarn lint`
- `yarn typecheck`

## Suggested next (RLOOP-035)
- Confidence score calibration:
  - Geçmiş run history (`reports/concurrency-harness-history.ndjson`) üzerinden baseline learning
  - Alerting payload’ında confidence-aware routing (ör. high `db-lock` => DB owner page)
  - Collector SQL’ine relation-level blocking graph (blocked_pid/blocking_pid) enrichment
