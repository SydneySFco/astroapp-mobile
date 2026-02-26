-- RLOOP-044 (Draft)
-- Idempotency + observability hardening for quarantine admin actions.

-- 1) Optional uniqueness helper for request-level dedup
--    (same replay_id + action + request_id should be unique when request_id exists).
create unique index if not exists uq_replay_quarantine_audit_replay_action_request
  on public.replay_quarantine_audit_log (replay_id, action, request_id)
  where request_id is not null
    and action in ('manual_redrive_requested', 'force_drop_requested');

-- 2) Read-path acceleration for dedup checks.
create index if not exists idx_replay_quarantine_audit_lookup
  on public.replay_quarantine_audit_log (replay_id, action, request_id, created_at desc)
  where action in ('manual_redrive_requested', 'force_drop_requested');

-- 3) Optional reason/status exploration index for dashboards.
create index if not exists idx_replay_quarantine_messages_reason_status
  on public.replay_quarantine_messages (quarantine_reason, status, quarantined_at desc);
