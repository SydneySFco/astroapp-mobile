-- RLOOP-024
-- Admin ops read model for reconcile queue observability.

create or replace view public.reconcile_job_ops_view as
select
  rj.id as job_id,
  rj.report_id,
  rj.status,
  rj.attempt_count,
  rj.max_attempts,
  case
    when rj.status in ('queued', 'running', 'failed', 'dead_lettered') then rj.status
    else 'other'
  end as queue_depth_bucket,
  rj.retry_after,
  case
    when rj.retry_after is null then null
    else extract(epoch from (timezone('utc', now()) - rj.retry_after))::bigint
  end as retry_age_seconds,
  rj.leased_until,
  case
    when rj.leased_until is null then null
    else extract(epoch from (rj.leased_until - timezone('utc', now())))::bigint
  end as lease_expiry_seconds,
  rj.last_error_code,
  case
    when rj.last_error_code is null and rj.last_error_message is null then null
    when rj.last_error_code is null then rj.last_error_message
    when rj.last_error_message is null then rj.last_error_code
    else rj.last_error_code || ': ' || rj.last_error_message
  end as failure_reason,
  rj.created_at,
  rj.updated_at,
  rj.finished_at
from public.reconcile_jobs rj;

create or replace view public.reconcile_queue_depth_view as
select
  status,
  count(*)::bigint as job_count,
  count(*) filter (
    where status = 'queued'
      and (retry_after is null or retry_after <= timezone('utc', now()))
  )::bigint as claimable_count,
  count(*) filter (
    where status = 'running'
      and leased_until is not null
      and leased_until <= timezone('utc', now())
  )::bigint as expired_lease_count
from public.reconcile_jobs
group by status;

-- Optional: MV for heavier admin dashboard queries.
create materialized view if not exists public.reconcile_job_ops_mv as
select *
from public.reconcile_job_ops_view
with no data;

create unique index if not exists idx_reconcile_job_ops_mv_job_id
  on public.reconcile_job_ops_mv (job_id);

-- refresh materialized view public.reconcile_job_ops_mv;
