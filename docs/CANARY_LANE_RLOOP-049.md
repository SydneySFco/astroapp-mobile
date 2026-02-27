# Non-prod DB Canary Lane — RLOOP-049

## Objective

Fault-injection harness ve migration/grant drift kontrollerini non-prod DB erişimli bir canary lane altında sürekli koşturmak ve required-check modeline geçiş için sinyal üretmek.

## Workflow

- File: `.github/workflows/nonprod-db-canary-lane.yml`
- Triggers:
  - `workflow_dispatch` (manual)
  - `schedule` (nightly)
- Job: `nonprod-db-canary`

## Secret Requirements

### Required

- `SUPABASE_NONPROD_DB_URL`
  - Non-prod Postgres connection string
  - Harness bu bağlantı ile ephemeral schema testlerini koşturur

### Optional

- `EXPECTED_MIGRATION_VERSION`
  - Drift check için beklenen migration version override

## Drift Policy Model

- `warn`:
  - Drift bulunursa `status=warn`
  - Lane devam eder (hazırlık/observe modu)
- `fail`:
  - Drift bulunursa job fail olur
  - Required-check için hedef davranış

## Artifact Standard

Per run (`reports/canary/nonprod/<run_id>/`):

- `fault-harness.raw.jsonl`
- `drift-check.json`
- `drift-check.md`
- `canary-summary.json`
- `canary-summary.md`
- `canary-trend.md`

Cross-run history:

- `reports/canary/history/nonprod-db-canary-history.ndjson`

## Promotion Plan (Draft)

1. Canary lane'i bir süre `warn` policy ile izleme
2. Drift false-positive kaynaklarını temizleme
3. Branch protection içinde canary job'ı required check'e alma
4. Default policy'yi `fail`a çekme
