-- RLOOP-026
-- 1) Race-safe atomic claim RPC for reconcile worker queue.
-- 2) Replay audit metadata guardrails.

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
    leased_until = v_lease_until,
    updated_at = v_now
  from candidate
  where target.id = candidate.id
  returning target.* into v_job;

  return v_job;
end;
$$;

create or replace function public.reconcile_audit_log_replay_requirements_guard()
returns trigger
language plpgsql
as $$
begin
  if new.action = 'admin_replay_requested' then
    if new.actor_id is null then
      raise exception 'actor_id is required for admin_replay_requested';
    end if;

    if not (new.payload ? 'reason') or coalesce(nullif(trim(new.payload->>'reason'), ''), '') = '' then
      raise exception 'payload.reason is required for admin_replay_requested';
    end if;

    if not (new.payload ? 'approvalRef') or coalesce(nullif(trim(new.payload->>'approvalRef'), ''), '') = '' then
      raise exception 'payload.approvalRef is required for admin_replay_requested';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reconcile_audit_log_replay_requirements on public.reconcile_audit_log;
create trigger trg_reconcile_audit_log_replay_requirements
before insert on public.reconcile_audit_log
for each row execute function public.reconcile_audit_log_replay_requirements_guard();
