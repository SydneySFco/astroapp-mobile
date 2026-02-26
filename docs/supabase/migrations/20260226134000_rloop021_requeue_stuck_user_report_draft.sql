-- RLOOP-021
-- Privileged reconciliation RPC draft
-- Purpose: provide controlled server-side action for stuck `processing` user_reports
-- Security: service_role only

begin;

create table if not exists public.user_reports_reconciliation_audit (
  id bigserial primary key,
  user_report_id uuid not null,
  reason text,
  attempted_action text not null default 'requeue_stuck_user_report',
  old_status text,
  new_status text,
  old_version integer,
  new_version integer,
  success boolean not null,
  error_code text,
  error_message text,
  invoked_by text not null default coalesce(auth.role(), 'unknown'),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_reports_reconciliation_audit is
  'Audit trail for privileged reconciliation attempts on user_reports.';

create or replace function public.requeue_stuck_user_report(
  p_user_report_id uuid,
  p_reason text default null,
  p_max_age_minutes integer default 30
)
returns table (
  success boolean,
  action text,
  message text,
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
  v_threshold timestamptz := timezone('utc', now()) - make_interval(mins => greatest(p_max_age_minutes, 1));
  v_new_row public.user_reports%rowtype;
  v_error_code text;
  v_error_message text;
  v_now timestamptz := timezone('utc', now());
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'requeue_stuck_user_report is service_role only'
      using errcode = '42501';
  end if;

  select *
    into v_row
  from public.user_reports
  where id = p_user_report_id
  for update;

  if not found then
    return query
    select false, 'noop', 'user_report not found', null::text, null::text, null::integer, null::integer, v_now;
    return;
  end if;

  if v_row.status is distinct from 'processing' then
    insert into public.user_reports_reconciliation_audit (
      user_report_id, reason, old_status, new_status, old_version, new_version, success, error_code, error_message
    ) values (
      p_user_report_id, p_reason, v_row.status, v_row.status, v_row.version, v_row.version, false, 'INVALID_STATE',
      format('expected processing, got %s', v_row.status)
    );

    return query
    select false, 'noop', format('invalid state: %s', v_row.status), v_row.status, v_row.status, v_row.version, v_row.version, v_now;
    return;
  end if;

  if v_row.updated_at >= v_threshold then
    insert into public.user_reports_reconciliation_audit (
      user_report_id, reason, old_status, new_status, old_version, new_version, success, error_code, error_message
    ) values (
      p_user_report_id, p_reason, v_row.status, v_row.status, v_row.version, v_row.version, false, 'NOT_STUCK',
      'record is not older than threshold'
    );

    return query
    select false, 'noop', 'record not stuck yet', v_row.status, v_row.status, v_row.version, v_row.version, v_now;
    return;
  end if;

  begin
    -- NOTE:
    -- RLOOP-020 lifecycle guard currently blocks processing -> queued transition.
    -- This update is intentionally attempted and audited; if guard blocks, caller gets deterministic error context.
    update public.user_reports
      set status = 'queued'
    where id = p_user_report_id
    returning * into v_new_row;

    insert into public.user_reports_reconciliation_audit (
      user_report_id, reason, old_status, new_status, old_version, new_version, success
    ) values (
      p_user_report_id, p_reason, v_row.status, v_new_row.status, v_row.version, v_new_row.version, true
    );

    return query
    select true, 'requeued', 'report moved to queued', v_row.status, v_new_row.status, v_row.version, v_new_row.version, v_now;
    return;

  exception when others then
    get stacked diagnostics v_error_code = returned_sqlstate, v_error_message = message_text;

    insert into public.user_reports_reconciliation_audit (
      user_report_id, reason, old_status, new_status, old_version, new_version, success, error_code, error_message
    ) values (
      p_user_report_id, p_reason, v_row.status, v_row.status, v_row.version, v_row.version, false, v_error_code, v_error_message
    );

    return query
    select false, 'failed', coalesce(v_error_message, 'unknown error'), v_row.status, v_row.status, v_row.version, v_row.version, v_now;
    return;
  end;
end;
$$;

revoke all on function public.requeue_stuck_user_report(uuid, text, integer) from public;
grant execute on function public.requeue_stuck_user_report(uuid, text, integer) to service_role;

commit;