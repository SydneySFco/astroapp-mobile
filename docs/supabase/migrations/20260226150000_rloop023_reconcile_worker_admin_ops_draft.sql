-- RLOOP-023 DRAFT
-- Reconcile worker queue + admin ops surface + audit immutability
-- Review before production use.

create extension if not exists pgcrypto;

-- 1) Reconcile Jobs Queue
create table if not exists public.reconcile_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'dead_lettered')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  leased_until timestamptz,
  retry_after timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists idx_reconcile_jobs_claimable
  on public.reconcile_jobs (status, retry_after, leased_until)
  where status in ('queued', 'running');

-- 2) Admin Request/Approval
create table if not exists public.admin_reconcile_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  requested_by uuid not null,
  reason text not null,
  requested_state text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_reconcile_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.admin_reconcile_requests(id) on delete cascade,
  decided_by uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  decision_note text,
  decided_at timestamptz not null default timezone('utc', now())
);

-- 3) Timeline + Immutable Audit
create table if not exists public.reconcile_job_timeline (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.reconcile_jobs(id) on delete cascade,
  event_type text not null,
  event_actor text not null check (event_actor in ('system', 'worker', 'admin')),
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reconcile_audit_log (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  action text not null,
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Immutability: deny UPDATE/DELETE for audit log.
create or replace function public.reconcile_audit_log_immutable_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'reconcile_audit_log is immutable (% not allowed)', tg_op;
end;
$$;

drop trigger if exists trg_reconcile_audit_log_no_update on public.reconcile_audit_log;
create trigger trg_reconcile_audit_log_no_update
before update on public.reconcile_audit_log
for each row execute function public.reconcile_audit_log_immutable_guard();

drop trigger if exists trg_reconcile_audit_log_no_delete on public.reconcile_audit_log;
create trigger trg_reconcile_audit_log_no_delete
before delete on public.reconcile_audit_log
for each row execute function public.reconcile_audit_log_immutable_guard();

-- Optional hardening: revoke write mutation privileges after bootstrap.
-- revoke update, delete on table public.reconcile_audit_log from authenticated, anon;
