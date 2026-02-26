# CI Quality Gates — RLOOP-014

## Amaç

Kod kalitesini CI üzerinde minimum zorunlu kapılarla güvenceye almak.

## Zorunlu Kapılar

- Install: `yarn install --frozen-lockfile`
- Lint: `yarn lint`
- TypeScript kontrolü: `yarn typecheck` (`tsc --noEmit`)

## Package Manager Politikası

- Standart: Yarn
- Ana lockfile: `yarn.lock`
- CI, `package-lock.json`, `pnpm-lock.yaml`, `bun.lockb` dosyalarını policy ihlali olarak değerlendirir.

## Reliability Gate (RLOOP-037)

Nightly harness workflow içinde ek reliability gate:
- `scripts/eval-reliability-rloop036.py` ile `macro_ece` üretilir
- `scripts/reliability-gate-rloop037.py` warn/fail band uygular
  - Warn: `macro_ece >= reliability_warn_threshold`
  - Fail (job red): `macro_ece >= reliability_fail_threshold`
- Gate detayı artifact olarak yüklenir:
  - `reports/reliability-gate-rloop037.json`
  - `reports/reliability-gate-rloop037.md`

## Reliability Pipeline Extension (RLOOP-038)

Nightly harness workflow reliability adımı genişletildi:
- `scripts/build-groundtruth-artifact-rloop038.py`
  - Ground-truth snapshot artifact üretir (nightly + weekly)
  - Min sample-size guard sonuçlarını artifact içine yazar
- `scripts/validate-groundtruth-artifact-schema-rloop038.py`
  - Artifact contract alanlarını doğrular
- `scripts/route-drift-alerts-rloop038.py`
  - Class-wise ECE trend üstünden moving-average + delta gate uygular
  - Severity'ye göre route belirler (`warn` / `critical`)

Yeni artifact çıktıları:
- `reports/groundtruth-artifacts/<cadence>/<date>/groundtruth-snapshot.json`
- `reports/drift-alert-routing-rloop038.json`
- `reports/drift-alert-routing-rloop038.md`

## Non-prod Canary Lane + Drift Gate Draft (RLOOP-049)

Yeni lane: `.github/workflows/nonprod-db-canary-lane.yml`

- Trigger: manual + nightly
- Non-prod DB fault harness: `scripts/run-db-fault-harness-rloop048.sh`
- Drift gate: `scripts/check-migration-grant-drift-rloop048.py`
  - `--policy warn|fail` desteği
  - JSON/Markdown rapor üretimi

Canary artifact standardı:

- `reports/canary/nonprod/<run_id>/fault-harness.raw.jsonl`
- `reports/canary/nonprod/<run_id>/drift-check.json`
- `reports/canary/nonprod/<run_id>/drift-check.md`
- `reports/canary/nonprod/<run_id>/canary-summary.json`
- `reports/canary/nonprod/<run_id>/canary-summary.md`
- `reports/canary/nonprod/<run_id>/canary-trend.md`
- `reports/canary/history/nonprod-db-canary-history.ndjson`

Required-check hazırlığı için öneri:

1. Başlangıçta `drift_policy=warn`
2. Birkaç sprint trend gözlemi
3. Drift gürültüsü temizlenince `drift_policy=fail`
4. Branch protection required checks'e canary lane ekleme

## PR Gate Notu

PR merge için CI job'unun yeşil olması zorunludur.
