#!/usr/bin/env bash
set -euo pipefail

# RLOOP-033 DB concurrency harness
# - multi-job chaos mode (parallel finalize race across job pool)
# - worker fan-out and job pool sizing controls
# - lock telemetry correlation draft + contention classification

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"

# Legacy compatibility: WORKERS still accepted, maps to WORKER_FAN_OUT when unset.
WORKERS="${WORKERS:-20}"
WORKER_FAN_OUT="${WORKER_FAN_OUT:-$WORKERS}"
ITERATIONS="${ITERATIONS:-5}"
JOB_POOL_SIZE="${JOB_POOL_SIZE:-3}"

# Adapter mode: auto | dry | rpc_http | command
HARNESS_MODE="${HARNESS_MODE:-auto}"
# command adapter contract: command prints JSON with {"outcome":"applied|idempotent|stale_blocked"}
FINALIZE_RPC_ADAPTER_CMD="${FINALIZE_RPC_ADAPTER_CMD:-}"

# Fixture + seed controls
HARNESS_SEED_NAMESPACE="${HARNESS_SEED_NAMESPACE:-rloop033}"
HARNESS_SCHEMA_PREFIX="${HARNESS_SCHEMA_PREFIX:-harness}"
HARNESS_USE_EPHEMERAL_SCHEMA="${HARNESS_USE_EPHEMERAL_SCHEMA:-1}"
HARNESS_AUTO_FIXTURE_INPUTS="${HARNESS_AUTO_FIXTURE_INPUTS:-1}"
HARNESS_RESULT_STATUS="${HARNESS_RESULT_STATUS:-succeeded}"

# Optional explicit single-fixture override compatibility
HARNESS_JOB_ID="${HARNESS_JOB_ID:-}"
HARNESS_LEASE_TOKEN="${HARNESS_LEASE_TOKEN:-}"
HARNESS_LEASE_REVISION="${HARNESS_LEASE_REVISION:-}"

# Optional explicit multi-fixture CSV overrides
HARNESS_JOB_IDS="${HARNESS_JOB_IDS:-}"
HARNESS_LEASE_TOKENS="${HARNESS_LEASE_TOKENS:-}"
HARNESS_LEASE_REVISIONS="${HARNESS_LEASE_REVISIONS:-}"

# Lock telemetry correlation draft inputs
LOCK_TELEMETRY_FILE="${LOCK_TELEMETRY_FILE:-}"
LATENCY_SPIKE_THRESHOLD_MS="${LATENCY_SPIKE_THRESHOLD_MS:-500}"
CONTENTION_WINDOW_SEC="${CONTENTION_WINDOW_SEC:-5}"

# Optional live collector integration (RLOOP-034)
LOCK_TELEMETRY_LIVE_COLLECT="${LOCK_TELEMETRY_LIVE_COLLECT:-0}"
LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC="${LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC:-1}"
LOCK_TELEMETRY_MAX_SAMPLES="${LOCK_TELEMETRY_MAX_SAMPLES:-0}"
LOCK_TELEMETRY_DB_URL="${LOCK_TELEMETRY_DB_URL:-$SUPABASE_DB_URL}"

# Assertion controls
FAIL_ON_APPLIED_ZERO="${FAIL_ON_APPLIED_ZERO:-1}"
FAIL_ON_THRESHOLD_BREACH="${FAIL_ON_THRESHOLD_BREACH:-1}"
STALE_RATIO_FAIL_THRESHOLD="${STALE_RATIO_FAIL_THRESHOLD:-0.3000}"
FAIL_ON_UNKNOWN_RATIO_BREACH="${FAIL_ON_UNKNOWN_RATIO_BREACH:-1}"
UNKNOWN_RATIO_FAIL_THRESHOLD="${UNKNOWN_RATIO_FAIL_THRESHOLD:-0.0500}"

# Optional fail gates
FAIL_ON_P95_LATENCY_BREACH="${FAIL_ON_P95_LATENCY_BREACH:-0}"
P95_LATENCY_FAIL_THRESHOLD_MS="${P95_LATENCY_FAIL_THRESHOLD_MS:-800}"
FAIL_ON_CONSISTENCY_BREACH="${FAIL_ON_CONSISTENCY_BREACH:-0}"
CONSISTENCY_MIN_RATIO="${CONSISTENCY_MIN_RATIO:-0.9000}"
FAIL_ON_IDEMPOTENCY_DRIFT_BREACH="${FAIL_ON_IDEMPOTENCY_DRIFT_BREACH:-0}"
IDEMPOTENCY_DRIFT_MAX_DELTA="${IDEMPOTENCY_DRIFT_MAX_DELTA:-0.2000}"

TS="$(date -u +%Y%m%d_%H%M%S)"
RAND="$(python3 - <<'PY'
import random,string
print(''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(4)))
PY
)"
SCHEMA="${HARNESS_SCHEMA_PREFIX}_${TS}_${RAND}"
SCHEMA_SAFE="$(printf '%s' "$SCHEMA" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')"
SEED_KEY="${HARNESS_SEED_NAMESPACE}|${TS}|${JOB_POOL_SIZE}|${WORKER_FAN_OUT}|${ITERATIONS}|${SCHEMA_SAFE}"
REPORT_DIR="reports"
REPORT_PATH="${REPORT_DIR}/concurrency-harness-${TS}.json"
HISTORY_PATH="${REPORT_DIR}/concurrency-harness-history.ndjson"

EPHEMERAL_SCHEMA_CREATED=0
EPHEMERAL_SCHEMA_DROPPED=0
SEED_ROWS_INSERTED=0
SEED_SQL_APPLIED=0
FIXTURE_SOURCE="deterministic"

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
  psql_exec "create schema if not exists \"${SCHEMA_SAFE}\";"
  EPHEMERAL_SCHEMA_CREATED=1
  echo "[harness] ephemeral schema created: ${SCHEMA_SAFE}"
}

split_csv_to_file() {
  local csv="$1"
  local out="$2"
  : > "$out"
  if [[ -z "$csv" ]]; then
    return
  fi
  awk -F',' '{for(i=1;i<=NF;i++){gsub(/^ +| +$/,"",$i); if(length($i)>0) print $i}}' <<<"$csv" >> "$out"
}

seed_deterministic_fixtures() {
  JOBS_FILE="${TMP_DIR}/jobs.tsv"
  : > "$JOBS_FILE"

  local ids_file tokens_file revs_file
  ids_file="${TMP_DIR}/job_ids.txt"
  tokens_file="${TMP_DIR}/lease_tokens.txt"
  revs_file="${TMP_DIR}/lease_revs.txt"

  split_csv_to_file "$HARNESS_JOB_IDS" "$ids_file"
  split_csv_to_file "$HARNESS_LEASE_TOKENS" "$tokens_file"
  split_csv_to_file "$HARNESS_LEASE_REVISIONS" "$revs_file"

  local idx=1
  while (( idx <= JOB_POOL_SIZE )); do
    local job_id lease_token lease_revision
    local job_seed="${SEED_KEY}|job|${idx}"
    local lease_seed="${SEED_KEY}|lease|${idx}"
    local rev_seed="${SEED_KEY}|revision|${idx}"

    job_id="$(sed -n "${idx}p" "$ids_file" || true)"
    lease_token="$(sed -n "${idx}p" "$tokens_file" || true)"
    lease_revision="$(sed -n "${idx}p" "$revs_file" || true)"

    if [[ "$idx" == "1" && -n "$HARNESS_JOB_ID" ]]; then job_id="$HARNESS_JOB_ID"; fi
    if [[ "$idx" == "1" && -n "$HARNESS_LEASE_TOKEN" ]]; then lease_token="$HARNESS_LEASE_TOKEN"; fi
    if [[ "$idx" == "1" && -n "$HARNESS_LEASE_REVISION" ]]; then lease_revision="$HARNESS_LEASE_REVISION"; fi

    if [[ "$HARNESS_AUTO_FIXTURE_INPUTS" == "1" || -z "$job_id" ]]; then
      job_id="$(uuid_from_seed "$job_seed")"
    fi
    if [[ "$HARNESS_AUTO_FIXTURE_INPUTS" == "1" || -z "$lease_token" ]]; then
      lease_token="$(uuid_from_seed "$lease_seed")"
    fi
    if [[ "$HARNESS_AUTO_FIXTURE_INPUTS" == "1" || -z "$lease_revision" ]]; then
      lease_revision="$(python3 - <<'PY' "$rev_seed"
import hashlib,sys
v=int(hashlib.sha1(sys.argv[1].encode()).hexdigest()[:8],16)
print((v % 9) + 1)
PY
)"
    fi

    printf '%s\t%s\t%s\t%s\n' "$idx" "$job_id" "$lease_token" "$lease_revision" >> "$JOBS_FILE"

    if [[ -n "$SUPABASE_DB_URL" && "$HARNESS_USE_EPHEMERAL_SCHEMA" == "1" ]]; then
      local seed_sql
      seed_sql="insert into public.reconcile_jobs (
        id, report_id, status, attempt_count, max_attempts,
        leased_until, retry_after, last_error_code, last_error_message,
        lease_token, lease_revision, finalized_lease_token, finalized_lease_revision, finalized_result_status
      ) values (
        '${job_id}'::uuid,
        '11111111-1111-1111-1111-111111111111'::uuid,
        'running',
        1,
        5,
        timezone('utc', now()) + interval '10 minutes',
        null,
        null,
        null,
        '${lease_token}'::uuid,
        ${lease_revision},
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
      SEED_ROWS_INSERTED=$((SEED_ROWS_INSERTED + 1))
    fi

    idx=$((idx + 1))
  done

  if [[ "$SEED_SQL_APPLIED" == "1" ]]; then
    echo "[harness] deterministic fixtures seeded into public.reconcile_jobs count=${SEED_ROWS_INSERTED}"
  else
    echo "[harness] deterministic fixtures generated (in-memory only) count=${JOB_POOL_SIZE}"
  fi
}

cleanup() {
  local ec=$?
  if [[ -n "${LOCK_COLLECTOR_PID:-}" ]]; then
    kill "${LOCK_COLLECTOR_PID}" >/dev/null 2>&1 || true
    wait "${LOCK_COLLECTOR_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "$HARNESS_USE_EPHEMERAL_SCHEMA" == "1" && "$EPHEMERAL_SCHEMA_CREATED" == "1" && -n "$SUPABASE_DB_URL" ]]; then
    if psql_exec "drop schema if exists \"${SCHEMA_SAFE}\" cascade;"; then
      EPHEMERAL_SCHEMA_DROPPED=1
      echo "[harness] ephemeral schema dropped: ${SCHEMA_SAFE}"
    else
      echo "[harness] warning: failed to drop schema ${SCHEMA_SAFE}" >&2
    fi
  fi
  rm -rf "${TMP_DIR:-}" >/dev/null 2>&1 || true
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

echo "[harness] mode=${HARNESS_MODE} jobs=${JOB_POOL_SIZE} fan_out=${WORKER_FAN_OUT} iterations=${ITERATIONS} schema=${SCHEMA_SAFE}"

if [[ "$HARNESS_MODE" == "rpc_http" && ( -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ) ]]; then
  echo "[harness] rpc_http mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 2
fi

TMP_DIR="$(mktemp -d)"
ATTEMPTS_FILE="${TMP_DIR}/attempts.ndjson"
: > "$ATTEMPTS_FILE"

LOCK_COLLECTOR_PID=""
if [[ "$LOCK_TELEMETRY_LIVE_COLLECT" == "1" && -z "$LOCK_TELEMETRY_FILE" ]]; then
  LOCK_TELEMETRY_FILE="${REPORT_DIR}/lock-telemetry-live-${TS}.ndjson"
fi

setup_ephemeral_schema
seed_deterministic_fixtures

start_live_lock_collector() {
  if [[ "$LOCK_TELEMETRY_LIVE_COLLECT" != "1" ]]; then
    return
  fi
  if [[ -z "$LOCK_TELEMETRY_DB_URL" ]]; then
    echo "[harness] live lock collector skipped: LOCK_TELEMETRY_DB_URL missing"
    return
  fi
  echo "[harness] live lock collector started: ${LOCK_TELEMETRY_FILE}"
  LOCK_TELEMETRY_DB_URL="$LOCK_TELEMETRY_DB_URL" \
  LOCK_TELEMETRY_OUTPUT_FILE="$LOCK_TELEMETRY_FILE" \
  LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC="$LOCK_TELEMETRY_SAMPLE_INTERVAL_SEC" \
  LOCK_TELEMETRY_MAX_SAMPLES="$LOCK_TELEMETRY_MAX_SAMPLES" \
    ./scripts/live-lock-telemetry-collector-rloop034.sh >/dev/null 2>&1 &
  LOCK_COLLECTOR_PID="$!"
}

start_live_lock_collector

invoke_finalize_rpc_http() {
  local job_id="$1"
  local lease_token="$2"
  local lease_revision="$3"
  local payload response http_code body

  payload="$(cat <<JSON
{"p_job_id":"${job_id}","p_lease_token":"${lease_token}","p_lease_revision":${lease_revision},"p_result_status":"${HARNESS_RESULT_STATUS}"}
JSON
)"

  response="$(curl -sS -X POST \
    "${SUPABASE_URL%/}/rest/v1/rpc/finalize_reconcile_job" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: params=single-object" \
    -d "$payload" \
    -w "\n%{http_code}" || true)"

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "$http_code" =~ ^2 ]]; then
    printf '%s' "$body"
  else
    printf '{"error":"http_%s","body":%s}' "$http_code" "$(json_escape "$body")"
  fi
}

invoke_finalize_rpc_command() {
  local job_id="$1"
  local lease_token="$2"
  local lease_revision="$3"
  export HARNESS_JOB_ID="$job_id"
  export HARNESS_LEASE_TOKEN="$lease_token"
  export HARNESS_LEASE_REVISION="$lease_revision"
  # shellcheck disable=SC2086
  eval "$FINALIZE_RPC_ADAPTER_CMD"
}

extract_outcome_and_class() {
  python3 - <<'PY' "$1"
import json,sys
raw=sys.argv[1]


def lower_join(obj):
    if isinstance(obj, dict):
        parts=[str(obj.get(k,"")) for k in ("error","message","hint","details","code","body")]
        return " ".join(parts).lower()
    return str(obj).lower()

try:
    data=json.loads(raw)
except Exception:
    print("unknown unknown")
    raise SystemExit(0)

if isinstance(data,list) and data:
    data=data[0]

outcome="unknown"
klass="unknown"

if isinstance(data,dict):
    out=data.get("outcome")
    m=lower_join(data)

    if isinstance(out,str) and out in {"applied","idempotent","stale_blocked"}:
        outcome=out
    elif ("stale" in m and "block" in m) or ("conflict" in m and "lease" in m):
        outcome="stale_blocked"

    if "timeout" in m or "connection" in m or "econn" in m or "socket" in m or "dns" in m or "http_5" in m:
        klass="network"
    elif "lock" in m or "deadlock" in m or "pg_locks" in m or "wait_event_type" in m:
        klass="db-lock"
    elif outcome in {"stale_blocked","idempotent"}:
        klass="stale-race"
    else:
        klass="unknown"

print(f"{outcome} {klass}")
PY
}

run_single_attempt() {
  local iteration="$1"
  local pool_slot="$2"
  local worker_slot="$3"
  local job_id="$4"
  local lease_token="$5"
  local lease_revision="$6"
  local out_file="$7"

  local raw=""
  local outcome="unknown"
  local class="unknown"
  local start_ns end_ns latency_ms
  local ts_unix

  start_ns="$(date +%s%N)"
  ts_unix="$(date +%s)"

  case "$HARNESS_MODE" in
    dry)
      if (( iteration == 1 && worker_slot == 1 && pool_slot == 1 )); then
        outcome="applied"; class="stale-race"
      elif (( (iteration + worker_slot + pool_slot) % 7 == 0 )); then
        outcome="stale_blocked"; class="db-lock"
      elif (( (iteration + worker_slot + pool_slot) % 11 == 0 )); then
        outcome="unknown"; class="network"
      else
        outcome="idempotent"; class="stale-race"
      fi
      ;;
    rpc_http)
      raw="$(invoke_finalize_rpc_http "$job_id" "$lease_token" "$lease_revision")"
      read -r outcome class <<<"$(extract_outcome_and_class "$raw")"
      ;;
    command)
      raw="$(invoke_finalize_rpc_command "$job_id" "$lease_token" "$lease_revision" || true)"
      read -r outcome class <<<"$(extract_outcome_and_class "$raw")"
      ;;
    *)
      outcome="unknown"; class="unknown"
      ;;
  esac

  end_ns="$(date +%s%N)"
  latency_ms="$(python3 - <<'PY' "$start_ns" "$end_ns"
import sys
s=int(sys.argv[1]); e=int(sys.argv[2])
print(f"{max(e-s,0)/1_000_000:.3f}")
PY
)"

  printf '{"timestamp_unix":%s,"iteration":%s,"pool_slot":%s,"worker_slot":%s,"job_id":"%s","outcome":"%s","contention_class":"%s","latency_ms":%s}\n' \
    "$ts_unix" "$iteration" "$pool_slot" "$worker_slot" "$job_id" "$outcome" "$class" "$latency_ms" > "$out_file"
}

declare -a PIDS
TOTAL_ATTEMPTS=$((JOB_POOL_SIZE * WORKER_FAN_OUT * ITERATIONS))

i=1
while (( i <= ITERATIONS )); do
  PIDS=()
  while IFS=$'\t' read -r pool_slot job_id lease_token lease_revision; do
    w=1
    while (( w <= WORKER_FAN_OUT )); do
      run_single_attempt "$i" "$pool_slot" "$w" "$job_id" "$lease_token" "$lease_revision" "${TMP_DIR}/attempt-${i}-${pool_slot}-${w}.json" &
      PIDS+=("$!")
      w=$((w + 1))
    done
  done < "$JOBS_FILE"

  for pid in "${PIDS[@]}"; do
    wait "$pid"
  done

  while IFS=$'\t' read -r pool_slot _job_id _lease_token _lease_revision; do
    w=1
    while (( w <= WORKER_FAN_OUT )); do
      cat "${TMP_DIR}/attempt-${i}-${pool_slot}-${w}.json" >> "$ATTEMPTS_FILE"
      w=$((w + 1))
    done
  done < "$JOBS_FILE"

  i=$((i + 1))
done

METRICS_JSON="$(python3 - <<'PY' "$ATTEMPTS_FILE" "$ITERATIONS" "$WORKER_FAN_OUT" "$JOB_POOL_SIZE" "$LATENCY_SPIKE_THRESHOLD_MS" "$CONTENTION_WINDOW_SEC" "$LOCK_TELEMETRY_FILE"
import json, statistics, sys, datetime
from collections import defaultdict

path=sys.argv[1]
iterations=int(sys.argv[2])
fan_out=int(sys.argv[3])
pool_size=int(sys.argv[4])
lat_spike=float(sys.argv[5])
window_sec=int(sys.argv[6])
lock_file=sys.argv[7]

rows=[]
with open(path,"r",encoding="utf-8") as f:
    for line in f:
        line=line.strip()
        if line:
            rows.append(json.loads(line))

def percentile(sorted_vals, p):
    if not sorted_vals:
        return 0.0
    if len(sorted_vals)==1:
        return float(sorted_vals[0])
    k=(len(sorted_vals)-1)*(p/100.0)
    lo=int(k)
    hi=min(lo+1, len(sorted_vals)-1)
    if lo==hi:
        return float(sorted_vals[lo])
    frac=k-lo
    return float(sorted_vals[lo] + (sorted_vals[hi]-sorted_vals[lo])*frac)

outcomes=defaultdict(int)
classes=defaultdict(int)
latencies=[]
by_iter_slot=defaultdict(list)
by_job=defaultdict(list)
latency_spikes=[]

for r in rows:
    o=r.get("outcome","unknown")
    c=r.get("contention_class","unknown")
    outcomes[o]+=1
    classes[c]+=1
    lat=float(r.get("latency_ms",0.0))
    latencies.append(lat)
    by_iter_slot[(int(r["iteration"]), int(r["worker_slot"]))].append(r)
    by_job[r.get("job_id","unknown")].append(r)
    if lat >= lat_spike:
        latency_spikes.append({"timestamp_unix":int(r.get("timestamp_unix",0)),"latency_ms":round(lat,3),"job_id":r.get("job_id")})

for k in ("applied","idempotent","stale_blocked","unknown"):
    outcomes[k]=outcomes.get(k,0)
for k in ("network","db-lock","stale-race","unknown"):
    classes[k]=classes.get(k,0)

lat_sorted=sorted(latencies)
p50=percentile(lat_sorted,50)
p95=percentile(lat_sorted,95)
p99=percentile(lat_sorted,99)

sequence_match=0
sequence_total=0
consistency_by_slot=[]
idempotent_ratios=[]

base={}
for slot in range(1, fan_out+1):
    key=(1,slot)
    if by_iter_slot.get(key):
        base[slot]=by_iter_slot[key][0].get("outcome","unknown")

for slot in range(1, fan_out+1):
    slot_total=0
    slot_match=0
    for it in range(1, iterations+1):
        seq=by_iter_slot.get((it,slot),[])
        if not seq:
            continue
        ref=base.get(slot)
        if ref is None:
            continue
        for cur_row in seq:
            cur=cur_row.get("outcome","unknown")
            sequence_total+=1
            slot_total+=1
            if cur==ref:
                sequence_match+=1
                slot_match+=1
    ratio=(slot_match/slot_total) if slot_total else 0.0
    consistency_by_slot.append({"worker_slot":slot,"match_ratio":round(ratio,4)})

for it in range(1, iterations+1):
    vals=[r for r in rows if int(r["iteration"])==it]
    total=len(vals)
    idem=sum(1 for v in vals if v.get("outcome")=="idempotent")
    ratio=(idem/total) if total else 0.0
    idempotent_ratios.append({"iteration":it,"idempotent_ratio":round(ratio,4)})

retry_after_applied=0
applied_seen=False
for it in range(1, iterations+1):
    vals=[r for r in rows if int(r["iteration"])==it]
    for v in vals:
        o=v.get("outcome")
        if o=="applied":
            applied_seen=True
        elif applied_seen and o!="unknown":
            retry_after_applied+=1

ratio_values=[x["idempotent_ratio"] for x in idempotent_ratios]
idempotent_drift_delta=(max(ratio_values)-min(ratio_values)) if ratio_values else 0.0
consistency_ratio=(sequence_match/sequence_total) if sequence_total else 0.0

job_pool_metrics={
  "job_pool_size": pool_size,
  "worker_fan_out": fan_out,
  "attempts_per_iteration": pool_size * fan_out,
  "total_attempts": len(rows),
  "jobs": []
}
for job_id, job_rows in by_job.items():
    o=defaultdict(int)
    c=defaultdict(int)
    l=[]
    for jr in job_rows:
        o[jr.get("outcome","unknown")]+=1
        c[jr.get("contention_class","unknown")]+=1
        l.append(float(jr.get("latency_ms",0.0)))
    s=sorted(l)
    job_pool_metrics["jobs"].append({
      "job_id": job_id,
      "attempts": len(job_rows),
      "outcomes": {"applied":o["applied"],"idempotent":o["idempotent"],"stale_blocked":o["stale_blocked"],"unknown":o["unknown"]},
      "contention_classes": {"network":c["network"],"db-lock":c["db-lock"],"stale-race":c["stale-race"],"unknown":c["unknown"]},
      "latency_ms": {"p95":round(percentile(s,95),3),"max":round(max(s) if s else 0.0,3)}
    })

telemetry_rows=[]
if lock_file:
    try:
        with open(lock_file,"r",encoding="utf-8") as f:
            for line in f:
                line=line.strip()
                if not line:
                    continue
                telemetry_rows.append(json.loads(line))
    except FileNotFoundError:
        telemetry_rows=[]

contention_windows=[]
for t in telemetry_rows:
    ts=int(t.get("timestamp_unix",0))
    waiting=int(t.get("waiting_count",0))
    blocked=int(t.get("blocked_queries",0))
    lock_wait=int(t.get("lock_waiters",0))
    if waiting>0 or blocked>0 or lock_wait>0:
        contention_windows.append({
            "start_unix": ts,
            "end_unix": ts + window_sec,
            "waiting_count": waiting,
            "blocked_queries": blocked,
            "lock_waiters": lock_wait,
            "sample_source": t.get("sample_source","pg_locks+pg_stat_activity")
        })

spikes_correlated=0
for sp in latency_spikes:
    st=sp["timestamp_unix"]
    for w in contention_windows:
        if w["start_unix"] <= st <= w["end_unix"]:
            spikes_correlated += 1
            break

corr_ratio=(spikes_correlated/len(latency_spikes)) if latency_spikes else 0.0
telemetry_strength=min(1.0, len(contention_windows)/max(iterations,1))
class_total=max(len(rows),1)

def clamp(v):
    return max(0.0,min(1.0,v))

def band(score):
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"

network_ratio=classes["network"]/class_total
db_lock_ratio=classes["db-lock"]/class_total
stale_race_ratio=classes["stale-race"]/class_total
unknown_ratio=classes["unknown"]/class_total

network_score=clamp((network_ratio*0.7) + ((1.0-corr_ratio)*0.2) + ((1.0-telemetry_strength)*0.1))
db_lock_score=clamp((db_lock_ratio*0.55) + (corr_ratio*0.35) + (telemetry_strength*0.1))
stale_race_score=clamp((stale_race_ratio*0.65) + ((1.0-corr_ratio)*0.2) + ((1.0-db_lock_ratio)*0.15))
unknown_score=clamp((unknown_ratio*0.8) + ((1.0-telemetry_strength)*0.2))

class_confidence={
  "network": {
    "score": round(network_score,4),
    "band": band(network_score),
    "signals": {"class_ratio": round(network_ratio,4), "corr_ratio": round(corr_ratio,4)}
  },
  "db-lock": {
    "score": round(db_lock_score,4),
    "band": band(db_lock_score),
    "signals": {"class_ratio": round(db_lock_ratio,4), "corr_ratio": round(corr_ratio,4), "telemetry_strength": round(telemetry_strength,4)}
  },
  "stale-race": {
    "score": round(stale_race_score,4),
    "band": band(stale_race_score),
    "signals": {"class_ratio": round(stale_race_ratio,4), "inverse_corr_ratio": round(1.0-corr_ratio,4)}
  },
  "unknown": {
    "score": round(unknown_score,4),
    "band": band(unknown_score),
    "signals": {"class_ratio": round(unknown_ratio,4), "telemetry_strength": round(telemetry_strength,4)}
  }
}

dominant_class=max(class_confidence.items(), key=lambda kv: kv[1]["score"])[0]

contention_correlation={
  "telemetry_enabled": bool(lock_file),
  "telemetry_samples": len(telemetry_rows),
  "contention_windows": contention_windows,
  "latency_spike_threshold_ms": lat_spike,
  "latency_spikes": latency_spikes,
  "spikes_correlated_with_contention": spikes_correlated,
  "spike_contention_correlation_ratio": round(corr_ratio,4),
  "confidence": {
    "contention_class_confidence": class_confidence,
    "dominant_contention_class": dominant_class,
    "dominant_confidence_score": class_confidence[dominant_class]["score"],
    "dominant_confidence_band": class_confidence[dominant_class]["band"]
  },
  "sampling_plan": {
    "interval_sec": 1,
    "recommended_queries": [
      "select now() as sampled_at, count(*) filter (where not granted) as waiting_count from pg_locks;",
      "select now() as sampled_at, count(*) filter (where wait_event_type = 'Lock') as lock_waiters, count(*) filter (where state='active') as active_queries from pg_stat_activity;"
    ]
  }
}

result={
  "outcomes": {k:int(outcomes[k]) for k in ("applied","idempotent","stale_blocked","unknown")},
  "contention_classes": {k:int(classes[k]) for k in ("network","db-lock","stale-race","unknown")},
  "latency_ms": {
    "p50": round(p50,3),
    "p95": round(p95,3),
    "p99": round(p99,3),
    "min": round(min(lat_sorted) if lat_sorted else 0.0,3),
    "max": round(max(lat_sorted) if lat_sorted else 0.0,3),
    "mean": round(statistics.fmean(lat_sorted) if lat_sorted else 0.0,3)
  },
  "consistency": {
    "sequence_match_ratio": round(consistency_ratio,4),
    "sequence_matches": sequence_match,
    "sequence_total": sequence_total,
    "by_worker_slot": consistency_by_slot
  },
  "retry_idempotency_drift": {
    "idempotent_ratio_by_iteration": idempotent_ratios,
    "idempotent_ratio_drift_delta": round(idempotent_drift_delta,4),
    "retry_outcomes_after_first_applied": retry_after_applied
  },
  "job_pool_metrics": job_pool_metrics,
  "contention_correlation": contention_correlation,
  "contention_confidence": contention_correlation["confidence"]
}
print(json.dumps(result))
PY
)"

APPLIED="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["outcomes"]["applied"])
PY
)"
IDEMPOTENT="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["outcomes"]["idempotent"])
PY
)"
STALE_BLOCKED="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["outcomes"]["stale_blocked"])
PY
)"
UNKNOWN="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["outcomes"]["unknown"])
PY
)"

P50_LAT_MS="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["latency_ms"]["p50"])
PY
)"
P95_LAT_MS="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["latency_ms"]["p95"])
PY
)"
P99_LAT_MS="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["latency_ms"]["p99"])
PY
)"
SEQUENCE_MATCH_RATIO="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["consistency"]["sequence_match_ratio"])
PY
)"
IDEMPOTENCY_DRIFT_DELTA="$(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.loads(sys.argv[1])["retry_idempotency_drift"]["idempotent_ratio_drift_delta"])
PY
)"

STALE_RATIO="$(awk -v s="$STALE_BLOCKED" -v t="$TOTAL_ATTEMPTS" 'BEGIN { if (t==0) print "0.0000"; else printf "%.4f", s/t }')"
UNKNOWN_RATIO="$(awk -v u="$UNKNOWN" -v t="$TOTAL_ATTEMPTS" 'BEGIN { if (t==0) print "0.0000"; else printf "%.4f", u/t }')"

is_ge() {
  python3 - <<'PY' "$1" "$2"
import sys
print("1" if float(sys.argv[1]) >= float(sys.argv[2]) else "0")
PY
}

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
P95_LATENCY_BREACH=0
CONSISTENCY_BREACH=0
IDEMPOTENCY_DRIFT_BREACH=0

if (( TOTAL_ATTEMPTS > 0 && APPLIED == 0 && FAIL_ON_APPLIED_ZERO == 1 )); then APPLIED_ZERO_BREACH=1; fi
if [[ "$(is_ge "$STALE_RATIO" "$STALE_RATIO_FAIL_THRESHOLD")" == "1" && "$FAIL_ON_THRESHOLD_BREACH" == "1" ]]; then THRESHOLD_BREACH=1; fi
if [[ "$(is_ge "$UNKNOWN_RATIO" "$UNKNOWN_RATIO_FAIL_THRESHOLD")" == "1" && "$FAIL_ON_UNKNOWN_RATIO_BREACH" == "1" ]]; then UNKNOWN_RATIO_BREACH=1; fi
if [[ "$(is_ge "$P95_LAT_MS" "$P95_LATENCY_FAIL_THRESHOLD_MS")" == "1" && "$FAIL_ON_P95_LATENCY_BREACH" == "1" ]]; then P95_LATENCY_BREACH=1; fi
if [[ "$(python3 - <<'PY' "$SEQUENCE_MATCH_RATIO" "$CONSISTENCY_MIN_RATIO"
import sys
print("1" if float(sys.argv[1]) < float(sys.argv[2]) else "0")
PY
)" == "1" && "$FAIL_ON_CONSISTENCY_BREACH" == "1" ]]; then CONSISTENCY_BREACH=1; fi
if [[ "$(is_ge "$IDEMPOTENCY_DRIFT_DELTA" "$IDEMPOTENCY_DRIFT_MAX_DELTA")" == "1" && "$FAIL_ON_IDEMPOTENCY_DRIFT_BREACH" == "1" ]]; then IDEMPOTENCY_DRIFT_BREACH=1; fi

JOB_STATUS="pass"
if (( APPLIED_ZERO_BREACH == 1 || THRESHOLD_BREACH == 1 || UNKNOWN_RATIO_BREACH == 1 || P95_LATENCY_BREACH == 1 || CONSISTENCY_BREACH == 1 || IDEMPOTENCY_DRIFT_BREACH == 1 )); then
  JOB_STATUS="fail"
fi

cat > "$REPORT_PATH" <<JSON
{
  "schema": "${SCHEMA_SAFE}",
  "timestamp_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mode": "${HARNESS_MODE}",
  "job_pool_size": ${JOB_POOL_SIZE},
  "worker_fan_out": ${WORKER_FAN_OUT},
  "iterations": ${ITERATIONS},
  "total_attempts": ${TOTAL_ATTEMPTS},
  "seed": {
    "namespace": "${HARNESS_SEED_NAMESPACE}",
    "key": "${SEED_KEY}",
    "result_status": "${HARNESS_RESULT_STATUS}",
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
  "latency_ms": {
    "p50": ${P50_LAT_MS},
    "p95": ${P95_LAT_MS},
    "p99": ${P99_LAT_MS}
  },
  "contention_classes": $(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.dumps(json.loads(sys.argv[1])["contention_classes"]))
PY
),
  "consistency": $(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.dumps(json.loads(sys.argv[1])["consistency"]))
PY
),
  "retry_idempotency_drift": $(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.dumps(json.loads(sys.argv[1])["retry_idempotency_drift"]))
PY
),
  "job_pool_metrics": $(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.dumps(json.loads(sys.argv[1])["job_pool_metrics"]))
PY
),
  "contention_correlation": $(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.dumps(json.loads(sys.argv[1])["contention_correlation"]))
PY
),
  "contention_confidence": $(python3 - <<'PY' "$METRICS_JSON"
import json,sys
print(json.dumps(json.loads(sys.argv[1])["contention_confidence"]))
PY
),
  "assertions": {
    "fail_on_applied_zero": ${FAIL_ON_APPLIED_ZERO},
    "fail_on_threshold_breach": ${FAIL_ON_THRESHOLD_BREACH},
    "stale_ratio_fail_threshold": ${STALE_RATIO_FAIL_THRESHOLD},
    "fail_on_unknown_ratio_breach": ${FAIL_ON_UNKNOWN_RATIO_BREACH},
    "unknown_ratio_fail_threshold": ${UNKNOWN_RATIO_FAIL_THRESHOLD},
    "fail_on_p95_latency_breach": ${FAIL_ON_P95_LATENCY_BREACH},
    "p95_latency_fail_threshold_ms": ${P95_LATENCY_FAIL_THRESHOLD_MS},
    "fail_on_consistency_breach": ${FAIL_ON_CONSISTENCY_BREACH},
    "consistency_min_ratio": ${CONSISTENCY_MIN_RATIO},
    "fail_on_idempotency_drift_breach": ${FAIL_ON_IDEMPOTENCY_DRIFT_BREACH},
    "idempotency_drift_max_delta": ${IDEMPOTENCY_DRIFT_MAX_DELTA},
    "applied_zero_breach": ${APPLIED_ZERO_BREACH},
    "threshold_breach": ${THRESHOLD_BREACH},
    "unknown_ratio_breach": ${UNKNOWN_RATIO_BREACH},
    "p95_latency_breach": ${P95_LATENCY_BREACH},
    "consistency_breach": ${CONSISTENCY_BREACH},
    "idempotency_drift_breach": ${IDEMPOTENCY_DRIFT_BREACH},
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
  echo "[harness] strict assertion failed"
  exit 1
fi

echo "[harness] strict assertions passed"