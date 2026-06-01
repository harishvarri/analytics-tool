-- =============================================================================
-- Migration 0030 — v_project_health_generic (works for ANY app, no tickets)
-- =============================================================================
-- The existing v_project_health (0007) is ticket-centric (velocity/quality/
-- ontrack from Sentinel ticket events) and only scores apps that emit tickets.
-- For the 80 generic apps we blend signals every app produces:
--
--   GHI = 0.40·adoption_norm     (users using vs users with access)
--       + 0.25·reliability_norm  (100 - scaled error rate, last 7d)
--       + 0.20·performance_norm  (p95 page load, last 7d, normalized)
--       + 0.15·activity_norm     (events last 7d vs prior 7d)
--
-- Tiers match PHI: healthy ≥ 75, at_risk 50–75, critical < 50.
-- Missing signals fall back to a neutral 50 so a project isn't unfairly
-- penalised for not emitting that signal (e.g. no perf events yet).
-- =============================================================================

create or replace view public.v_project_health_generic as
with
-- Adoption: reuse the access-vs-usage view (0020). Neutral 50 when no grants.
adoption as (
  select
    project_slug,
    case when users_with_access > 0 then adoption_pct else 50 end as adoption_norm
  from public.v_project_access_vs_usage
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
-- Performance: p95 page-load (ms) over 7d, normalized (≤1000ms→100, ≥5000ms→0).
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
-- Activity trend: events last 7d vs prior 7d (steady = 50, growing > 50).
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
  round(coalesce(ad.adoption_norm, 50), 1)              as adoption_norm,
  round(coalesce(r.reliability_norm, 100), 1)           as reliability_norm,
  round(coalesce(perf.performance_norm, 50), 1)         as performance_norm,
  round(coalesce(act.activity_norm, 50), 1)             as activity_norm,
  round(
    0.40 * coalesce(ad.adoption_norm, 50)
  + 0.25 * coalesce(r.reliability_norm, 100)
  + 0.20 * coalesce(perf.performance_norm, 50)
  + 0.15 * coalesce(act.activity_norm, 50)
  , 0)                                                  as ghi_score,
  case
    when 0.40 * coalesce(ad.adoption_norm, 50)
       + 0.25 * coalesce(r.reliability_norm, 100)
       + 0.20 * coalesce(perf.performance_norm, 50)
       + 0.15 * coalesce(act.activity_norm, 50) >= 75 then 'healthy'
    when 0.40 * coalesce(ad.adoption_norm, 50)
       + 0.25 * coalesce(r.reliability_norm, 100)
       + 0.20 * coalesce(perf.performance_norm, 50)
       + 0.15 * coalesce(act.activity_norm, 50) >= 50 then 'at_risk'
    else 'critical'
  end                                                   as health_tier,
  coalesce(r.errors_7d, 0)                              as errors_7d,
  coalesce(act.events_7d, 0)                            as events_7d,
  round(perf.p95_ms, 0)                                 as p95_load_ms
from public.analytics_projects p
left join adoption    ad   on ad.project_slug   = p.slug
left join reliability r    on r.project_slug    = p.slug
left join performance perf on perf.project_slug = p.slug
left join activity    act  on act.project_slug  = p.slug
order by ghi_score asc;  -- worst first, so problems surface at the top

grant select on public.v_project_health_generic to authenticated;
