-- =============================================================================
-- Migration 0019 — Directory & Access layer (Operational Intelligence)
-- =============================================================================
-- Turns anonymous event tracking into a people-aware platform:
--   * analytics_users gains org-directory attributes (department, team, status…)
--   * analytics_user_access is the "allow-map": who MAY use each project
--     (pushed by the central SSO), so we can compute access-vs-usage.
--   * a partial-unique email index enables identity resolution for independent
--     apps that send an email instead of the central user uuid.
--
-- The central SSO pushes the directory to POST /api/v1/directory (mig-independent
-- code). Anonymous/event-only users keep source='event' and are excluded from
-- people views by the 0020 views.
-- =============================================================================

-- ─── Extend analytics_users with directory attributes ────────────────────────
alter table public.analytics_users
  add column if not exists department             text,
  add column if not exists team                   text,
  add column if not exists title                  text,
  add column if not exists status                 text not null default 'active',
  add column if not exists is_internal            boolean not null default true,
  add column if not exists source                 text not null default 'event',
  add column if not exists last_directory_sync_at timestamptz;

-- status domain guard (cheap CHECK instead of an enum that can't easily shrink)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analytics_users_status_chk'
  ) then
    alter table public.analytics_users
      add constraint analytics_users_status_chk
      check (status in ('active', 'inactive', 'invited'));
  end if;
end $$;

-- One canonical row per email (for resolving independent-app users by email),
-- while allowing unlimited NULL-email anonymous rows.
create unique index if not exists analytics_users_email_uniq
  on public.analytics_users (lower(email))
  where email is not null;

create index if not exists analytics_users_status_idx on public.analytics_users (status);
create index if not exists analytics_users_dept_idx   on public.analytics_users (department);
create index if not exists analytics_users_source_idx on public.analytics_users (source);

-- ─── analytics_user_access — the allow-map (who MAY use which project) ────────
create table if not exists public.analytics_user_access (
  user_id      uuid not null references public.analytics_users(id) on delete cascade,
  project_slug text not null references public.analytics_projects(slug) on delete cascade,
  granted_at   timestamptz not null default now(),
  source       text not null default 'directory',  -- directory | manual
  primary key (user_id, project_slug)
);

create index if not exists analytics_user_access_project_idx on public.analytics_user_access (project_slug);
create index if not exists analytics_user_access_user_idx    on public.analytics_user_access (user_id);

-- ─── RLS — admins read; service role (ingest/sync) bypasses RLS ───────────────
alter table public.analytics_user_access enable row level security;

drop policy if exists "user_access: admins read" on public.analytics_user_access;
create policy "user_access: admins read"
  on public.analytics_user_access for select
  using (public.is_analytics_admin());
