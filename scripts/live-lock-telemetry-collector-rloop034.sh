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
), blocking_edges as (
  select
    sa.pid as blocked_pid,
    unnest(pg_blocking_pids(sa.pid)) as blocker_pid
  from pg_stat_activity sa
  where cardinality(pg_blocking_pids(sa.pid)) > 0
), g as (
  select
    count(*) as edge_count,
    count(distinct blocker_pid) as blocker_pid_count,
    count(distinct blocked_pid) as blocked_pid_count,
    coalesce(max(edge_per_blocked),0) as max_blockers_per_blocked
  from (
    select blocked_pid, blocker_pid,
           count(*) over(partition by blocked_pid) as edge_per_blocked
    from blocking_edges
  ) t
), blocker_fingerprints as (
  select
    be.blocker_pid,
    split_part(lower(coalesce(sa.query,'')), ' ', 1) as query_family,
    md5(
      regexp_replace(
        regexp_replace(lower(coalesce(sa.query,'')), E'''([^']|'''')*''', '?', 'g'),
        E'\\b[0-9]+(\\.[0-9]+)?\\b', '?', 'g'
      )
    ) as query_fingerprint_hash,
    length(coalesce(sa.query,'')) as query_len,
    row_number() over (
      order by count(*) over(partition by be.blocker_pid) desc, be.blocker_pid asc
    ) as rn
  from blocking_edges be
  join pg_stat_activity sa on sa.pid = be.blocker_pid
), top_blocker as (
  select
    blocker_pid,
    query_family,
    query_fingerprint_hash,
    query_len
  from blocker_fingerprints
  where rn = 1
)
select json_build_object(
  'timestamp_unix', extract(epoch from clock_timestamp())::bigint,
  'sampled_at_utc', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'waiting_count', coalesce(l.waiting_count,0),
  'blocked_queries', coalesce(a.blocked_queries,0),
  'lock_waiters', coalesce(a.lock_waiters,0),
  'active_queries', coalesce(a.active_queries,0),
  'blocking_graph_summary', json_build_object(
    'edge_count', coalesce(g.edge_count,0),
    'blocker_pid_count', coalesce(g.blocker_pid_count,0),
    'blocked_pid_count', coalesce(g.blocked_pid_count,0),
    'max_blockers_per_blocked', coalesce(g.max_blockers_per_blocked,0)
  ),
  'top_blocker_fingerprint', (
    select json_build_object(
      'blocker_pid', tb.blocker_pid,
      'query_family', nullif(tb.query_family,''),
      'query_fingerprint_hash', tb.query_fingerprint_hash,
      'query_len', tb.query_len,
      'redaction', 'hash-only-no-raw-query'
    )
    from top_blocker tb
  ),
  'sample_source', '${LOCK_TELEMETRY_SAMPLE_SOURCE}+pg_blocking_pids'
)::text
from l, a, g;
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
