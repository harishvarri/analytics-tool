-- ============================================================================
-- 0003_aggregations.sql
-- ============================================================================
-- Pre-aggregated views & materialized views for dashboards.
--
--  * Plain views back the realtime feed (always fresh, cheap windows).
--  * Materialized views back daily/portal rollups (refreshed on a schedule).
--  * `refresh_analytics_aggregates()` is the single entry point the cron job
--    or API can call to refresh every MV concurrently.
-- ============================================================================

------------------------------------------------------------------------------
-- Realtime feed: last 5 minutes of events, enriched with portal + user
------------------------------------------------------------------------------
create or replace view public.v_realtime_activity as
  select
    e.id,
    e.portal_id,
    p.name           as portal_name,
    e.category,
    e.name           as event_name,
    e.user_id,
    u.email          as user_email,
    u.display_name   as user_display_name,
    e.session_id,
    e.url,
    e.metadata,
    e.occurred_at
  from public.analytics_events e
  join public.analytics_portals p on p.id = e.portal_id
  left join public.analytics_users u on u.id = e.user_id
  where e.occurred_at > now() - interval '5 minutes'
  order by e.occurred_at desc;

------------------------------------------------------------------------------
-- Daily portal rollup (materialized)
------------------------------------------------------------------------------
create materialized view if not exists public.mv_portal_daily as
  select
    portal_id,
    date_trunc('day', occurred_at)::date as day,
    count(*)                                          as events,
    count(distinct user_id)    filter (where user_id is not null)    as users,
    count(distinct session_id) filter (where session_id is not null) as sessions,
    count(*) filter (where category = 'error')                       as errors
  from public.analytics_events
  group by portal_id, day
  with no data;

create unique index if not exists mv_portal_daily_pk on public.mv_portal_daily (portal_id, day);
create index if not exists mv_portal_daily_day_idx   on public.mv_portal_daily (day desc);

------------------------------------------------------------------------------
-- Daily user activity (materialized)
------------------------------------------------------------------------------
create materialized view if not exists public.mv_user_daily as
  select
    user_id,
    date_trunc('day', occurred_at)::date as day,
    count(*)                              as events,
    count(distinct portal_id)             as portals,
    count(distinct session_id) filter (where session_id is not null) as sessions
  from public.analytics_events
  where user_id is not null
  group by user_id, day
  with no data;

create unique index if not exists mv_user_daily_pk    on public.mv_user_daily (user_id, day);
create index if not exists mv_user_daily_day_idx on public.mv_user_daily (day desc);

------------------------------------------------------------------------------
-- Top features per portal (rolling 30 days, materialized)
------------------------------------------------------------------------------
create materialized view if not exists public.mv_feature_usage_30d as
  select
    portal_id,
    name as event_name,
    count(*)                                        as occurrences,
    count(distinct user_id)    filter (where user_id is not null)    as unique_users,
    count(distinct session_id) filter (where session_id is not null) as unique_sessions
  from public.analytics_events
  where category = 'feature'
    and occurred_at > now() - interval '30 days'
  group by portal_id, name
  with no data;

create unique index if not exists mv_feature_usage_30d_pk
  on public.mv_feature_usage_30d (portal_id, event_name);
create index if not exists mv_feature_usage_30d_top_idx
  on public.mv_feature_usage_30d (portal_id, occurrences desc);

------------------------------------------------------------------------------
-- Refresh entry point (concurrent so dashboards stay live)
------------------------------------------------------------------------------
create or replace function public.refresh_analytics_aggregates()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently public.mv_portal_daily;
  refresh materialized view concurrently public.mv_user_daily;
  refresh materialized view concurrently public.mv_feature_usage_30d;
end $$;

------------------------------------------------------------------------------
-- Grants — readable by authenticated dashboard users (RLS on base tables still applies)
------------------------------------------------------------------------------
grant select on public.v_realtime_activity to authenticated;
grant select on public.mv_portal_daily        to authenticated;
grant select on public.mv_user_daily          to authenticated;
grant select on public.mv_feature_usage_30d   to authenticated;
