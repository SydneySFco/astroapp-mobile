# Lock Telemetry Collector (RLOOP-034)

## Objective
Run-time sırasında PostgreSQL lock sinyallerini lightweight şekilde toplayıp NDJSON stream üretmek.

## Script
`scripts/live-lock-telemetry-collector-rloop034.sh`

## Sample output (NDJSON)
```json
{"timestamp_unix":1700000000,"sampled_at_utc":"2026-02-26T13:00:00.123Z","waiting_count":2,"blocked_queries":1,"lock_waiters":1,"active_queries":8,"sample_source":"pg_locks+pg_stat_activity"}
```

## Query sources
- `pg_locks`: `not granted` lock sayısı
- `pg_stat_activity`:
  - `wait_event_type='Lock'` waiters
  - `state='active' and wait_event_type='Lock'` blocked_queries
  - `state='active'` active_queries

## Configuration
- `LOCK_TELEMETRY_DB_URL` (required, fallback `SUPABASE_DB_URL`)
- `LOCK_TELEMETRY_OUTPUT_FILE` (default `reports/lock-telemetry-live.ndjson`)
- `LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC` (default `1`)
- `LOCK_TELEMETRY_MAX_SAMPLES` (default `0` = unlimited)

## Standalone run
```bash
LOCK_TELEMETRY_DB_URL="$SUPABASE_DB_URL" \
LOCK_TELEMETRY_OUTPUT_FILE=reports/lock-telemetry-live.ndjson \
LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC=1 \
LOCK_TELEMETRY_MAX_SAMPLES=30 \
./scripts/live-lock-telemetry-collector-rloop034.sh
```

## Harness integration
`concurrency-harness-rloop029.sh` içinde:
- `LOCK_TELEMETRY_LIVE_COLLECT=1` iken collector otomatik başlar.
- `LOCK_TELEMETRY_FILE` verilmezse auto path: `reports/lock-telemetry-live-<timestamp>.ndjson`
