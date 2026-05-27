-- =============================================================================
-- Migration 0010 — Module F: Feature Adoption Analytics
-- =============================================================================
-- Views created here:
--   v_feature_summary       — one row per feature namespace, lifetime + 7d/28d stats
--   v_feature_weekly_trend  — weekly active users per feature (last 12 weeks)
--   v_feature_actions       — per-action breakdown within each feature (last 28 days)
--   v_feature_decay         — week-over-week return rate per feature
--
-- "Feature" = the namespace prefix of an event name (the part before the first dot).
-- e.g. event "board.ticket_moved" belongs to feature "board".
--
-- Excluded event families (infrastructure, not user-facing features):
--   auth.*          — login, logout — tracked separately on Auth page
--   navigation.*    — page_view, time_on_page — tracked on Overview
--   session.*       — session.start — infrastructure
-- =============================================================================

-- ─── v_feature_summary ───────────────────────────────────────────────────────
-- One row per feature. Adoption % = (distinct 28d users of feature) /
-- (total distinct 28d users platform-wide) × 100.
create or replace view public.v_feature_summary as
with base as (
  select
    split_part(name, '.', 1)  as feature,
    user_id,
    occurred_at,
    portal_id
  from public.analytics_events
  where occurred_at >= now() - interval '90 days'
    and category    = 'custom'
    and name not like 'session.%'
    and name not like 'auth.%'
    and name not like 'navigation.%'
),
platform_active as (
  select count(distinct user_id) as total_users_28d
  from public.analytics_events
  where occurred_at >= now() - interval '28 days'
    and user_id is not null
),
per_feature as (
  select
    feature,
    min(occurred_at)::date                                                    as first_seen,
    count(*)                                                                  as total_events,
    count(distinct user_id)                                                   as total_users,
    count(distinct case when occurred_at >= now() - interval '7 days'
                        then user_id end)                                     as users_7d,
    count(distinct case when occurred_at >= now() - interval '28 days'
                        then user_id end)                                     as users_28d,
    count(case when occurred_at >= now() - interval '7 days' then 1 end)      as events_7d,
    count(case when occurred_at >= now() - interval '28 days' then 1 end)     as events_28d,
    count(distinct portal_id)                                                 as app_count
  from base
  group by 1
)
select
  p.feature,
  p.first_seen,
  p.total_events,
  p.total_users,
  p.users_7d,
  p.users_28d,
  p.events_7d,
  p.events_28d,
  p.app_count,
  case
    when a.total_users_28d > 0
    then round(100.0 * p.users_28d / a.total_users_28d, 1)
    else 0
  end as adoption_pct_28d
from per_feature p
cross join platform_active a
order by p.users_28d desc;

-- ─── v_feature_weekly_trend ──────────────────────────────────────────────────
-- Weekly granularity, last 12 weeks. Used for per-feature sparklines and the
-- stacked weekly adoption trend chart.
create or replace view public.v_feature_weekly_trend as
select
  split_part(name, '.', 1)              as feature,
  date_trunc('week', occurred_at)::date as week,
  count(*)                              as events,
  count(distinct user_id)               as active_users
from public.analytics_events
where occurred_at >= now() - interval '12 weeks'
  and category    = 'custom'
  and name not like 'session.%'
  and name not like 'auth.%'
  and name not like 'navigation.%'
group by 1, 2
order by 1, 2;

-- ─── v_feature_actions ───────────────────────────────────────────────────────
-- Breakdown of individual event names (actions) within each feature namespace,
-- last 28 days. Sorted by event volume desc within each feature.
create or replace view public.v_feature_actions as
select
  split_part(name, '.', 1)  as feature,
  name                       as action,
  count(*)                   as total_events,
  count(distinct user_id)    as unique_users,
  count(distinct session_id) as unique_sessions,
  max(occurred_at)           as last_seen
from public.analytics_events
where occurred_at >= now() - interval '28 days'
  and category    = 'custom'
  and name not like 'session.%'
  and name not like 'auth.%'
  and name not like 'navigation.%'
group by 1, 2
order by 1, 3 desc;

-- ─── v_feature_decay ─────────────────────────────────────────────────────────
-- Week-over-week stickiness: of the users who used a feature in week N,
-- what percentage came back to use it in week N+1?
-- Incomplete current week is excluded (< this Monday).
create or replace view public.v_feature_decay as
with user_weeks as (
  select distinct
    split_part(name, '.', 1)              as feature,
    user_id,
    date_trunc('week', occurred_at)::date as week
  from public.analytics_events
  where occurred_at >= now() - interval '12 weeks'
    and category    = 'custom'
    and name not like 'session.%'
    and name not like 'auth.%'
    and name not like 'navigation.%'
    and user_id is not null
)
select
  a.feature,
  a.week,
  count(distinct a.user_id) as users_this_week,
  count(distinct b.user_id) as users_returned,
  case
    when count(distinct a.user_id) > 0
    then round(100.0 * count(distinct b.user_id) / count(distinct a.user_id), 1)
    else 0
  end                        as retention_pct
from user_weeks a
left join user_weeks b
  on  b.feature  = a.feature
  and b.user_id  = a.user_id
  and b.week     = a.week + interval '1 week'
where a.week < date_trunc('week', now())::date   -- exclude incomplete current week
group by 1, 2
order by 1, 2;
