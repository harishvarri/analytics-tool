-- =============================================================================
-- Migration 0031 — v_project_last_activity (live per-project operational signals)
-- =============================================================================
-- Powers the Project Intelligence layer. The registry (analytics_projects) has
-- no activity timestamps, and getPortalSummaries only saw the last 24h. This
-- view gives, per portal, the live signals the Products redesign needs:
--   last activity, 7d active users / sessions, failed logins, and a
--   "business/operational" event count (excludes navigation/interaction/perf
--   noise) so we report operational activity, not raw event spam.
-- =============================================================================

create or replace view public.v_project_last_activity as
select
  portal_id::text                                                       as project_slug,
  max(occurred_at)                                                      as last_activity_at,
  count(*) filter (where occurred_at >= now() - interval '7 days')      as events_7d,
  count(distinct user_id) filter (
    where occurred_at >= now() - interval '7 days' and user_id is not null
  )                                                                     as active_users_7d,
  count(distinct user_id) filter (
    where occurred_at >= date_trunc('day', now()) and user_id is not null
  )                                                                     as active_users_today,
  count(distinct session_id) filter (
    where occurred_at >= now() - interval '7 days' and session_id is not null
  )                                                                     as sessions_7d,
  count(*) filter (
    where name = 'auth.login_failed' and occurred_at >= now() - interval '7 days'
  )                                                                     as failed_logins_7d,
  -- Operational/business activity = exclude navigation, interaction, perf noise.
  count(*) filter (
    where occurred_at >= now() - interval '7 days'
      and category not in ('navigation', 'interaction')
      and name not like 'performance.%'
  )                                                                     as business_events_7d
from public.analytics_events
group by portal_id;

grant select on public.v_project_last_activity to authenticated;
