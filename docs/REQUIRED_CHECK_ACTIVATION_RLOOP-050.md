# Required Check Activation Plan — RLOOP-050

## Scope

Canary lane (`nonprod-db-canary`) için required-check'e geçiş planı ve drift policy transition çerçevesi.

## Check Surface Contract

### Check Name (stable)

- `nonprod-db-canary / drift`

Bu isim branch protection'da required check olarak referanslanacağı için immutable kabul edilir.

### Status Mapping

| Drift Result | Policy | Check Conclusion | Merge Blocking |
|---|---|---|---|
| no_drift | warn/fail | success | no |
| drift_detected | warn | neutral (veya success + warning summary) | no |
| drift_detected | fail | failure | yes |
| infra_error | warn/fail | failure | yes |

> Not: `infra_error` her zaman fail edilir; çünkü sinyal güvenilirliği bozulmuştur.

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

1. GitHub branch protection'da `master` için required status checks listesine:
   - `nonprod-db-canary / drift`
2. `Require branches to be up to date` açık tutulur.
3. Geçiş gününde policy `fail` yapılır.
4. İlk hafta rollback switch hazır tutulur:
   - Policy geçici olarak `warn`a alınabilir.

## Rollback Strategy

- Operasyonel sorun oluşursa:
  1. Drift policy `warn`a döndür
  2. Required check temporary disable veya bypass window uygula
  3. Incident sonrası tekrar Phase 1'e dön
