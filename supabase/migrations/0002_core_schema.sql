-- ============================================================================
-- 0002_core_schema.sql
-- ============================================================================
-- Core analytics schema for the NCPL Analytics platform.
--
-- Design notes:
--   * All tables live in `public` (Supabase convention) but are owned by the
--     postgres role and locked down via RLS.
--   * `analytics_events` is the hot table — every portal hit lands here. We
--     range-partition it by month so old data can be detached/archived without
--     touching the live partition.
--   * `metadata` columns are `jsonb` for forward-compatibility. Always emit
--     keys at the top level (no nesting > 2 deep) so GIN indexes stay useful.
--   * Timestamps are `timestamptz` everywhere. Never store local time.
--   * IDs are `uuid` (`gen_random_uuid()`); event ingestion accepts client-
--     supplied UUIDs for idempotent retries.
--   * `analytics_users` mirrors `auth.users` minimally so we can join without
--     leaking auth internals. Filled by trigger.
-- ============================================================================

------------------------------------------------------------------------------
-- ENUMS
------------------------------------------------------------------------------
create type public.portal_id as enum (
  'sentinel',
  'analytics'
);

create type public.event_category as enum (
  'auth',
  'navigation',
  'feature',
  'interaction',
  'error',
  'custom'
);

create type public.event_source as enum (
  'web',
  'mobile',
  'server',
  'integration'
);

------------------------------------------------------------------------------
-- analytics_users  (lightweight mirror of auth.users)
------------------------------------------------------------------------------
create table public.analytics_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'member',     -- member | admin | owner
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create index analytics_users_email_idx       on public.analytics_users (lower(email));
create index analytics_users_last_seen_idx   on public.analytics_users (last_seen_at desc nulls last);

------------------------------------------------------------------------------
-- analytics_portals  (registry; mirrors src/config/portals.ts)
------------------------------------------------------------------------------
create table public.analytics_portals (
  id          public.portal_id primary key,
  name        text not null,
  description text,
  color       text not null default 'slate',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

------------------------------------------------------------------------------
-- analytics_sessions  (one row per portal session)
------------------------------------------------------------------------------
create table public.analytics_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.analytics_users(id) on delete set null,
  portal_id       public.portal_id not null references public.analytics_portals(id),
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  ended_at        timestamptz,
  ip_hash         text,                    -- SHA-256 hash, never raw IP
  user_agent      text,
  country_code    text,
  event_count     integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb
);

create index analytics_sessions_user_idx        on public.analytics_sessions (user_id);
create index analytics_sessions_portal_idx      on public.analytics_sessions (portal_id);
create index analytics_sessions_started_idx     on public.analytics_sessions (started_at desc);
create index analytics_sessions_last_seen_idx   on public.analytics_sessions (last_seen_at desc);
create index analytics_sessions_active_idx
  on public.analytics_sessions (portal_id, last_seen_at desc)
  where ended_at is null;

------------------------------------------------------------------------------
-- analytics_events  (hot, partitioned by month)
------------------------------------------------------------------------------
create table public.analytics_events (
  id           uuid not null default gen_random_uuid(),
  portal_id    public.portal_id not null references public.analytics_portals(id),
  category     public.event_category not null,
  name         text not null,
  source       public.event_source not null default 'web',
  user_id      uuid references public.analytics_users(id) on delete set null,
  session_id   uuid references public.analytics_sessions(id) on delete set null,
  url          text,
  referrer     text,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  ingested_at  timestamptz not null default now(),
  primary key (id, occurred_at)             -- partition key must be in PK
) partition by range (occurred_at);

-- Default partition catches stragglers / future months until a real one exists.
create table public.analytics_events_default
  partition of public.analytics_events default;

-- Seed partitions for the rolling window (current month + next 2).
-- New partitions are created via the maintenance function below.
create table public.analytics_events_y2026m05
  partition of public.analytics_events
  for values from ('2026-05-01') to ('2026-06-01');

create table public.analytics_events_y2026m06
  partition of public.analytics_events
  for values from ('2026-06-01') to ('2026-07-01');

create table public.analytics_events_y2026m07
  partition of public.analytics_events
  for values from ('2026-07-01') to ('2026-08-01');

-- Indexes are inherited by partitions.
create index analytics_events_occurred_idx          on public.analytics_events (occurred_at desc);
create index analytics_events_portal_occurred_idx   on public.analytics_events (portal_id, occurred_at desc);
create index analytics_events_user_occurred_idx     on public.analytics_events (user_id, occurred_at desc) where user_id is not null;
create index analytics_events_session_idx           on public.analytics_events (session_id) where session_id is not null;
create index analytics_events_category_idx          on public.analytics_events (category, occurred_at desc);
create index analytics_events_name_trgm_idx         on public.analytics_events using gin (name extensions.gin_trgm_ops);
create index analytics_events_metadata_gin_idx      on public.analytics_events using gin (metadata jsonb_path_ops);

------------------------------------------------------------------------------
-- analytics_reports  (saved/scheduled report definitions)
------------------------------------------------------------------------------
create table public.analytics_reports (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.analytics_users(id) on delete set null,
  name         text not null,
  description  text,
  query        jsonb not null,                       -- declarative spec (filters, metrics, group_by)
  schedule_cron text,                                -- nullable; null = on-demand
  is_shared    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index analytics_reports_owner_idx on public.analytics_reports (owner_id);
create index analytics_reports_shared_idx on public.analytics_reports (is_shared) where is_shared = true;

------------------------------------------------------------------------------
-- updated_at touch trigger (reused)
------------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger analytics_users_touch
  before update on public.analytics_users
  for each row execute function public.tg_touch_updated_at();

create trigger analytics_reports_touch
  before update on public.analytics_reports
  for each row execute function public.tg_touch_updated_at();

------------------------------------------------------------------------------
-- Mirror auth.users -> analytics_users on signup
------------------------------------------------------------------------------
create or replace function public.tg_mirror_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.analytics_users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_mirror_auth_user();

------------------------------------------------------------------------------
-- Session counter — keep analytics_sessions.event_count in sync
------------------------------------------------------------------------------
create or replace function public.tg_bump_session_event_count()
returns trigger language plpgsql as $$
begin
  if new.session_id is not null then
    update public.analytics_sessions
       set event_count  = event_count + 1,
           last_seen_at = greatest(last_seen_at, new.occurred_at)
     where id = new.session_id;
  end if;
  return new;
end $$;

create trigger analytics_events_bump_session
  after insert on public.analytics_events
  for each row execute function public.tg_bump_session_event_count();

------------------------------------------------------------------------------
-- Partition maintenance — call monthly via pg_cron or a Vercel cron
------------------------------------------------------------------------------
create or replace function public.ensure_events_partition(p_month date)
returns void language plpgsql as $$
declare
  start_date date := date_trunc('month', p_month)::date;
  end_date   date := (start_date + interval '1 month')::date;
  part_name  text := format('analytics_events_y%sm%s',
                            to_char(start_date, 'YYYY'),
                            to_char(start_date, 'MM'));
begin
  if not exists (
    select 1 from pg_class where relname = part_name
  ) then
    execute format(
      'create table public.%I partition of public.analytics_events for values from (%L) to (%L)',
      part_name, start_date, end_date
    );
  end if;
end $$;

------------------------------------------------------------------------------
-- RLS — secure by default; service role bypasses RLS entirely
------------------------------------------------------------------------------
alter table public.analytics_users    enable row level security;
alter table public.analytics_portals  enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events   enable row level security;
alter table public.analytics_reports  enable row level security;

-- Helper: is the current user an analytics admin?
create or replace function public.is_analytics_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.analytics_users u
    where u.id = auth.uid() and u.role in ('admin', 'owner')
  )
$$;

-- analytics_users: self-read, admin-read-all
create policy "users: self can read"   on public.analytics_users for select using (id = auth.uid());
create policy "users: admins read all" on public.analytics_users for select using (public.is_analytics_admin());
create policy "users: self can update" on public.analytics_users for update using (id = auth.uid()) with check (id = auth.uid());

-- analytics_portals: readable by any authenticated user, no writes from clients
create policy "portals: authenticated read" on public.analytics_portals
  for select to authenticated using (true);

-- analytics_sessions / analytics_events: admin read; service role writes
create policy "sessions: admins read" on public.analytics_sessions for select using (public.is_analytics_admin());
create policy "events:   admins read" on public.analytics_events   for select using (public.is_analytics_admin());

-- analytics_reports: owner CRUD, shared visible to all admins
create policy "reports: owner select"  on public.analytics_reports for select
  using (owner_id = auth.uid() or (is_shared and public.is_analytics_admin()));
create policy "reports: owner insert"  on public.analytics_reports for insert
  with check (owner_id = auth.uid());
create policy "reports: owner update"  on public.analytics_reports for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "reports: owner delete"  on public.analytics_reports for delete
  using (owner_id = auth.uid());
