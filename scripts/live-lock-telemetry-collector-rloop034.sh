#!/usr/bin/env bash
set -euo pipefail

# RLOOP-034 live lock telemetry collector skeleton
# Samples pg_locks + pg_stat_activity and appends NDJSON rows.

LOCK_TELEMETRY_DB_URL="${LOCK_TELEMETRY_DB_URL:-${SUPABASE_DB_URL:-}}"
LOCK_TELEMETRY_OUTPUT_FILE="${LOCK_TELEMETRY_OUTPUT_FILE:-reports/lock-telemetry-live.ndjson}"
LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC="${LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC:-1}"
LOCK_TELEMETRY_MAX_SAMPLES="${LOCK_TELEMETRY_MAX_SAMPLES:-0}"
LOCK_TELEMETRY_SAMPLE_SOURCE="${LOCK_TELEMETRY_SAMPLE_SOURCE:-pg_locks+pg_stat_activity}"

if [[ -z "$LOCK_TELEMETRY_DB_URL" ]]; then
  echo "[collector] LOCK_TELEMETRY_DB_URL (or SUPABASE_DB_URL) is required" >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[collector] psql is required" >&2
  exit 2
fi

mkdir -p "$(dirname "$LOCK_TELEMETRY_OUTPUT_FILE")"

i=0
while true; do
  row="$(PGPASSWORD="" psql "$LOCK_TELEMETRY_DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<'SQL'
with l as (
  select
    count(*) filter (where not granted) as waiting_count
  from pg_locks
), a as (
  select
    count(*) filter (where wait_event_type = 'Lock') as lock_waiters,
    count(*) filter (where state = 'active' and wait_event_type = 'Lock') as blocked_queries,
    count(*) filter (where state = 'active') as active_queries
  from pg_stat_activity
)
select json_build_object(
  'timestamp_unix', extract(epoch from clock_timestamp())::bigint,
  'sampled_at_utc', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'waiting_count', coalesce(l.waiting_count,0),
  'blocked_queries', coalesce(a.blocked_queries,0),
  'lock_waiters', coalesce(a.lock_waiters,0),
  'active_queries', coalesce(a.active_queries,0),
  'sample_source', '${LOCK_TELEMETRY_SAMPLE_SOURCE}'
)::text
from l, a;
SQL
)"

  if [[ -n "$row" ]]; then
    echo "$row" >> "$LOCK_TELEMETRY_OUTPUT_FILE"
  fi

  i=$((i + 1))
  if [[ "$LOCK_TELEMETRY_MAX_SAMPLES" != "0" && $i -ge $LOCK_TELEMETRY_MAX_SAMPLES ]]; then
    break
  fi
  sleep "$LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC"
done

echo "[collector] samples=$i output=${LOCK_TELEMETRY_OUTPUT_FILE}"
