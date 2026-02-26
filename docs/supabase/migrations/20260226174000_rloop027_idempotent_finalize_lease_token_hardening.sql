-- RLOOP-027
-- Idempotent finalize + optimistic lease token/revision hardening.

create extension if not exists pgcrypto;

alter table public.reconcile_jobs
  add column if not exists lease_token uuid,
  add column if not exists lease_revision bigint not null default 0,
  add column if not exists finalized_lease_token uuid,
  add column if not exists finalized_lease_revision bigint,
  add column if not exists finalized_result_status text;

create index if not exists idx_reconcile_jobs_lease_revision
  on public.reconcile_jobs (id, lease_revision);

create or replace function public.claim_reconcile_job(lease_duration_ms integer)
returns public.reconcile_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_lease_until timestamptz;
  v_job public.reconcile_jobs;
begin
  if lease_duration_ms is null or lease_duration_ms <= 0 then
    raise exception 'lease_duration_ms must be > 0';
  end if;

  v_lease_until := v_now + (lease_duration_ms::text || ' milliseconds')::interval;

  with candidate as (
    select rj.id
    from public.reconcile_jobs rj
    where rj.status in ('queued', 'running')
      and (rj.retry_after is null or rj.retry_after <= v_now)
      and (rj.leased_until is null or rj.leased_until <= v_now)
    order by rj.retry_after asc nulls first, rj.created_at asc
    for update skip locked
    limit 1
  )
  update public.reconcile_jobs target
  set
    status = 'running',
    lease_revision = target.lease_revision + 1,
    lease_token = gen_random_uuid(),
    leased_until = v_lease_until,
    finished_at = null,
    updated_at = v_now
  from candidate
  where target.id = candidate.id
  returning target.* into v_job;

  return v_job;
end;
$$;

create or replace function public.finalize_reconcile_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_revision bigint,
  p_result_status text,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_after timestamptz default null,
  p_finished_at timestamptz default null
)
returns public.reconcile_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_current public.reconcile_jobs;
  v_result public.reconcile_jobs;
begin
  if p_result_status not in ('succeeded', 'queued', 'dead_lettered') then
    raise exception 'invalid p_result_status: %', p_result_status;
  end if;

  select *
  into v_current
  from public.reconcile_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'reconcile job not found: %', p_job_id;
  end if;

  -- Primary optimistic ownership check.
  if v_current.status = 'running'
    and v_current.lease_token = p_lease_token
    and v_current.lease_revision = p_lease_revision then

    update public.reconcile_jobs
    set
      status = p_result_status,
      leased_until = null,
      lease_token = null,
      retry_after = case when p_result_status = 'queued' then p_retry_after else null end,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      finished_at = case
        when p_result_status in ('succeeded', 'dead_lettered') then coalesce(p_finished_at, v_now)
        else null
      end,
      finalized_lease_token = p_lease_token,
      finalized_lease_revision = p_lease_revision,
      finalized_result_status = p_result_status,
      updated_at = v_now
    where id = p_job_id
    returning * into v_result;

    return v_result;
  end if;

  -- Idempotent replay: exact same finalize request already applied.
  if v_current.finalized_lease_token = p_lease_token
    and v_current.finalized_lease_revision = p_lease_revision
    and v_current.finalized_result_status = p_result_status then
    return v_current;
  end if;

  raise exception 'stale finalize attempt blocked (job_id=%, lease_revision=%)', p_job_id, p_lease_revision;
end;
$$;

drop view if exists public.reconcile_job_ops_view;
create view public.reconcile_job_ops_view as
select
  rj.id,
  rj.report_id,
  rj.status,
  rj.attempt_count,
  rj.max_attempts,
  rj.leased_until,
  rj.lease_token,
  rj.lease_revision,
  rj.retry_after,
  rj.last_error_code,
  rj.last_error_message,
  (
    select count(*)
    from public.reconcile_jobs q
    where q.status in ('queued', 'running')
  )::bigint as queue_depth,
  case
    when rj.retry_after is null then null
    else extract(epoch from (timezone('utc', now()) - rj.retry_after))::bigint
  end as retry_age_seconds,
  rj.created_at,
  rj.updated_at
from public.reconcile_jobs rj;
