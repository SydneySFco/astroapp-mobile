# RLOOP-056 Notes — Live Publish Job Split + Approval + Check Summary

## Objective

Non-prod canary workflow içinde live publish akışını ayrı, kontrollü bir job’a ayırmak; environment approval entegrasyonunu netleştirmek; live gate + telemetry assertion sonuçlarını check summary yüzeyinde görünür hale getirmek.

## Delivered

### 1) Workflow split (controlled live publish job)

- `.github/workflows/nonprod-db-canary-lane.yml` güncellendi.
- `nonprod-db-canary` job:
  - canary fault/drift kontrollerini ve summary üretimini yapar.
  - `requested_publisher_mode` output’u yayınlar.
  - live istenmiyorsa dry publisher runtime çalıştırır.
- Yeni `nonprod-db-canary-live-publish` job:
  - `needs: [nonprod-db-canary]`
  - explicit guard:
    - `needs.nonprod-db-canary.outputs.requested_publisher_mode == 'live'`
    - `github.event_name == 'workflow_dispatch'`
  - canary artifact bundle’ı indirir ve live runtime’ı ayrı job’da çalıştırır.

### 2) Environment approval integration

- Live publish job’a environment bağlandı:
  - `environment: canary-publisher-live`
- Bu path, repo environment protection (required reviewers) ile manuel approval enforce edecek şekilde tasarlandı.

### 3) Check-run summary integration

- Live job sonunda `live-publish-check-summary.md` üretiliyor.
- Özet içeriği:
  - gate environment bilgisi
  - approval path
  - requested mode
  - telemetry policy
  - live job sonucu
  - telemetry assertion raporunun gömülü özeti
- Aynı içerik `GITHUB_STEP_SUMMARY`’ye yazılıyor; check-run/workflow UI’da doğrudan görünür oluyor.

### 4) Docs updates

- `docs/LIVE_ROLLOUT_GUARDRAILS_RLOOP-054.md`:
  - approval integration draft, yeni split-job pattern ile güncellendi.
- `docs/CANARY_CHECK_PUBLISHER_RLOOP-051.md`:
  - RLOOP-056 check-run summary integration taslağı eklendi.

## Validation

- `yarn lint`
- `yarn typecheck`
