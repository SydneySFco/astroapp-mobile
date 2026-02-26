# RLOOP-046 Notes — DB-first Idempotency + Transactional Audit Atomicity

## Summary

RLOOP-046 kapsamında quarantine admin replay/drop akışı DB-first idempotency ve transactional atomicity ekseninde sertleştirildi.

## Implemented

1. **DB-first idempotency draft**
   - Supabase adapter read-first dedupe yaklaşımından çıkarıldı.
   - `replay_quarantine_apply_admin_action` RPC (PL/pgSQL) üzerinden
     `insert ... on conflict do nothing returning` idempotency gate taslağı devreye alındı.
   - `requestId` varsa dedupe DB katmanında ilk write olarak uygulanıyor.

2. **Transactional atomicity (state + audit)**
   - State transition (`pending_review -> redriven|dropped`) ve audit insert/update adımları
     tek function/transaction boundary içinde toplandı.
   - `status_changed` audit event her başarıda aynı boundary içinde yazılıyor.

3. **Error mapping hardening (SQLSTATE -> API)**
   - `P0002` -> `404 not_found`
   - `P0001` -> `409 stale`
   - `23505` -> `409 idempotent_duplicate`
   - diğer DB hataları -> `500 internal_error`

4. **Runtime metrics standardization**
   - `replay_quarantine_admin_action_total` emit logic repository içinde tek entry-point
     (`emitAdminActionMetric`) altına alındı.
   - Success ve error patikaları aynı yerden `accepted|deduped|stale_conflict|rejected` outcome üretir.

## Migration Draft

- `docs/supabase/migrations/20260226153000_rloop046_db_idempotency_atomic_audit.sql`
  - RPC function: `public.replay_quarantine_apply_admin_action(...)`
  - DB-first dedupe gate + transactional transition/audit flow

## Notes / Caveats

- SQL function, RLOOP-044’teki unique index taslağına dayanır.
- Function `security definer` olarak işaretlendi; production rollout’ta owner ve grant politikası ayrıca gözden geçirilmeli.
