-- =============================================================================
-- Migration 0023 — Fix create_project_atomic after portal_id enum → text
-- =============================================================================
-- Run AFTER: ALTER TABLE analytics_portals/sessions/events ALTER COLUMN * TYPE text
--            DROP TYPE IF EXISTS public.portal_id CASCADE
-- =============================================================================
-- analytics_portals.id is public.portal_id, while create_project_atomic receives
-- p_slug as text. Cast after add_portal_value(slug) has committed.
-- =============================================================================

create or replace function public.create_project_atomic(
  p_slug         text,
  p_name         text,
  p_description  text,
  p_repo_url     text,
  p_vercel_url   text,
  p_environment  text,
  p_project_type text,
  p_team_owner   text,
  p_tracking     boolean,
  p_api_key      text
)
returns void language plpgsql as $$
begin
  insert into public.analytics_portals (id, name, description, color)
  values (p_slug, p_name, coalesce(p_description, ''), 'slate')
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description;

  insert into public.analytics_projects (
    slug, name, description, repo_url, vercel_url,
    environment, project_type, team_owner, tracking_enabled, api_key
  )
  values (
    p_slug, p_name, p_description, p_repo_url, p_vercel_url,
    p_environment, p_project_type, p_team_owner, p_tracking, p_api_key
  )
  on conflict (slug) do nothing;
end;
$$;
