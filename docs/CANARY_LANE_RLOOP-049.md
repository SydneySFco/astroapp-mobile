# Non-prod DB Canary Lane — RLOOP-049 (+RLOOP-050 update)

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

## PR Check Surface Integration Draft (RLOOP-050)

### Check-run

- Name (stable): `nonprod-db-canary / drift`
- Summary body:
  - policy (`warn`/`fail`)
  - drift result (`no_drift`/`drift_detected`)
  - migration delta kısa özeti
  - artifact links
- Detail body:
  - drift-check.md özeti
  - failure nedeni (infra vs policy)
  - recommended next step

### PR Comment (sticky/upsert)

Tek bir "Canary Drift Report" yorumunun sürekli güncellenmesi:

- Run id / timestamp
- Policy
- Drift sonucu
- Warn/fail sebebi
- Artifact path linkleri
- Trend snippet (last N runs)

### Status Mapping

- `no_drift` -> `success`
- `drift_detected` + `warn` -> `neutral` (veya warning semantics ile success)
- `drift_detected` + `fail` -> `failure`
- `infra_error` -> `failure`

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

## History Persistence Strategy (RLOOP-050)

Artifact store abstraction:

- `ArtifactStore.writeRunArtifacts(runId, files)`
- `ArtifactStore.appendHistory(streamKey, line)`
- `ArtifactStore.readHistory(streamKey, limit)`

Backend seçenekleri:

1. GitHub artifact + repo history file (başlangıç)
2. Object storage (S3/GCS) adapter (ölçek)

Retention:

- Run artifacts: kısa/orta süre (örn. 14-30 gün)
- NDJSON history: uzun süreli trend analizi için korunur

## Promotion Plan (Draft)

1. Canary lane'i bir süre `warn` policy ile izleme
2. Drift false-positive kaynaklarını temizleme
3. PR check surface formatını freeze etme
4. Branch protection içinde canary check'i required check'e alma
5. Default policy'yi `fail`a çekme
