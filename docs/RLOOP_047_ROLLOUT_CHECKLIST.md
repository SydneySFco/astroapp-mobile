# RLOOP-047 Rollout Checklist — RPC Admin Action Safety

Bu checklist, `replay_quarantine_apply_admin_action` RPC hattının production rollout güvenliği için minimum adımları içerir.

## 1) Migration apply

- [ ] `docs/supabase/migrations/20260226153000_rloop046_db_idempotency_atomic_audit.sql` target ortamda apply edildi
- [ ] Function signature beklendiği gibi:
  - [ ] `p_replay_id`
  - [ ] `p_action`
  - [ ] `p_actor_id`
  - [ ] `p_reason`
  - [ ] `p_approval_ref`
  - [ ] `p_request_id`
  - [ ] `p_note`
  - [ ] `p_processed_at`
- [ ] Unique dedupe constraint/index aktif (requestId + replay/action idempotency path)

## 2) Security definer ownership & grants

- [ ] Function owner beklenen privileged role (service role / migration owner)
- [ ] `security definer` function owner drift kontrol edildi (`\df+ public.replay_quarantine_apply_admin_action`)
- [ ] Function search_path hardening doğrulandı (gerekliyse explicit schema qualification)
- [ ] `execute` grant sadece gerekli role’larda açık:
  - [ ] app backend service role
  - [ ] anon/authenticated üzerinde gereksiz execute yok

## 3) Permissions & data access

- [ ] RPC’nin yazdığı tablolar için gerekli izinler owner tarafından mevcut:
  - [ ] `replay_quarantine_messages` update
  - [ ] `replay_quarantine_audit_log` insert/update
- [ ] RLS/permission politikaları RPC execution model ile uyumlu
- [ ] Least privilege prensibiyle gereksiz grants kaldırıldı

## 4) Functional smoke checks (post-deploy)

- [ ] first request -> 202 accepted
- [ ] duplicate request (same requestId) -> 409 idempotent_duplicate
- [ ] stale transition -> 409 stale
- [ ] replay not found -> 404 not_found

## 5) Observability / metrics contract

- [ ] `replay_quarantine_admin_action_total` metric akıyor
- [ ] outcome mapping doğrulandı:
  - [ ] accepted
  - [ ] deduped
  - [ ] stale_conflict
  - [ ] rejected
- [ ] Dashboard/alert threshold etkisi (noise/artış) gözden geçirildi

## 6) Failure handling drills (recommended)

- [ ] audit insert fail simülasyonu -> API `internal_error`, partial write yok
- [ ] state update fail simülasyonu -> API `internal_error`, partial write yok
- [ ] rollback doğrulaması: state+audit atomik boundary korunuyor

## 7) Rollback plan

- [ ] Geri dönüş migration/feature flag stratejisi hazır
- [ ] On-call runbook notu güncel
- [ ] Incident owner ve communication path net

## Sign-off

- [ ] Backend owner
- [ ] DBA / Supabase owner
- [ ] SRE / Observability owner
