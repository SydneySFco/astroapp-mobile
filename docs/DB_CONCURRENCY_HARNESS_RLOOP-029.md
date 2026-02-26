# DB-backed Concurrency Harness (RLOOP-029 → RLOOP-030 update)

## Purpose
`finalize_reconcile_job` concurrency davranışını gerçek RPC outcome’larına bağlamak ve nightly CI’ı assertion-fail odaklı çalıştırmak.

Hedef metrikler:
- outcome dağılımı: `applied:idempotent:stale_blocked:unknown`
- stale conflict ratio
- run-to-run trend notu (önceki run ile karşılaştırma)

---

## RLOOP-030 Delta

### 1) Harness wiring (RPC adapter contract)
Script: `scripts/concurrency-harness-rloop029.sh`

Adapter modları:
- `HARNESS_MODE=rpc_http`: Supabase REST RPC endpoint’i üzerinden gerçek çağrı
- `HARNESS_MODE=command`: external adapter command (JSON outcome contract)
- `HARNESS_MODE=dry`: deterministic dry fallback
- `HARNESS_MODE=auto` (default): env’e göre otomatik seçim

Command adapter contract:
- `FINALIZE_RPC_ADAPTER_CMD` çıktısı JSON olmalı
- Beklenen alan: `outcome` (`applied|idempotent|stale_blocked`)

Not:
- Gerçek seed/schema lifecycle hâlen ayrı migration/fixture katmanına ihtiyaç duyar.
- Bu iterasyonda outcome sayımı artık mümkün olduğunda gerçek RPC response’una bağlıdır.

### 2) Strict CI assertions
Aşağıdaki breach durumlarında job fail edilir:
- `applied_count == 0 && total_attempts > 0` (`FAIL_ON_APPLIED_ZERO=1`)
- `stale_conflict_ratio >= STALE_RATIO_FAIL_THRESHOLD` (`FAIL_ON_THRESHOLD_BREACH=1`)

Varsayılan fail threshold:
- `STALE_RATIO_FAIL_THRESHOLD=0.3000`

### 3) Artifact + trend standard
Standart JSON raporu:
```json
{
  "schema": "harness_20260226_133700_ab12",
  "timestamp_utc": "2026-02-26T13:37:00Z",
  "mode": "rpc_http",
  "workers": 20,
  "iterations": 5,
  "total_attempts": 100,
  "outcomes": {
    "applied": 5,
    "idempotent": 60,
    "stale_blocked": 35,
    "unknown": 0
  },
  "ratios": {
    "stale_conflict_ratio": 0.35,
    "unknown_ratio": 0
  },
  "assertions": {
    "fail_on_applied_zero": 1,
    "fail_on_threshold_breach": 1,
    "stale_ratio_fail_threshold": 0.30,
    "applied_zero_breach": 0,
    "threshold_breach": 1,
    "job_status": "fail"
  },
  "trend": {
    "previous_stale_conflict_ratio": 0.21,
    "note": "compared_to_previous_run"
  }
}
```

Historical karşılaştırma:
- Script, `reports/concurrency-harness-history.ndjson` dosyasına her run raporunu append eder.
- `trend.previous_stale_conflict_ratio` alanı son run’dan okunur.

### 4) Notifications draft
Workflow’de opsiyonel webhook adımı eklendi:
- secret: `CONCURRENCY_HARNESS_WEBHOOK_URL`
- varsa kısa status payload gönderilir (Slack incoming webhook dahil uyumlu)

---

## CI Integration
Workflow: `.github/workflows/nightly-concurrency-harness.yml`

Akış:
1. install
2. harness run (strict assertions)
3. artifact upload (`*.json` + `history.ndjson`)
4. optional webhook notify

Secrets/vars:
- Required (rpc_http): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional notify: `CONCURRENCY_HARNESS_WEBHOOK_URL`

---

## Remaining follow-up (RLOOP-031 adayı)
- Ephemeral schema create/seed/drop adımlarını gerçek DB fixture katmanıyla tamamlamak
- Job seed + lease ownership setup’ını harness içine almak
- Trend baseline’ı repo artifact’ından kalıcı storage’a taşımak (S3/TSDB)