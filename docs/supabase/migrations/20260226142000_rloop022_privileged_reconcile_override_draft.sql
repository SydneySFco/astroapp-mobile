-- RLOOP-022
-- Privileged override policy compatible reconcile path
-- Strategy: do not violate lifecycle guard; enqueue out-of-band reconcile job.

begin;

create table if not exists public.user_report_reconcile_jobs (
  id bigserial primary key,
  user_report_id uuid not null references public.user_reports(id) on delete cascade,
  request_id uuid not null default gen_random_uuid(),
  reason text,
  incident_ref text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0,
  requested_by text not null default coalesce(auth.role(), 'unknown'),
  approved_by text,
  approved_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_report_reconcile_jobs is
  'Out-of-band reconcile jobs for stuck processing reports; does not modify lifecycle backwards.';

create unique index if not exists ux_user_report_reconcile_jobs_open
  on public.user_report_reconcile_jobs (user_report_id)
  where status in ('queued', 'running');

create index if not exists idx_user_report_reconcile_jobs_created_at
  on public.user_report_reconcile_jobs (created_at desc);

alter table public.user_reports_reconciliation_audit
  add column if not exists request_id uuid,
  add column if not exists reconcile_job_id bigint,
  add column if not exists incident_ref text,
  add column if not exists actor_role text,
  add column if not exists metadata_json jsonb;

create or replace function public.enqueue_stuck_report_reconcile(
  p_user_report_id uuid,
  p_reason text default null,
  p_incident_ref text default null,
  p_approval_ref text default null,
  p_max_age_minutes integer default 30
)
returns table (
  success boolean,
  action text,
  message text,
  request_id uuid,
  reconcile_job_id bigint,
  old_status text,
  new_status text,
  old_version integer,
  new_version integer,
  audited_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_reports%rowtype;
  v_job public.user_report_reconcile_jobs%rowtype;
  v_threshold timestamptz := timezone('utc', now()) - make_interval(mins => greatest(p_max_age_minutes, 1));
  v_now timestamptz := timezone('utc', now());
  v_request_id uuid := gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'enqueue_stuck_report_reconcile is service_role only'
      using errcode = '42501';
  end if;

  if p_approval_ref is null or length(trim(p_approval_ref)) = 0 then
    raise exception 'approval reference is required for privileged reconcile'
      using errcode = '42501';
  end if;

  select * into v_row
  from public.user_reports
  where id = p_user_report_id
  for update;

  if not found then
    insert into public.user_reports_reconciliation_audit (
      user_report_id, request_id, reason, incident_ref, attempted_action,
      success, error_code, error_message, actor_role, metadata_json
    ) values (
      p_user_report_id, v_request_id, p_reason, p_incident_ref, 'enqueue_stuck_report_reconcile',
      false, 'NOT_FOUND', 'user_report not found', 'executor', jsonb_build_object('approval_ref', p_approval_ref)
    );

    return query
    select false, 'noop', 'user_report not found', v_request_id, null::bigint, null::text, null::text, null::integer, null::integer, v_now;
    return;
  end if;

  if v_row.status is distinct from 'processing' then
    insert into public.user_reports_reconciliation_audit (
      user_report_id, request_id, reason, incident_ref, attempted_action,
      old_status, new_status, old_version, new_version,
      success, error_code, error_message, actor_role, metadata_json
    ) values (
      p_user_report_id, v_request_id, p_reason, p_incident_ref, 'enqueue_stuck_report_reconcile',
      v_row.status, v_row.status, v_row.version, v_row.version,
      false, 'INVALID_STATE', format('expected processing, got %s', v_row.status), 'executor',
      jsonb_build_object('approval_ref', p_approval_ref)
    );

    return query
    select false, 'noop', format('invalid state: %s', v_row.status), v_request_id, null::bigint, v_row.status, v_row.status, v_row.version, v_row.version, v_now;
    return;
  end if;

  if v_row.updated_at >= v_threshold then
    insert into public.user_reports_reconciliation_audit (
      user_report_id, request_id, reason, incident_ref, attempted_action,
      old_status, new_status, old_version, new_version,
      success, error_code, error_message, actor_role, metadata_json
    ) values (
      p_user_report_id, v_request_id, p_reason, p_incident_ref, 'enqueue_stuck_report_reconcile',
      v_row.status, v_row.status, v_row.version, v_row.version,
      false, 'NOT_STUCK', 'record is not older than threshold', 'executor',
      jsonb_build_object('approval_ref', p_approval_ref)
    );

    return query
    select false, 'noop', 'record not stuck yet', v_request_id, null::bigint, v_row.status, v_row.status, v_row.version, v_row.version, v_now;
    return;
  end if;

  insert into public.user_report_reconcile_jobs (
    user_report_id,
    request_id,
    reason,
    incident_ref,
    requested_by,
    approved_by,
    approved_at,
    metadata_json
  ) values (
    p_user_report_id,
    v_request_id,
    p_reason,
    p_incident_ref,
    coalesce(auth.role(), 'unknown'),
    p_approval_ref,
    v_now,
    jsonb_build_object('approval_ref', p_approval_ref)
  )
  on conflict on constraint ux_user_report_reconcile_jobs_open do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job
    from public.user_report_reconcile_jobs
    where user_report_id = p_user_report_id
      and status in ('queued', 'running')
    order by id desc
    limit 1;

    insert into public.user_reports_reconciliation_audit (
      user_report_id, request_id, reconcile_job_id, reason, incident_ref, attempted_action,
      old_status, new_status, old_version, new_version,
      success, error_code, error_message, actor_role, metadata_json
    ) values (
      p_user_report_id, v_request_id, v_job.id, p_reason, p_incident_ref, 'enqueue_stuck_report_reconcile',
      v_row.status, v_row.status, v_row.version, v_row.version,
      false, 'DUPLICATE_OPEN_JOB', 'open reconcile job already exists', 'executor',
      jsonb_build_object('approval_ref', p_approval_ref)
    );

    return query
    select false, 'noop', 'open reconcile job already exists', v_request_id, v_job.id, v_row.status, v_row.status, v_row.version, v_row.version, v_now;
    return;
  end if;

  insert into public.user_reports_reconciliation_audit (
    user_report_id, request_id, reconcile_job_id, reason, incident_ref, attempted_action,
    old_status, new_status, old_version, new_version,
    success, actor_role, metadata_json
  ) values (
    p_user_report_id, v_request_id, v_job.id, p_reason, p_incident_ref, 'enqueue_stuck_report_reconcile',
    v_row.status, v_row.status, v_row.version, v_row.version,
    true, 'executor', jsonb_build_object('approval_ref', p_approval_ref)
  );

  return query
  select true, 'enqueued', 'reconcile job created', v_request_id, v_job.id, v_row.status, v_row.status, v_row.version, v_row.version, v_now;
end;
$$;

revoke all on function public.enqueue_stuck_report_reconcile(uuid, text, text, text, integer) from public;
grant execute on function public.enqueue_stuck_report_reconcile(uuid, text, text, text, integer) to service_role;

commit;
