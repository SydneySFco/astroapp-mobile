#!/usr/bin/env bash
set -euo pipefail

# RLOOP-030 DB concurrency harness
# - RPC adapter contract added (http + command adapters)
# - outcome counting wired to real RPC responses when available
# - strict assertions for CI failure semantics

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
WORKERS="${WORKERS:-20}"
ITERATIONS="${ITERATIONS:-5}"

# Adapter mode: auto | dry | rpc_http | command
HARNESS_MODE="${HARNESS_MODE:-auto}"
# command adapter contract: command prints JSON with {"outcome":"applied|idempotent|stale_blocked"}
FINALIZE_RPC_ADAPTER_CMD="${FINALIZE_RPC_ADAPTER_CMD:-}"

# Optional test input wiring (for real environments these should map to seeded job + ownership)
HARNESS_JOB_ID="${HARNESS_JOB_ID:-00000000-0000-0000-0000-000000000000}"
HARNESS_LEASE_TOKEN="${HARNESS_LEASE_TOKEN:-harness-token}"
HARNESS_LEASE_REVISION="${HARNESS_LEASE_REVISION:-1}"
HARNESS_RESULT_STATUS="${HARNESS_RESULT_STATUS:-succeeded}"

# Assertion controls
FAIL_ON_APPLIED_ZERO="${FAIL_ON_APPLIED_ZERO:-1}"
FAIL_ON_THRESHOLD_BREACH="${FAIL_ON_THRESHOLD_BREACH:-1}"
STALE_RATIO_FAIL_THRESHOLD="${STALE_RATIO_FAIL_THRESHOLD:-0.3000}"

TS="$(date -u +%Y%m%d_%H%M%S)"
RAND="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 4)"
SCHEMA="harness_${TS}_${RAND}"
REPORT_DIR="reports"
REPORT_PATH="${REPORT_DIR}/concurrency-harness-${TS}.json"
HISTORY_PATH="${REPORT_DIR}/concurrency-harness-history.ndjson"

mkdir -p "$REPORT_DIR"

cleanup() {
  echo "[harness] cleanup requested for schema=${SCHEMA} (no-op: DB schema lifecycle not yet automated in this script)"
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

echo "[harness] mode=${HARNESS_MODE} workers=${WORKERS} iterations=${ITERATIONS}"

if [[ "$HARNESS_MODE" == "rpc_http" && ( -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ) ]]; then
  echo "[harness] rpc_http mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 2
fi

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
    printf '{"error":"http_%s","body":%s}' "$http_code" "$(python3 - <<'PY' "$body"
import json,sys
print(json.dumps(sys.argv[1]))
PY
)"
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
      if (( i % 10 == 1 )); then
        outcome="applied"
      elif (( i % 4 == 0 )); then
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
if (( TOTAL_ATTEMPTS > 0 && APPLIED == 0 && FAIL_ON_APPLIED_ZERO == 1 )); then
  APPLIED_ZERO_BREACH=1
fi
if [[ "$(is_ge "$STALE_RATIO" "$STALE_RATIO_FAIL_THRESHOLD")" == "1" && "$FAIL_ON_THRESHOLD_BREACH" == "1" ]]; then
  THRESHOLD_BREACH=1
fi

JOB_STATUS="pass"
if (( APPLIED_ZERO_BREACH == 1 || THRESHOLD_BREACH == 1 )); then
  JOB_STATUS="fail"
fi

cat > "$REPORT_PATH" <<JSON
{
  "schema": "${SCHEMA}",
  "timestamp_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mode": "${HARNESS_MODE}",
  "workers": ${WORKERS},
  "iterations": ${ITERATIONS},
  "total_attempts": ${TOTAL_ATTEMPTS},
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
    "applied_zero_breach": ${APPLIED_ZERO_BREACH},
    "threshold_breach": ${THRESHOLD_BREACH},
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
  echo "[harness] strict assertion failed: applied_zero_breach=${APPLIED_ZERO_BREACH}, threshold_breach=${THRESHOLD_BREACH}"
  exit 1
fi

echo "[harness] strict assertions passed"