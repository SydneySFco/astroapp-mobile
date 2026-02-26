# RLOOP-057 — Reusable Live Publish Workflow + Check Name Hardening

## Objective

Live publish path'ini reusable workflow seviyesine taşımak ve required-check isimlerini branch protection ile stabil/uyumlu hale getirmek.

## Changes

1. Live publish job reusable workflow'a ayrıldı:
   - Yeni reusable: `.github/workflows/nonprod-db-canary-live-publish-reusable.yml`
   - Parent invoke: `.github/workflows/nonprod-db-canary-lane.yml`
2. Required-check naming hardening:
   - `CI Quality Gates` job adı: `required-check / ci-quality-gates`
   - Live publish gate job adı: `required-check / nonprod-live-publish-gate`
3. Policy dokümantasyonu eklendi:
   - `docs/REQUIRED_CHECK_NAMING_POLICY.md`
4. Branch protection ve activation runbook'ları migration adımları ile güncellendi.

## Validation

- `yarn lint`
- `yarn typecheck`

## Risk / Compatibility Notes

- Required-check context adları değiştiği için branch protection listesi migration adımı uygulanmadan merge blokları oluşabilir.
- Live gate check'i conditional olduğu için required yapılması tavsiye edilmez (yalnızca live publish path'inde görünür).

## Suggested Next Iteration (RLOOP-058)

- Required-check context doğrulamasını API ile otomatik eden script + CI assertion eklenmesi (`scripts/verify-required-check-contexts-rloop058.js`).
