-- RLOOP-046 (Draft)
-- DB-first idempotency + transactional audit atomicity for quarantine admin actions.

-- Requires (from RLOOP-044 draft):
--   unique index uq_replay_quarantine_audit_replay_action_request
--   on replay_quarantine_audit_log(replay_id, action, request_id)
--   where request_id is not null
--     and action in ('manual_redrive_requested','force_drop_requested')

create or replace function public.replay_quarantine_apply_admin_action(
  p_replay_id text,
  p_action text,
  p_actor_id text,
  p_reason text,
  p_approval_ref text,
  p_request_id text default null,
  p_note text default null,
  p_processed_at timestamptz default now()
)
returns table (
  replay_id text,
  final_status text,
  processed_at timestamptz,
  deduped boolean
)
language plpgsql
security definer
as $$
declare
  v_expected_action text;
  v_target_status text;
  v_inserted_replay_id text;
  v_existing_status text;
  v_existing_processed_at timestamptz;
begin
  if p_action not in ('manual_redrive_requested', 'force_drop_requested') then
    raise exception 'unsupported action: %', p_action using errcode = '22023';
  end if;

  v_target_status := case
    when p_action = 'manual_redrive_requested' then 'redriven'
    else 'dropped'
  end;

  -- 1) DB-first idempotency gate.
  if p_request_id is not null and length(trim(p_request_id)) > 0 then
    insert into public.replay_quarantine_audit_log (
      replay_id,
      action,
      actor_id,
      reason,
      approval_ref,
      request_id,
      metadata,
      created_at
    )
    values (
      p_replay_id,
      p_action,
      p_actor_id,
      p_reason,
      p_approval_ref,
      p_request_id,
      jsonb_build_object('idempotency_gate', true),
      p_processed_at
    )
    on conflict (replay_id, action, request_id) do nothing
    returning replay_id into v_inserted_replay_id;

    if v_inserted_replay_id is null then
      select
        q.status,
        (a.metadata ->> 'processedAt')::timestamptz
      into
        v_existing_status,
        v_existing_processed_at
      from public.replay_quarantine_messages q
      left join public.replay_quarantine_audit_log a
        on a.replay_id = q.replay_id
       and a.action = p_action
       and a.request_id = p_request_id
      where q.replay_id = p_replay_id
      order by a.created_at desc nulls last
      limit 1;

      if v_existing_status is null then
        raise exception 'quarantine record not found: %', p_replay_id using errcode = 'P0002';
      end if;

      return query
      select
        p_replay_id,
        v_target_status,
        coalesce(v_existing_processed_at, p_processed_at),
        true;
      return;
    end if;
  end if;

  -- 2) State transition in same transaction boundary.
  update public.replay_quarantine_messages
  set status = v_target_status,
      reviewed_at = p_processed_at,
      updated_at = p_processed_at,
      redriven_at = case when v_target_status = 'redriven' then p_processed_at else redriven_at end,
      dropped_at = case when v_target_status = 'dropped' then p_processed_at else dropped_at end
  where replay_id = p_replay_id
    and status = 'pending_review';

  if not found then
    if exists (select 1 from public.replay_quarantine_messages where replay_id = p_replay_id) then
      raise exception 'stale transition for replay_id %', p_replay_id using errcode = 'P0001';
    end if;

    raise exception 'quarantine record not found: %', p_replay_id using errcode = 'P0002';
  end if;

  -- 3) Materialize action + status_changed audit entries atomically.
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    insert into public.replay_quarantine_audit_log (
      replay_id,
      action,
      actor_id,
      reason,
      approval_ref,
      request_id,
      metadata,
      created_at
    )
    values (
      p_replay_id,
      p_action,
      p_actor_id,
      p_reason,
      p_approval_ref,
      null,
      jsonb_build_object('note', p_note, 'processedAt', p_processed_at::text, 'outcome', v_target_status),
      p_processed_at
    );
  else
    update public.replay_quarantine_audit_log
       set metadata = jsonb_build_object('note', p_note, 'processedAt', p_processed_at::text, 'outcome', v_target_status),
           created_at = p_processed_at
     where replay_id = p_replay_id
       and action = p_action
       and request_id = p_request_id;
  end if;

  insert into public.replay_quarantine_audit_log (
    replay_id,
    action,
    actor_id,
    reason,
    approval_ref,
    request_id,
    metadata,
    created_at
  )
  values (
    p_replay_id,
    'status_changed',
    p_actor_id,
    p_reason,
    p_approval_ref,
    p_request_id,
    jsonb_build_object(
      'fromStatus', 'pending_review',
      'toStatus', v_target_status,
      'note', p_note,
      'processedAt', p_processed_at::text
    ),
    p_processed_at
  );

  return query
  select
    p_replay_id,
    v_target_status,
    p_processed_at,
    false;
end;
$$;
