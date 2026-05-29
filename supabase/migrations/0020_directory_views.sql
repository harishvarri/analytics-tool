-- =============================================================================
-- Migration 0020 — Operational-Intelligence views (people / access / command)
-- =============================================================================
-- Generic activity intelligence (no business KPIs yet). All people-oriented
-- views exclude anonymous/event-only rows (source <> 'directory' AND
-- is_internal = false AND email IS NULL) so anonymous traffic inflates raw
-- event counts but never headcount/adoption.
-- =============================================================================

-- A "known person" = a directory user, or an internal user, or any user with an
-- email (independent-app, email-resolved). Anonymous browser rows are excluded.
-- Reused inline as: (u.source = 'directory' or u.is_internal or u.email is not null)

-- ─── v_project_access_vs_usage — adoption of access per project ───────────────
create or replace view public.v_project_access_vs_usage as
with access as (
  select project_slug, count(distinct user_id) as users_with_access
  from public.analytics_user_access
  group by project_slug
),
adopted as (
  select a.project_slug, count(distinct a.user_id) as adopted_users
  from public.analytics_user_access a
  join public.analytics_events e
    on e.user_id = a.user_id
   and e.portal_id::text = a.project_slug
   and e.occurred_at >= now() - interval '30 days'
  group by a.project_slug
)
select
  p.slug                                   as project_slug,
  p.name                                   as project_name,
  coalesce(ac.users_with_access, 0)        as users_with_access,
  coalesce(ad.adopted_users, 0)            as adopted_users,
  greatest(coalesce(ac.users_with_access, 0) - coalesce(ad.adopted_users, 0), 0) as access_never_used,
  case
    when coalesce(ac.users_with_access, 0) > 0
    then round(100.0 * coalesce(ad.adopted_users, 0) / ac.users_with_access, 1)
    else 0
  end                                      as adoption_pct
from public.analytics_projects p
left join access  ac on ac.project_slug = p.slug
left join adopted ad on ad.project_slug = p.slug
order by users_with_access desc nulls last, project_name;

-- Parameterised variant for the dashboard date picker.
create or replace function public.project_access_vs_usage(p_days int default 30)
returns table (
  project_slug      text,
  project_name      text,
  users_with_access bigint,
  adopted_users     bigint,
  access_never_used bigint,
  adoption_pct      numeric
)
language sql stable as $$
  with access as (
    select project_slug, count(distinct user_id) as users_with_access
    from public.analytics_user_access group by project_slug
  ),
  adopted as (
    select a.project_slug, count(distinct a.user_id) as adopted_users
    from public.analytics_user_access a
    join public.analytics_events e
      on e.user_id = a.user_id
     and e.portal_id::text = a.project_slug
     and e.occurred_at >= now() - make_interval(days => p_days)
    group by a.project_slug
  )
  select
    p.slug, p.name,
    coalesce(ac.users_with_access, 0),
    coalesce(ad.adopted_users, 0),
    greatest(coalesce(ac.users_with_access, 0) - coalesce(ad.adopted_users, 0), 0),
    case when coalesce(ac.users_with_access,0) > 0
         then round(100.0 * coalesce(ad.adopted_users,0) / ac.users_with_access, 1) else 0 end
  from public.analytics_projects p
  left join access  ac on ac.project_slug = p.slug
  left join adopted ad on ad.project_slug = p.slug
  order by 3 desc nulls last, 2;
$$;

-- ─── v_user_app_profile — per (user, app) activity (known people only) ────────
create or replace view public.v_user_app_profile as
select
  u.id                       as user_id,
  u.email,
  u.display_name,
  u.department,
  u.team,
  e.portal_id::text          as project_slug,
  min(e.occurred_at)         as first_seen_at,
  max(e.occurred_at)         as last_active_at,
  count(*)                   as total_events,
  count(distinct e.session_id) filter (where e.session_id is not null) as total_sessions
from public.analytics_users u
join public.analytics_events e on e.user_id = u.id
where (u.source = 'directory' or u.is_internal or u.email is not null)
group by u.id, u.email, u.display_name, u.department, u.team, e.portal_id;

-- One row per known user (cross-app summary).
create or replace view public.v_user_profile_summary as
select
  u.id                       as user_id,
  u.email,
  u.display_name,
  u.department,
  u.team,
  u.status,
  count(distinct e.portal_id) as apps_used,
  count(e.*)                  as total_events,
  count(distinct e.session_id) filter (where e.session_id is not null) as total_sessions,
  min(e.occurred_at)          as first_seen_at,
  max(e.occurred_at)          as last_active_at
from public.analytics_users u
left join public.analytics_events e on e.user_id = u.id
where (u.source = 'directory' or u.is_internal or u.email is not null)
group by u.id, u.email, u.display_name, u.department, u.team, u.status;

-- ─── v_inactive_users — have access but no activity in N days ─────────────────
create or replace view public.v_inactive_users as
with last_seen as (
  select user_id, max(occurred_at) as last_active_at
  from public.analytics_events
  where user_id is not null
  group by user_id
),
access_counts as (
  select user_id, count(*) as projects_with_access
  from public.analytics_user_access group by user_id
)
select
  u.id                          as user_id,
  u.email,
  u.display_name,
  u.department,
  u.team,
  u.status,
  ac.projects_with_access,
  ls.last_active_at,
  case when ls.last_active_at is null then null
       else floor(extract(epoch from (now() - ls.last_active_at)) / 86400)::int end as days_inactive
from public.analytics_users u
join access_counts ac on ac.user_id = u.id
left join last_seen ls on ls.user_id = u.id
where ls.last_active_at is null
   or ls.last_active_at < now() - interval '30 days'
order by ls.last_active_at asc nulls first;

-- ─── v_org_directory_rollup — directory composition ──────────────────────────
create or replace view public.v_org_directory_rollup as
select
  coalesce(department, 'Unassigned') as department,
  coalesce(team, 'Unassigned')       as team,
  count(*)                                              as total_users,
  count(*) filter (where status = 'active')             as active_users,
  count(*) filter (where status = 'inactive')           as inactive_users,
  count(*) filter (where status = 'invited')            as invited_users,
  count(*) filter (where is_internal)                   as internal_users
from public.analytics_users
where source = 'directory' or is_internal
group by 1, 2
order by total_users desc;

-- ─── v_command_center — single-row org snapshot (today) ───────────────────────
create or replace view public.v_command_center as
select
  (select count(distinct user_id) from public.analytics_events
     where occurred_at >= date_trunc('day', now()) and user_id is not null)        as active_users_today,
  (select count(*) from public.analytics_sessions
     where started_at >= date_trunc('day', now()))                                 as sessions_today,
  (select count(*) from public.analytics_events
     where occurred_at >= date_trunc('day', now()))                                as events_today,
  (select count(*) from public.analytics_events
     where occurred_at >= date_trunc('day', now()) and category = 'error')         as errors_today,
  (select project_name from public.v_project_access_vs_usage
     order by adopted_users desc nulls last limit 1)                               as most_used_project,
  (select project_name from public.v_project_access_vs_usage
     where users_with_access > 0 order by adoption_pct asc limit 1)                as least_adopted_project,
  (select count(*) from public.analytics_users
     where source = 'directory' or is_internal)                                    as total_directory_users,
  (select count(*) from public.v_inactive_users)                                   as inactive_users_count,
  (select coalesce(sum(access_never_used), 0) from public.v_project_access_vs_usage) as never_used_access_count;

-- ─── Grants (RLS on base tables still applies) ────────────────────────────────
grant select on public.v_project_access_vs_usage to authenticated;
grant select on public.v_user_app_profile        to authenticated;
grant select on public.v_user_profile_summary    to authenticated;
grant select on public.v_inactive_users          to authenticated;
grant select on public.v_org_directory_rollup    to authenticated;
grant select on public.v_command_center          to authenticated;
