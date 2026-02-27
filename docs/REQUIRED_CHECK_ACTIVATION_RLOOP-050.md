# Required Check Activation Plan — RLOOP-050

## Scope

Canary lane (`nonprod-db-canary`) ve live publish gate için required-check activation/migration planı.

## Check Surface Contract

### Canonical Check Names (stable)

- `nonprod-db-canary / drift` *(publisher check-run adı)*
- `CI Quality Gates / required-check / ci-quality-gates` *(branch protection required)*
- `Non-prod DB Canary Lane / required-check / nonprod-live-publish-gate` *(conditional gate; default required değil)*

Bu isimler branch protection referanslarında immutable kabul edilir.

### Status Mapping

| Drift Result | Policy | Check Conclusion | Merge Blocking |
|---|---|---|---|
| no_drift | warn/fail | success | no |
| drift_detected | warn | neutral (veya success + warning summary) | no |
| drift_detected | fail | failure | yes |
| infra_error | warn/fail | failure | yes |

> Not: `infra_error` her zaman fail edilir; sinyal güvenilirliği bozulmuştur.

## Progressive Activation (Warn -> Fail)

### Phase 0 — Observe

- Policy: `warn`
- Branch protection: required değil
- Hedef: false-positive analizi, drift noise kaynaklarını kapatma

### Phase 1 — Soft Gate

- Policy: `warn`
- Branch protection: check görünür ama required yapılmaz
- PR surface: comment + check-run summary zorunlu
- Hedef: ekip adaptasyonu, yorum formatı stabilizasyonu

### Phase 2 — Enforced Gate

- Policy: `fail`
- Branch protection: `nonprod-db-canary / drift` required
- Merge bloklama aktif

## Entry Criteria (Phase 2)

- Son N canary run içinde infra_error oranı kabul eşiğinin altında
- Drift false-positive backlog'u kapalı
- Check name / output format freeze edilmiş
- On-call/owner runbook güncel

## Branch Protection Plan

1. `master` için required status checks listesinde en az:
   - `CI Quality Gates / required-check / ci-quality-gates`
2. `Require branches to be up to date` açık tutulur.
3. Drift gate enforcement gününde `CANARY_DRIFT_POLICY=fail` yapılır.
4. İlk hafta rollback switch hazır tutulur (`warn`).

### Migration for Renamed Contexts (RLOOP-057)

1. Geçici olarak hem eski hem yeni context'i ekle
2. 1-2 başarılı PR sonrasında eski context'i kaldır
3. Final list'i `docs/BRANCH_PROTECTION_SETUP.md` ile eşitle

## Rollback Strategy

- Operasyonel sorun oluşursa:
  1. Drift policy `warn`a döndür
  2. Required check temporary disable veya bypass window uygula
  3. Incident sonrası tekrar Phase 1'e dön

## RLOOP-051+ Wiring Notes

- Check payload builder: `src/features/reliability/canaryCheckPublisher.ts`
- Sticky comment strategy: marker tabanlı single-comment upsert
- Runtime config resolver: `src/features/reliability/canaryCheckPublisherConfig.ts`
- Reusable live publish workflow (RLOOP-057):
  - `.github/workflows/nonprod-db-canary-live-publish-reusable.yml`

Runtime env knobs:

- `CANARY_DRIFT_POLICY=warn|fail`
- `CANARY_CHECK_NAME` (default: `nonprod-db-canary / drift`)
- `CANARY_STICKY_COMMENT_ENABLED=true|false`
