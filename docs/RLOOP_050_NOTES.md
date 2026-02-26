# RLOOP-050 Notes — Canary Promotion + Required-Check Activation

## Objective

Canary lane çıktısını PR check surface'e bağlamak, required-check aktivasyonunu aşamalı bir planla tanımlamak ve cross-run history saklama stratejisini netleştirmek.

## Delivered

1. PR check surface integration draft
   - Canary summary/check formatı
   - PR comment/check-run önerileri
   - `warn` / `fail` statü map'i
2. Required-check activation plan
   - Drift policy kademeli geçiş (`warn -> fail`)
   - Branch protection required check adımları
3. History persistence strategy
   - Artifact store abstraction
   - Run-level ve cross-run retention modeli

## Key Decisions

- İlk fazda canary lane sinyal üretir ama merge'i bloklamaz (`warn`).
- Check-run naming sabitlenir: `nonprod-db-canary / drift`.
- `warn` durumunda check-run `neutral`/`success-with-warnings` semantiği; `fail` durumunda `failure`.
- Required-check aktivasyonu sadece false-positive temizliği + minimum stabilite eşiği sonrası yapılır.

## Validation

- `yarn lint`
- `yarn typecheck`

## Follow-up Candidate (RLOOP-051)

- Canary check-run producer implementation:
  - GitHub Check API entegrasyonu
  - PR comment upsert (single sticky comment)
  - Artifact history reader/writer adapter implementation
