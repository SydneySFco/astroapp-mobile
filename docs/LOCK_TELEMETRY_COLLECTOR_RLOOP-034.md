# Lock Telemetry Collector (RLOOP-034)

## Objective
Run-time sırasında PostgreSQL lock sinyallerini lightweight şekilde toplayıp NDJSON stream üretmek.

## Script
`scripts/live-lock-telemetry-collector-rloop034.sh`

## Sample output (NDJSON)
```json
{"timestamp_unix":1700000000,"sampled_at_utc":"2026-02-26T13:00:00.123Z","waiting_count":2,"blocked_queries":1,"lock_waiters":1,"active_queries":8,"blocking_graph_summary":{"edge_count":2,"blocker_pid_count":1,"blocked_pid_count":2,"max_blockers_per_blocked":1},"top_blocker_fingerprint":{"blocker_pid":12345,"query_family":"update","query_fingerprint_hash":"8d56f2b6...","query_len":217,"redaction":"hash-only-no-raw-query"},"sample_source":"pg_locks+pg_stat_activity+pg_blocking_pids"}
```

## Query sources
- `pg_locks`: `not granted` lock sayısı
- `pg_stat_activity`:
  - `wait_event_type='Lock'` waiters
  - `state='active' and wait_event_type='Lock'` blocked_queries
  - `state='active'` active_queries
- `pg_blocking_pids()`:
  - blocked -> blocker edge örnekleme
  - graph summary: `edge_count`, `blocker_pid_count`, `blocked_pid_count`, `max_blockers_per_blocked`

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
- Telemetry içinden `top_blocker_fingerprint` aggregate edilip report/alert payload'a taşınır.

## Redaction policy
- Raw SQL query taşınmaz.
- Sadece hash tabanlı fingerprint + query family (örn: `update`) saklanır.
