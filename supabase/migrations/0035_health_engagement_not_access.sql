-- =============================================================================
-- Migration 0035 — Health uses USAGE/ENGAGEMENT, not access-grant adoption
-- =============================================================================
-- Per the OI roadmap ("Remove Assigned User Adoption — requires access grants,
-- not available in many apps"), the generic project health score no longer
-- depends on analytics_user_access. The 40%-weighted "adoption" component
-- (access-vs-usage) is replaced by an engagement signal derived purely from
-- real activity (active users in the last 7 days), which every product produces.
--
-- This removes the "adoption unmeasured / defaults to neutral 50" drag that made
-- products with no synced access grants look unhealthy for no real reason.
--
-- The column is still named adoption_norm to avoid churn in dependent code; the
-- UI relabels it "Usage". New blend (no access grants):
--   GHI = 0.30 reliability + 0.25 performance + 0.25 momentum + 0.20 usage
-- =============================================================================

create or replace view public.v_project_health_generic as
with
-- Usage/engagement: active users over the last 7 days, normalized. No grants.
engagement as (
  select
    project_slug,
    least(100, round(active_users_7d * 12.0))::numeric as adoption_norm
  from public.v_project_last_activity
),
-- Reliability: error rate over the last 7 days, per portal.
reliability as (
  select
    portal_id::text as project_slug,
    count(*)                                            as total_7d,
    count(*) filter (where category = 'error')          as errors_7d,
    greatest(0, 100 - (
      100.0 * count(*) filter (where category = 'error')
      / nullif(count(*), 0)
    ) * 5)                                              as reliability_norm
  from public.analytics_events
  where occurred_at >= now() - interval '7 days'
  group by portal_id
),
-- Performance: p95 page-load (ms) over 7d, normalized (<=1000ms->100, >=5000ms->0).
performance as (
  select
    portal_id::text as project_slug,
    (percentile_cont(0.95) within group (
      order by (metadata->>'loadMs')::numeric
    ))::numeric                                         as p95_ms,
    greatest(0, least(100, 100 - (
      ((percentile_cont(0.95) within group (order by (metadata->>'loadMs')::numeric))::numeric - 1000) / 40.0
    )))::numeric                                        as performance_norm
  from public.analytics_events
  where name = 'performance.page_load'
    and metadata ? 'loadMs'
    and occurred_at >= now() - interval '7 days'
  group by portal_id
),
-- Activity/momentum: events last 7d vs prior 7d (steady = 50, growing > 50).
activity as (
  select
    portal_id::text as project_slug,
    count(*) filter (where occurred_at >= now() - interval '7 days')                                  as events_7d,
    count(*) filter (where occurred_at >= now() - interval '14 days'
                       and occurred_at <  now() - interval '7 days')                                  as events_prev_7d,
    least(100, round(
      coalesce(
        count(*) filter (where occurred_at >= now() - interval '7 days')::numeric
        / nullif(count(*) filter (where occurred_at >= now() - interval '14 days'
                                    and occurred_at < now() - interval '7 days'), 0),
        1
      ) * 50
    ))                                                  as activity_norm
  from public.analytics_events
  where occurred_at >= now() - interval '14 days'
  group by portal_id
)
select
  p.slug                                                as project_slug,
  p.name                                                as project_name,
  round(coalesce(e.adoption_norm, 40), 1)               as adoption_norm,
  round(coalesce(r.reliability_norm, 100), 1)           as reliability_norm,
  round(coalesce(perf.performance_norm, 50), 1)         as performance_norm,
  round(coalesce(act.activity_norm, 50), 1)             as activity_norm,
  round(
    0.20 * coalesce(e.adoption_norm, 40)
  + 0.30 * coalesce(r.reliability_norm, 100)
  + 0.25 * coalesce(perf.performance_norm, 50)
  + 0.25 * coalesce(act.activity_norm, 50)
  , 0)                                                  as ghi_score,
  case
    when 0.20 * coalesce(e.adoption_norm, 40)
       + 0.30 * coalesce(r.reliability_norm, 100)
       + 0.25 * coalesce(perf.performance_norm, 50)
       + 0.25 * coalesce(act.activity_norm, 50) >= 75 then 'healthy'
    when 0.20 * coalesce(e.adoption_norm, 40)
       + 0.30 * coalesce(r.reliability_norm, 100)
       + 0.25 * coalesce(perf.performance_norm, 50)
       + 0.25 * coalesce(act.activity_norm, 50) >= 50 then 'at_risk'
    else 'critical'
  end                                                   as health_tier,
  coalesce(r.errors_7d, 0)                              as errors_7d,
  coalesce(act.events_7d, 0)                            as events_7d,
  round(perf.p95_ms, 0)                                 as p95_load_ms
from public.analytics_projects p
left join engagement  e    on e.project_slug   = p.slug
left join reliability r    on r.project_slug   = p.slug
left join performance perf on perf.project_slug = p.slug
left join activity    act  on act.project_slug  = p.slug
order by ghi_score asc;

grant select on public.v_project_health_generic to authenticated;
