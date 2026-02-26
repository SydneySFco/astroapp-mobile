# DB-backed Concurrency Harness (RLOOP-029 → RLOOP-031 update)

## Purpose
`finalize_reconcile_job` concurrency davranışını gerçek RPC outcome’larına bağlamak ve nightly CI’ı assertion-fail odaklı çalıştırmak.

Hedef metrikler:
- outcome dağılımı: `applied:idempotent:stale_blocked:unknown`
- stale conflict ratio
- unknown fallback ratio
- run-to-run trend notu (önceki run ile karşılaştırma)

---

## RLOOP-031 Delta

### 1) Ephemeral schema + deterministic seed/teardown
Script: `scripts/concurrency-harness-rloop029.sh`

Yeni/özel akış:
- safe schema naming (`SCHEMA_SAFE`)
- `HARNESS_USE_EPHEMERAL_SCHEMA=1` ise run başında create schema
- deterministic seed key üretimi (`HARNESS_SEED_NAMESPACE`, workload, timestamp)
- deterministic fixture auto wiring:
  - `HARNESS_JOB_ID`
  - `HARNESS_LEASE_TOKEN`
  - `HARNESS_LEASE_REVISION`
- `SUPABASE_DB_URL` varsa `public.reconcile_jobs` deterministic upsert
- `trap EXIT` ile drop schema garantisi (best-effort + warning)

### 2) Production-like race input wiring
- `HARNESS_AUTO_FIXTURE_INPUTS=1` default
- fixture alanları env verilmezse otomatik deterministic üretilir
- RPC payload bu fixture’lardan beslenir

### 3) Unknown fallback reduction + assertions
- outcome extractor, error payload’ındaki stale/conflict ipuçlarını `stale_blocked`a sınıflandırır
- yeni guard:
  - `FAIL_ON_UNKNOWN_RATIO_BREACH=1`
  - `UNKNOWN_RATIO_FAIL_THRESHOLD=0.0500`

Breach durumlarında job fail edilir:
- `applied_count == 0 && total_attempts > 0`
- `stale_conflict_ratio >= STALE_RATIO_FAIL_THRESHOLD`
- `unknown_ratio >= UNKNOWN_RATIO_FAIL_THRESHOLD`

### 4) JSON report metadata
Standart rapora eklendi:
- `seed.*` (namespace/key/job/lease/revision/seed_sql_applied)
- `schema_lifecycle.*` (ephemeral enabled/create/drop durumu)

Historical karşılaştırma:
- Script, `reports/concurrency-harness-history.ndjson` dosyasına her run raporunu append eder.
- `trend.previous_stale_conflict_ratio` alanı son run’dan okunur.

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
- Optional seed/schema lifecycle: `SUPABASE_DB_URL`
- Optional notify: `CONCURRENCY_HARNESS_WEBHOOK_URL`

---

## Remaining follow-up (RLOOP-032 adayı)
- Gerçek paralel finalize yarışı (background process/fan-out) ve p95 latency/sequence telemetry
- Ephemeral schema isolation’ı function/search_path seviyesinde gerçek DB sandbox’a genişletmek