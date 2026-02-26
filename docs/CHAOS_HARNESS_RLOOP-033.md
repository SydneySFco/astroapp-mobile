# Chaos Harness (RLOOP-033)

## Objective
Tek job yarışından multi-job chaos moduna geçerek lock contention/latency davranışını görünür kılmak.

## Script
`scripts/concurrency-harness-rloop029.sh`

## New controls
- `JOB_POOL_SIZE` (default `3`)
- `WORKER_FAN_OUT` (default `WORKERS` veya `20`)
- `LOCK_TELEMETRY_FILE` (optional NDJSON)
- `LATENCY_SPIKE_THRESHOLD_MS` (default `500`)
- `CONTENTION_WINDOW_SEC` (default `5`)
- `LOCK_TELEMETRY_LIVE_COLLECT` (default `0`, `1` => harness sırasında live collector başlat)
- `LOCK_TELEMETRY_DB_URL` (default `SUPABASE_DB_URL`)
- `LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC` (default `1`)
- `LOCK_TELEMETRY_MAX_SAMPLES` (default `0`)

## Optional fixture overrides
- CSV: `HARNESS_JOB_IDS`, `HARNESS_LEASE_TOKENS`, `HARNESS_LEASE_REVISIONS`
- Legacy single override still works for first slot:
  - `HARNESS_JOB_ID`, `HARNESS_LEASE_TOKEN`, `HARNESS_LEASE_REVISION`

## Example
```bash
JOB_POOL_SIZE=5 \
WORKER_FAN_OUT=10 \
ITERATIONS=4 \
HARNESS_MODE=dry \
LOCK_TELEMETRY_FILE=reports/lock-telemetry.ndjson \
./scripts/concurrency-harness-rloop029.sh
```

## Output extensions
JSON report now includes:
- `job_pool_metrics`
  - pool/fan-out summary
  - per-job outcome/class/latency aggregates
- `contention_correlation`
  - telemetry sample count
  - derived contention windows
  - latency spikes and correlation ratio
  - confidence breakdown (`contention_class_confidence`, dominant class/score/band)
- `contention_confidence`
  - top-level confidence mirror for downstream reporting consumers
- `contention_classes`
  - overall class distribution (`network/db-lock/stale-race/unknown`)

## Classification hints
- `network`: timeout/connection/http5xx-like failures
- `db-lock`: lock/deadlock/wait-event hints
- `stale-race`: stale lease or idempotent replay contention
- `unknown`: non-matching signals

## Confidence bands (RLOOP-034)
- `low`: `< 0.45`
- `medium`: `0.45 - 0.7499`
- `high`: `>= 0.75`

Confidence score signals combine:
- class ratio contribution
- spike/contention correlation ratio
- telemetry strength (window density)
