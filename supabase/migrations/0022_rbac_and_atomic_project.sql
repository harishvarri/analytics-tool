-- =============================================================================
-- Migration 0022 — RBAC viewer role + atomic project creation
-- =============================================================================

-- ─── BUG-022: viewer role ─────────────────────────────────────────────────────
-- Add 'viewer' to the role domain. Viewers can read all dashboards but cannot
-- perform admin actions (create projects, change settings).
-- The analytics_users.role column already accepts any text; we just document
-- the new value and enforce it in the is_analytics_viewer() helper.

create or replace function public.is_analytics_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.analytics_users u
    where u.id = auth.uid() and u.role in ('admin', 'owner', 'member', 'viewer')
    -- All authenticated roles can view; only admin/owner can mutate.
    -- This function is used to gate dashboard page access at the DB level.
  )
$$;

-- Viewers are read-only; restrict the self-update policy further:
-- only admin/owner/member may change their own display_name or email.
drop policy if exists "users: self can update" on public.analytics_users;
drop policy if exists "users: self can update non-role columns" on public.analytics_users;
create policy "users: self can update non-role columns"
  on public.analytics_users for update
  using (
    id = auth.uid()
    and (select role from public.analytics_users where id = auth.uid()) != 'viewer'
  )
  with check (
    id = auth.uid()
    -- prevent self-escalation: role must remain unchanged
    and role = (select role from public.analytics_users where id = auth.uid())
  );

-- ─── BUG-024: atomic project creation ────────────────────────────────────────
-- Steps 2+3 of createProject (insert analytics_portals + analytics_projects)
-- run in a single function so they are atomic. Step 1 (add_portal_value, which
-- grows the enum) must remain outside because Postgres does not allow using a
-- freshly-added enum value in the same transaction. If the enum add succeeds but
-- this function fails, a retry will idempotently upsert the portals row and
-- re-insert the projects row (returning the existing key on conflict).
create or replace function public.create_project_atomic(
  p_slug        text,
  p_name        text,
  p_description text,
  p_repo_url    text,
  p_vercel_url  text,
  p_environment text,
  p_project_type text,
  p_team_owner  text,
  p_tracking    boolean,
  p_api_key     text
)
returns void language plpgsql as $$
begin
  -- Mirror into analytics_portals so legacy views/joins recognise the slug.
  insert into public.analytics_portals (id, name, description, color)
  values (p_slug, p_name, coalesce(p_description, ''), 'slate')
  on conflict (id) do update set name = excluded.name, description = excluded.description;

  -- Insert the rich project registry row.
  insert into public.analytics_projects (
    slug, name, description, repo_url, vercel_url,
    environment, project_type, team_owner, tracking_enabled, api_key
  )
  values (
    p_slug, p_name, p_description, p_repo_url, p_vercel_url,
    p_environment, p_project_type, p_team_owner, p_tracking, p_api_key
  )
  on conflict (slug) do nothing;  -- idempotent: a retry after partial failure is safe
end;
$$;
