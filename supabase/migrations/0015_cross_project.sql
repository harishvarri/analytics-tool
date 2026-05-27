-- =============================================================================
-- Migration 0015 — Module K: Cross-Project (Application) Comparison
-- =============================================================================
-- Organization-level intelligence: one row per registered application
-- (analytics_portals) with the headline metrics needed to compare products
-- side by side — users, sessions, events, errors, error rate, feature breadth,
-- and a stickiness proxy (7d / 30d returning users).
--
-- LEFT JOIN from analytics_portals guarantees every app appears, even with
-- zero activity, so the comparison stays complete as new apps onboard.
-- =============================================================================

create or replace view public.v_project_comparison as
with ev as (
  select portal_id, user_id, session_id, category, name, occurred_at
  from public.analytics_events
  where occurred_at >= now() - interval '30 days'
)
select
  p.id                                                                          as portal_id,
  p.name                                                                        as portal_name,
  count(ev.*)                                                                   as events_30d,
  count(distinct ev.user_id)                                                    as users_30d,
  count(distinct ev.session_id)                                                 as sessions_30d,
  count(*) filter (where ev.category = 'error')                                 as errors_30d,
  count(distinct ev.user_id) filter (where ev.occurred_at >= now() - interval '7 days') as users_7d,
  count(distinct split_part(ev.name, '.', 1)) filter (
    where ev.category = 'custom'
      and ev.name not like 'session.%'
  )                                                                             as features_used,
  round(
    100.0 * count(*) filter (where ev.category = 'error') / nullif(count(ev.*), 0),
    2
  )                                                                             as error_rate_pct,
  round(
    100.0 * count(distinct ev.user_id) filter (where ev.occurred_at >= now() - interval '7 days')
          / nullif(count(distinct ev.user_id), 0),
    1
  )                                                                             as stickiness_pct
from public.analytics_portals p
left join ev on ev.portal_id = p.id
group by p.id, p.name
order by users_30d desc nulls last;
