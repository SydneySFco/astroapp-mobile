-- RLOOP-020
-- Backend lifecycle enforcement for user_reports.
-- Draft migration to be applied in Supabase SQL editor / migration pipeline.

begin;

-- 1) Versioning + consistency columns
alter table public.user_reports
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Backfill for safety if table had pre-existing nulls
update public.user_reports
set
  version = coalesce(version, 1),
  updated_at = coalesce(updated_at, created_at, timezone('utc', now()))
where version is null or updated_at is null;

-- 2) Lifecycle transition guard
create or replace function public.validate_user_reports_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status = 'queued' and new.status not in ('queued', 'processing') then
      raise exception 'Invalid user_reports status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if old.status = 'processing' and new.status not in ('processing', 'ready') then
      raise exception 'Invalid user_reports status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if old.status = 'ready' and new.status <> 'ready' then
      raise exception 'Invalid user_reports status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    -- archived records are terminal: keep as archived
    if old.status = 'archived' and new.status <> 'archived' then
      raise exception 'Invalid user_reports status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_reports_status_guard on public.user_reports;
create trigger trg_user_reports_status_guard
before update of status on public.user_reports
for each row
execute function public.validate_user_reports_status_transition();

-- 3) Monotonic version + updated_at hook (for realtime ordering)
create or replace function public.bump_user_reports_version_and_timestamp()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := coalesce(old.version, 1) + 1;
    new.updated_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_reports_versioning on public.user_reports;
create trigger trg_user_reports_versioning
before update on public.user_reports
for each row
execute function public.bump_user_reports_version_and_timestamp();

commit;
