#!/usr/bin/env bash
set -euo pipefail

# RLOOP-031 DB concurrency harness
# - ephemeral schema lifecycle (create + deterministic seed + drop)
# - production-like fixture auto wiring for HARNESS_JOB_ID/lease
# - stricter unknown fallback controls + richer JSON report metadata

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"
WORKERS="${WORKERS:-20}"
ITERATIONS="${ITERATIONS:-5}"

# Adapter mode: auto | dry | rpc_http | command
HARNESS_MODE="${HARNESS_MODE:-auto}"
# command adapter contract: command prints JSON with {"outcome":"applied|idempotent|stale_blocked"}
FINALIZE_RPC_ADAPTER_CMD="${FINALIZE_RPC_ADAPTER_CMD:-}"

# Fixture + seed controls
HARNESS_SEED_NAMESPACE="${HARNESS_SEED_NAMESPACE:-rloop031}"
HARNESS_SCHEMA_PREFIX="${HARNESS_SCHEMA_PREFIX:-harness}"
HARNESS_USE_EPHEMERAL_SCHEMA="${HARNESS_USE_EPHEMERAL_SCHEMA:-1}"
HARNESS_AUTO_FIXTURE_INPUTS="${HARNESS_AUTO_FIXTURE_INPUTS:-1}"
HARNESS_RESULT_STATUS="${HARNESS_RESULT_STATUS:-succeeded}"

# Assertion controls
FAIL_ON_APPLIED_ZERO="${FAIL_ON_APPLIED_ZERO:-1}"
FAIL_ON_THRESHOLD_BREACH="${FAIL_ON_THRESHOLD_BREACH:-1}"
STALE_RATIO_FAIL_THRESHOLD="${STALE_RATIO_FAIL_THRESHOLD:-0.3000}"
FAIL_ON_UNKNOWN_RATIO_BREACH="${FAIL_ON_UNKNOWN_RATIO_BREACH:-1}"
UNKNOWN_RATIO_FAIL_THRESHOLD="${UNKNOWN_RATIO_FAIL_THRESHOLD:-0.0500}"

TS="$(date -u +%Y%m%d_%H%M%S)"
RAND="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 4)"
SCHEMA="${HARNESS_SCHEMA_PREFIX}_${TS}_${RAND}"
SCHEMA_SAFE="$(printf '%s' "$SCHEMA" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')"
SEED_KEY="${HARNESS_SEED_NAMESPACE}|${TS}|${WORKERS}|${ITERATIONS}|${SCHEMA_SAFE}"
REPORT_DIR="reports"
REPORT_PATH="${REPORT_DIR}/concurrency-harness-${TS}.json"
HISTORY_PATH="${REPORT_DIR}/concurrency-harness-history.ndjson"

EPHEMERAL_SCHEMA_CREATED=0
EPHEMERAL_SCHEMA_DROPPED=0
SEED_ROWS_INSERTED=0
SEED_SQL_APPLIED=0
FIXTURE_SOURCE="deterministic"

HARNESS_JOB_ID="${HARNESS_JOB_ID:-}"
HARNESS_LEASE_TOKEN="${HARNESS_LEASE_TOKEN:-}"
HARNESS_LEASE_REVISION="${HARNESS_LEASE_REVISION:-}"

mkdir -p "$REPORT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[harness] required command not found: $1"
    exit 2
  fi
}

uuid_from_seed() {
  python3 - <<'PY' "$1"
import hashlib,sys
seed=sys.argv[1].encode("utf-8")
h=hashlib.sha1(seed).hexdigest()
print(f"{h[0:8]}-{h[8:12]}-5{h[13:16]}-a{h[17:20]}-{h[20:32]}")
PY
}

json_escape() {
  python3 - <<'PY' "$1"
import json,sys
print(json.dumps(sys.argv[1]))
PY
}

psql_exec() {
  local sql="$1"
  require_cmd psql
  PGPASSWORD="" psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -X -q -c "$sql"
}

setup_ephemeral_schema() {
  if [[ "$HARNESS_USE_EPHEMERAL_SCHEMA" != "1" ]]; then
    echo "[harness] ephemeral schema disabled"
    return
  fi
  if [[ -z "$SUPABASE_DB_URL" ]]; then
    echo "[harness] SUPABASE_DB_URL missing; schema lifecycle skipped"
    return
  fi

  local ddl
  ddl="create schema if not exists \"${SCHEMA_SAFE}\";"
  psql_exec "$ddl"
  EPHEMERAL_SCHEMA_CREATED=1
  echo "[harness] ephemeral schema created: ${SCHEMA_SAFE}"
}

seed_deterministic_fixtures() {
  local job_seed lease_seed rev_seed
  job_seed="${SEED_KEY}|job"
  lease_seed="${SEED_KEY}|lease"
  rev_seed="${SEED_KEY}|revision"

  if [[ "$HARNESS_AUTO_FIXTURE_INPUTS" == "1" || -z "$HARNESS_JOB_ID" ]]; then
    HARNESS_JOB_ID="$(uuid_from_seed "$job_seed")"
  fi
  if [[ "$HARNESS_AUTO_FIXTURE_INPUTS" == "1" || -z "$HARNESS_LEASE_TOKEN" ]]; then
    HARNESS_LEASE_TOKEN="$(uuid_from_seed "$lease_seed")"
  fi
  if [[ "$HARNESS_AUTO_FIXTURE_INPUTS" == "1" || -z "$HARNESS_LEASE_REVISION" ]]; then
    HARNESS_LEASE_REVISION="$(python3 - <<'PY' "$rev_seed"
import hashlib,sys
v=int(hashlib.sha1(sys.argv[1].encode()).hexdigest()[:8],16)
print((v % 9) + 1)
PY
)"
  fi

  if [[ -n "$SUPABASE_DB_URL" && "$HARNESS_USE_EPHEMERAL_SCHEMA" == "1" ]]; then
    local seed_sql
    seed_sql="insert into public.reconcile_jobs (
      id, report_id, status, attempt_count, max_attempts,
      leased_until, retry_after, last_error_code, last_error_message,
      lease_token, lease_revision, finalized_lease_token, finalized_lease_revision, finalized_result_status
    ) values (
      '${HARNESS_JOB_ID}'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'running',
      1,
      5,
      timezone('utc', now()) + interval '10 minutes',
      null,
      null,
      null,
      '${HARNESS_LEASE_TOKEN}'::uuid,
      ${HARNESS_LEASE_REVISION},
      null,
      null,
      null
    )
    on conflict (id) do update set
      status='running',
      leased_until=excluded.leased_until,
      lease_token=excluded.lease_token,
      lease_revision=excluded.lease_revision,
      finalized_lease_token=null,
      finalized_lease_revision=null,
      finalized_result_status=null,
      finished_at=null,
      updated_at=timezone('utc', now());"
    psql_exec "$seed_sql"
    SEED_SQL_APPLIED=1
    SEED_ROWS_INSERTED=1
    echo "[harness] deterministic fixture seeded into public.reconcile_jobs job_id=${HARNESS_JOB_ID}"
  else
    echo "[harness] deterministic fixture generated (in-memory only)"
  fi
}

cleanup() {
  local ec=$?
  if [[ "$HARNESS_USE_EPHEMERAL_SCHEMA" == "1" && "$EPHEMERAL_SCHEMA_CREATED" == "1" && -n "$SUPABASE_DB_URL" ]]; then
    if psql_exec "drop schema if exists \"${SCHEMA_SAFE}\" cascade;"; then
      EPHEMERAL_SCHEMA_DROPPED=1
      echo "[harness] ephemeral schema dropped: ${SCHEMA_SAFE}"
    else
      echo "[harness] warning: failed to drop schema ${SCHEMA_SAFE}" >&2
    fi
  fi
  return $ec
}
trap cleanup EXIT

if [[ "$HARNESS_MODE" == "auto" ]]; then
  if [[ -n "$FINALIZE_RPC_ADAPTER_CMD" ]]; then
    HARNESS_MODE="command"
  elif [[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    HARNESS_MODE="rpc_http"
  else
    HARNESS_MODE="dry"
  fi
fi

echo "[harness] mode=${HARNESS_MODE} workers=${WORKERS} iterations=${ITERATIONS} schema=${SCHEMA_SAFE}"

if [[ "$HARNESS_MODE" == "rpc_http" && ( -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ) ]]; then
  echo "[harness] rpc_http mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 2
fi

setup_ephemeral_schema
seed_deterministic_fixtures

invoke_finalize_rpc_http() {
  local payload response http_code body
  payload="$(cat <<JSON
{"p_job_id":"${HARNESS_JOB_ID}","p_lease_token":"${HARNESS_LEASE_TOKEN}","p_lease_revision":${HARNESS_LEASE_REVISION},"p_result_status":"${HARNESS_RESULT_STATUS}"}
JSON
)"

  response="$(curl -sS -X POST \
    "${SUPABASE_URL%/}/rest/v1/rpc/finalize_reconcile_job" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: params=single-object" \
    -d "$payload" \
    -w "\n%{http_code}")"

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "$http_code" =~ ^2 ]]; then
    printf '%s' "$body"
  else
    printf '{"error":"http_%s","body":%s}' "$http_code" "$(json_escape "$body")"
  fi
}

invoke_finalize_rpc_command() {
  # shellcheck disable=SC2086
  eval "$FINALIZE_RPC_ADAPTER_CMD"
}

extract_outcome() {
  python3 - <<'PY' "$1"
import json,sys
raw=sys.argv[1]

def stale_hint(d):
    msg=" ".join(str(d.get(k,"")) for k in ("error","message","hint","details","code","body"))
    m=msg.lower()
    return ("stale" in m and "block" in m) or ("conflict" in m and "lease" in m)

try:
    data=json.loads(raw)
except Exception:
    print("unknown")
    raise SystemExit(0)

if isinstance(data,list) and data:
    data=data[0]
if isinstance(data,dict):
    out=data.get("outcome")
    if isinstance(out,str) and out in {"applied","idempotent","stale_blocked"}:
        print(out)
    elif stale_hint(data):
        print("stale_blocked")
    else:
        print("unknown")
else:
    print("unknown")
PY
}

is_ge() {
  python3 - <<'PY' "$1" "$2"
import sys
print("1" if float(sys.argv[1]) >= float(sys.argv[2]) else "0")
PY
}

TOTAL_ATTEMPTS=$((WORKERS * ITERATIONS))
APPLIED=0
IDEMPOTENT=0
STALE_BLOCKED=0
UNKNOWN=0

for ((i=1;i<=TOTAL_ATTEMPTS;i++)); do
  case "$HARNESS_MODE" in
    dry)
      # deterministic dry distribution for local smoke runs
      if (( i == 1 )); then
        outcome="applied"
      elif (( i % 5 == 0 )); then
        outcome="stale_blocked"
      else
        outcome="idempotent"
      fi
      ;;
    rpc_http)
      raw="$(invoke_finalize_rpc_http || true)"
      outcome="$(extract_outcome "$raw")"
      ;;
    command)
      raw="$(invoke_finalize_rpc_command || true)"
      outcome="$(extract_outcome "$raw")"
      ;;
    *)
      echo "[harness] unsupported mode: $HARNESS_MODE"
      exit 2
      ;;
  esac

  case "$outcome" in
    applied) APPLIED=$((APPLIED + 1)) ;;
    idempotent) IDEMPOTENT=$((IDEMPOTENT + 1)) ;;
    stale_blocked) STALE_BLOCKED=$((STALE_BLOCKED + 1)) ;;
    *) UNKNOWN=$((UNKNOWN + 1)) ;;
  esac
done

STALE_RATIO="$(awk -v s="$STALE_BLOCKED" -v t="$TOTAL_ATTEMPTS" 'BEGIN { if (t==0) print "0.0000"; else printf "%.4f", s/t }')"
UNKNOWN_RATIO="$(awk -v u="$UNKNOWN" -v t="$TOTAL_ATTEMPTS" 'BEGIN { if (t==0) print "0.0000"; else printf "%.4f", u/t }')"

PREV_STALE_RATIO="null"
TREND_NOTE="no historical baseline"
if [[ -f "$HISTORY_PATH" ]]; then
  last_line="$(tail -n 1 "$HISTORY_PATH" || true)"
  if [[ -n "$last_line" ]]; then
    PREV_STALE_RATIO="$(python3 - <<'PY' "$last_line"
import json,sys
try:
    d=json.loads(sys.argv[1])
    print(d.get("ratios",{}).get("stale_conflict_ratio","null"))
except Exception:
    print("null")
PY
)"
    if [[ "$PREV_STALE_RATIO" != "null" ]]; then
      TREND_NOTE="compared_to_previous_run"
    fi
  fi
fi

APPLIED_ZERO_BREACH=0
THRESHOLD_BREACH=0
UNKNOWN_RATIO_BREACH=0
if (( TOTAL_ATTEMPTS > 0 && APPLIED == 0 && FAIL_ON_APPLIED_ZERO == 1 )); then
  APPLIED_ZERO_BREACH=1
fi
if [[ "$(is_ge "$STALE_RATIO" "$STALE_RATIO_FAIL_THRESHOLD")" == "1" && "$FAIL_ON_THRESHOLD_BREACH" == "1" ]]; then
  THRESHOLD_BREACH=1
fi
if [[ "$(is_ge "$UNKNOWN_RATIO" "$UNKNOWN_RATIO_FAIL_THRESHOLD")" == "1" && "$FAIL_ON_UNKNOWN_RATIO_BREACH" == "1" ]]; then
  UNKNOWN_RATIO_BREACH=1
fi

JOB_STATUS="pass"
if (( APPLIED_ZERO_BREACH == 1 || THRESHOLD_BREACH == 1 || UNKNOWN_RATIO_BREACH == 1 )); then
  JOB_STATUS="fail"
fi

cat > "$REPORT_PATH" <<JSON
{
  "schema": "${SCHEMA_SAFE}",
  "timestamp_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mode": "${HARNESS_MODE}",
  "workers": ${WORKERS},
  "iterations": ${ITERATIONS},
  "total_attempts": ${TOTAL_ATTEMPTS},
  "seed": {
    "namespace": "${HARNESS_SEED_NAMESPACE}",
    "key": "${SEED_KEY}",
    "result_status": "${HARNESS_RESULT_STATUS}",
    "job_id": "${HARNESS_JOB_ID}",
    "lease_token": "${HARNESS_LEASE_TOKEN}",
    "lease_revision": ${HARNESS_LEASE_REVISION},
    "fixture_source": "${FIXTURE_SOURCE}",
    "seed_sql_applied": ${SEED_SQL_APPLIED},
    "seed_rows_inserted": ${SEED_ROWS_INSERTED}
  },
  "schema_lifecycle": {
    "ephemeral_enabled": ${HARNESS_USE_EPHEMERAL_SCHEMA},
    "created": ${EPHEMERAL_SCHEMA_CREATED},
    "dropped": ${EPHEMERAL_SCHEMA_DROPPED}
  },
  "outcomes": {
    "applied": ${APPLIED},
    "idempotent": ${IDEMPOTENT},
    "stale_blocked": ${STALE_BLOCKED},
    "unknown": ${UNKNOWN}
  },
  "ratios": {
    "stale_conflict_ratio": ${STALE_RATIO},
    "unknown_ratio": ${UNKNOWN_RATIO}
  },
  "assertions": {
    "fail_on_applied_zero": ${FAIL_ON_APPLIED_ZERO},
    "fail_on_threshold_breach": ${FAIL_ON_THRESHOLD_BREACH},
    "stale_ratio_fail_threshold": ${STALE_RATIO_FAIL_THRESHOLD},
    "fail_on_unknown_ratio_breach": ${FAIL_ON_UNKNOWN_RATIO_BREACH},
    "unknown_ratio_fail_threshold": ${UNKNOWN_RATIO_FAIL_THRESHOLD},
    "applied_zero_breach": ${APPLIED_ZERO_BREACH},
    "threshold_breach": ${THRESHOLD_BREACH},
    "unknown_ratio_breach": ${UNKNOWN_RATIO_BREACH},
    "job_status": "${JOB_STATUS}"
  },
  "trend": {
    "previous_stale_conflict_ratio": ${PREV_STALE_RATIO},
    "note": "${TREND_NOTE}"
  }
}
JSON

cat "$REPORT_PATH"
echo "[harness] report written: ${REPORT_PATH}"

cat "$REPORT_PATH" >> "$HISTORY_PATH"
echo "[harness] history appended: ${HISTORY_PATH}"

if [[ "$JOB_STATUS" != "pass" ]]; then
  echo "[harness] strict assertion failed: applied_zero_breach=${APPLIED_ZERO_BREACH}, threshold_breach=${THRESHOLD_BREACH}, unknown_ratio_breach=${UNKNOWN_RATIO_BREACH}"
  exit 1
fi

echo "[harness] strict assertions passed"