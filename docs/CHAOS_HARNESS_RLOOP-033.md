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
- `contention_classes`
  - overall class distribution (`network/db-lock/stale-race/unknown`)

## Classification hints
- `network`: timeout/connection/http5xx-like failures
- `db-lock`: lock/deadlock/wait-event hints
- `stale-race`: stale lease or idempotent replay contention
- `unknown`: non-matching signals