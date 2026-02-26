#!/usr/bin/env bash
set -euo pipefail

# RLOOP-029 DB-backed concurrency harness skeleton
# NOTE: Placeholder implementation. Real DB calls/assertions planned for RLOOP-030.

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
WORKERS="${WORKERS:-20}"
ITERATIONS="${ITERATIONS:-5}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "[harness] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  echo "[harness] Running in dry skeleton mode; no DB calls will be made."
fi

TS="$(date -u +%Y%m%d_%H%M%S)"
RAND="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 4)"
SCHEMA="harness_${TS}_${RAND}"
REPORT_DIR="reports"
REPORT_PATH="${REPORT_DIR}/concurrency-harness-${TS}.json"

cleanup() {
  echo "[harness] cleanup requested for schema=${SCHEMA} (placeholder)"
  # future: drop schema cascade
}
trap cleanup EXIT

mkdir -p "$REPORT_DIR"

TOTAL_ATTEMPTS=$((WORKERS * ITERATIONS))
# placeholder split for skeleton visibility
APPLIED=$ITERATIONS
IDEMPOTENT=$((TOTAL_ATTEMPTS / 2))
if (( APPLIED + IDEMPOTENT > TOTAL_ATTEMPTS )); then
  IDEMPOTENT=$((TOTAL_ATTEMPTS - APPLIED))
fi
STALE_BLOCKED=$((TOTAL_ATTEMPTS - APPLIED - IDEMPOTENT))

STALE_RATIO="$(awk -v s="$STALE_BLOCKED" -v t="$TOTAL_ATTEMPTS" 'BEGIN { if (t==0) print "0.0000"; else printf "%.4f", s/t }')"

cat > "$REPORT_PATH" <<JSON
{
  "schema": "${SCHEMA}",
  "workers": ${WORKERS},
  "iterations": ${ITERATIONS},
  "total_attempts": ${TOTAL_ATTEMPTS},
  "outcomes": {
    "applied": ${APPLIED},
    "idempotent": ${IDEMPOTENT},
    "stale_blocked": ${STALE_BLOCKED}
  },
  "ratios": {
    "stale_conflict_ratio": ${STALE_RATIO}
  },
  "mode": "skeleton"
}
JSON

echo "[harness] report written: ${REPORT_PATH}"
cat "$REPORT_PATH"
