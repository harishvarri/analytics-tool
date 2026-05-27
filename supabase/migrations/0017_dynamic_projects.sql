-- =============================================================================
-- Migration 0017 — Dynamic Project Onboarding
-- =============================================================================
-- Removes the "edit source code to add an app" requirement. New projects are
-- registered as DATA (a row in analytics_projects) plus a dynamically-added
-- enum label — no redeploy, no code change.
--
-- Why we grow the enum instead of retyping portal_id to text:
--   analytics_events.portal_id is referenced by ~20 views/materialized views
--   across migrations. Retyping it would force dropping & recreating all of
--   them — high risk on a live pipeline. Growing the enum via add_portal_value()
--   keeps every existing view working untouched while still allowing any new
--   project to be onboarded at runtime.
--
-- Auth model: a single global INGEST_API_KEY still works (Sentinel unchanged);
-- additionally each project gets its own api_key that ingestion will accept.
-- =============================================================================

-- ─── analytics_projects: rich, dynamic registry ──────────────────────────────
create table if not exists public.analytics_projects (
  slug             text primary key,                       -- equals the portal_id enum label
  name             text not null,
  description      text,
  repo_url         text,
  vercel_url       text,
  environment      text not null default 'production',     -- production | staging | development
  project_type     text not null default 'web',            -- web | mobile | api | admin | saas | other
  team_owner       text,
  tracking_enabled boolean not null default true,
  api_key          text not null unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists analytics_projects_enabled_idx
  on public.analytics_projects (tracking_enabled);
create index if not exists analytics_projects_api_key_idx
  on public.analytics_projects (api_key);

-- updated_at touch (reuses the shared trigger fn from 0002)
drop trigger if exists analytics_projects_touch on public.analytics_projects;
create trigger analytics_projects_touch
  before update on public.analytics_projects
  for each row execute function public.tg_touch_updated_at();

-- ─── add_portal_value: dynamically extend the portal_id enum ──────────────────
-- Called by the onboarding flow in its OWN statement/transaction so the new
-- value can be safely used by subsequent INSERTs (Postgres forbids using a
-- freshly-added enum value within the same transaction).
create or replace function public.add_portal_value(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('alter type public.portal_id add value if not exists %L', p_slug);
end
$$;

-- ─── Seed existing portals into the new registry ──────────────────────────────
insert into public.analytics_projects (slug, name, description, environment, project_type, api_key)
values
  ('sentinel',  'Sentinel',          'Internal Sentinel project',      'production', 'web', 'ncpl_pk_' || replace(gen_random_uuid()::text, '-', '')),
  ('analytics', 'Analytics Platform','This platform (self-reporting)', 'production', 'web', 'ncpl_pk_' || replace(gen_random_uuid()::text, '-', ''))
on conflict (slug) do nothing;

-- ─── RLS — admins read; service role bypasses (used by dashboard + onboarding) ─
alter table public.analytics_projects enable row level security;

drop policy if exists "projects: admins read" on public.analytics_projects;
create policy "projects: admins read"
  on public.analytics_projects for select
  using (public.is_analytics_admin());
