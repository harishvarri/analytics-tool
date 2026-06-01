-- =============================================================================
-- Migration 0018 — Performance Analytics + Active-User metrics (DAU/WAU/MAU)
-- =============================================================================
-- Reads the performance.* events the SDK auto-tracking now emits:
--   performance.page_load  metadata: { route, ttfbMs, domInteractiveMs,
--                                       domContentLoadedMs, loadMs, transferKb }
--   performance.engagement metadata: { route, engagedMs, engagedSec }
--
-- No new infra — pure SQL over analytics_events, like every other module.
-- =============================================================================

-- ─── v_performance_kpis ───────────────────────────────────────────────────────
-- Single-row scorecard over the last 7 days (percentiles are robust to outliers).
create or replace view public.v_performance_kpis as
with pl as (
  select
    (metadata->>'loadMs')::numeric             as load_ms,
    (metadata->>'ttfbMs')::numeric             as ttfb_ms,
    (metadata->>'domInteractiveMs')::numeric   as dom_interactive_ms
  from public.analytics_events
  where name = 'performance.page_load'
    and occurred_at >= now() - interval '7 days'
    and metadata ? 'loadMs'
),
eng as (
  select (metadata->>'engagedSec')::numeric as engaged_sec
  from public.analytics_events
  where name = 'performance.engagement'
    and occurred_at >= now() - interval '7 days'
    and metadata ? 'engagedSec'
)
select
  (select count(*) from pl)                                                          as samples,
  round((select percentile_cont(0.50) within group (order by load_ms) from pl)::numeric, 0)   as load_p50_ms,
  round((select percentile_cont(0.75) within group (order by load_ms) from pl)::numeric, 0)   as load_p75_ms,
  round((select percentile_cont(0.95) within group (order by load_ms) from pl)::numeric, 0)   as load_p95_ms,
  round((select percentile_cont(0.50) within group (order by ttfb_ms) from pl)::numeric, 0)   as ttfb_p50_ms,
  round((select percentile_cont(0.50) within group (order by dom_interactive_ms) from pl)::numeric, 0) as dom_interactive_p50_ms,
  round((select avg(engaged_sec) from eng), 0)                                       as avg_engaged_sec;

-- ─── v_performance_by_route ───────────────────────────────────────────────────
-- Slowest routes by median load time (last 7 days).
create or replace view public.v_performance_by_route as
select
  coalesce(nullif(metadata->>'route', ''), '(unknown)')                       as route,
  count(*)                                                                    as samples,
  round(percentile_cont(0.50) within group (order by (metadata->>'loadMs')::numeric)::numeric, 0) as load_p50_ms,
  round(percentile_cont(0.95) within group (order by (metadata->>'loadMs')::numeric)::numeric, 0) as load_p95_ms,
  round(avg((metadata->>'ttfbMs')::numeric), 0)                               as ttfb_avg_ms
from public.analytics_events
where name = 'performance.page_load'
  and occurred_at >= now() - interval '7 days'
  and metadata ? 'loadMs'
group by 1
having count(*) >= 1
order by load_p50_ms desc nulls last;

-- ─── v_performance_trend ──────────────────────────────────────────────────────
-- Daily median page-load over the last 14 days for the trend chart.
create or replace view public.v_performance_trend as
select
  date_trunc('day', occurred_at)::date                                        as day,
  count(*)                                                                    as samples,
  round(percentile_cont(0.50) within group (order by (metadata->>'loadMs')::numeric)::numeric, 0) as load_p50_ms
from public.analytics_events
where name = 'performance.page_load'
  and occurred_at >= now() - interval '14 days'
  and metadata ? 'loadMs'
group by 1
order by 1;

-- ─── v_active_user_counts ─────────────────────────────────────────────────────
-- DAU / WAU / MAU + stickiness (DAU/MAU). Single row.
create or replace view public.v_active_user_counts as
select
  count(distinct user_id) filter (where occurred_at >= now() - interval '1 day')   as dau,
  count(distinct user_id) filter (where occurred_at >= now() - interval '7 days')  as wau,
  count(distinct user_id) filter (where occurred_at >= now() - interval '30 days') as mau,
  round(
    100.0
    * count(distinct user_id) filter (where occurred_at >= now() - interval '1 day')
    / nullif(count(distinct user_id) filter (where occurred_at >= now() - interval '30 days'), 0),
    1
  )                                                                                as stickiness_pct
from public.analytics_events
where occurred_at >= now() - interval '30 days'
  and user_id is not null;
