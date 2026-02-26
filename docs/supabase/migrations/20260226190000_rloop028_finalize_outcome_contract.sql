-- RLOOP-028
-- Standardize finalize outcome contract: applied | idempotent | stale_blocked.

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
returns table(outcome text, job public.reconcile_jobs)
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

    return query select 'applied'::text, v_result;
    return;
  end if;

  -- Idempotent replay: exact same finalize request already applied.
  if v_current.finalized_lease_token = p_lease_token
    and v_current.finalized_lease_revision = p_lease_revision
    and v_current.finalized_result_status = p_result_status then
    return query select 'idempotent'::text, v_current;
    return;
  end if;

  -- No exception for stale conflicts; return explicit stale_blocked outcome.
  return query select 'stale_blocked'::text, v_current;
end;
$$;
