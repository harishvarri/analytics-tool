-- ============================================================================
-- 0007_project_health.sql
-- ============================================================================
-- Module C — Project Health Index (PHI).
--
-- Composite 0-100 health score per project from three normalized inputs:
--
--   PHI = 0.40·Velocity_norm + 0.30·Quality_norm + 0.30·OnTrack_norm
--
-- Where:
--   Velocity_norm  -- recent throughput vs the project's own prior baseline
--   Quality_norm   -- 100 - (bug-to-ticket ratio × 100)
--   OnTrack_norm   -- 100 - (aging-tickets / open × 100)
--
-- Status tiers:
--   Healthy   PHI ≥ 75
--   At risk   50 ≤ PHI < 75
--   Critical  PHI < 50
--
-- All views are plain (non-materialized) so they're always fresh and don't
-- depend on a cron refresh.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Project name lookup
--
-- Sentinel emits `project.viewed` events with { projectId, projectName }.
-- We take the most recent name per projectId. If no project.viewed events
-- exist for a project, we fall back to the truncated UUID in the app layer.
-- ---------------------------------------------------------------------------
create or replace view public.v_project_names as
  select distinct on ((e.metadata->>'projectId'))
    (e.metadata->>'projectId')   as project_id,
    (e.metadata->>'projectName') as project_name
  from public.analytics_events e
  where e.name = 'project.viewed'
    and e.metadata ? 'projectId'
    and e.metadata ? 'projectName'
    and e.metadata->>'projectName' is not null
  order by (e.metadata->>'projectId'), e.occurred_at desc;

grant select on public.v_project_names to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Velocity per project
--
-- done_28d        — tickets reaching Done in last 28 days
-- done_prev_28d   — tickets reaching Done in the 28 days BEFORE that
-- velocity_norm   — done_28d / max(done_prev_28d, 1) × 100, capped at 150
--                   then normalised to 0-100 so steady = 100, accelerating > 100,
--                   slowing < 100. For projects with no prior baseline
--                   we target a "healthy" 5/week throughput.
-- ---------------------------------------------------------------------------
create or replace view public.v_project_velocity as
  with done_recent as (
    select
      (metadata->>'projectId') as project_id,
      count(distinct (metadata->>'ticketKey')) as done_28d
    from public.analytics_events
    where name in ('ticket.status_changed', 'board.ticket_moved')
      and (metadata->>'toStatus') = 'Done'
      and occurred_at >= now() - interval '28 days'
      and metadata ? 'projectId'
    group by 1
  ),
  done_prior as (
    select
      (metadata->>'projectId') as project_id,
      count(distinct (metadata->>'ticketKey')) as done_prev_28d
    from public.analytics_events
    where name in ('ticket.status_changed', 'board.ticket_moved')
      and (metadata->>'toStatus') = 'Done'
      and occurred_at >= now() - interval '56 days'
      and occurred_at <  now() - interval '28 days'
      and metadata ? 'projectId'
    group by 1
  )
  select
    coalesce(r.project_id, p.project_id) as project_id,
    coalesce(r.done_28d, 0)              as done_28d,
    coalesce(p.done_prev_28d, 0)         as done_prev_28d,
    case
      -- No prior baseline: score against target throughput of ~20/month (5/week)
      when coalesce(p.done_prev_28d, 0) = 0 then
        least(100, round(coalesce(r.done_28d, 0)::numeric / 20.0 * 100, 1))
      -- Otherwise: ratio against own baseline, capped at 100 (over-performing also healthy)
      else
        least(100, round(coalesce(r.done_28d, 0)::numeric / p.done_prev_28d * 100, 1))
    end as velocity_norm
  from done_recent r
  full outer join done_prior p on p.project_id = r.project_id;

grant select on public.v_project_velocity to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Quality per project — bug-to-work ratio (last 28 days)
--
-- bug_count       — distinct events named 'bug.reported' (Sentinel emits these)
-- ticket_count    — distinct events named 'ticket.created' OR 'bug.reported'
-- quality_norm    — 100 - (bugs / total * 100), clamped to [0, 100]
-- ---------------------------------------------------------------------------
create or replace view public.v_project_quality as
  with recent as (
    select
      (metadata->>'projectId') as project_id,
      name,
      (metadata->>'ticketKey') as ticket_key
    from public.analytics_events
    where name in ('ticket.created', 'bug.reported')
      and occurred_at >= now() - interval '28 days'
      and metadata ? 'projectId'
  )
  select
    project_id,
    count(*) filter (where name = 'bug.reported')                       as bug_count,
    count(*)                                                            as work_count,
    case
      when count(*) = 0 then 100
      else greatest(0, round(100 - (count(*) filter (where name = 'bug.reported')::numeric / count(*)) * 100, 1))
    end                                                                 as quality_norm
  from recent
  group by project_id;

grant select on public.v_project_quality to authenticated;

-- ---------------------------------------------------------------------------
-- 4) On-track per project — currently-open tickets within their stage p75
--
-- Reuses v_aging_tickets from migration 0006. ontrack_norm is the inverse of
-- aging ratio: a project where 0% of open tickets are aging scores 100.
-- ---------------------------------------------------------------------------
create or replace view public.v_project_ontrack as
  select
    project_id,
    count(*) filter (where is_aging)              as aging_count,
    count(*)                                      as open_count,
    case
      when count(*) = 0 then 100
      else greatest(0, round(100 - (count(*) filter (where is_aging)::numeric / count(*)) * 100, 1))
    end                                           as ontrack_norm
  from public.v_aging_tickets
  where project_id is not null
  group by project_id;

grant select on public.v_project_ontrack to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Composite Project Health Index
--
-- Combines the three normalised inputs via the published weights.
-- Returns one row per project that has appeared in ANY of the three sources.
-- ---------------------------------------------------------------------------
create or replace view public.v_project_health as
  with all_projects as (
    select project_id from public.v_project_velocity where project_id is not null
    union
    select project_id from public.v_project_quality  where project_id is not null
    union
    select project_id from public.v_project_ontrack  where project_id is not null
  )
  select
    a.project_id,
    coalesce(n.project_name, 'Project ' || substr(a.project_id, 1, 8))     as project_name,
    coalesce(v.velocity_norm,  50)                                          as velocity_norm,
    coalesce(q.quality_norm,  100)                                          as quality_norm,
    coalesce(o.ontrack_norm,  100)                                          as ontrack_norm,
    round(
      0.40 * coalesce(v.velocity_norm, 50)
    + 0.30 * coalesce(q.quality_norm, 100)
    + 0.30 * coalesce(o.ontrack_norm, 100)
    , 1)                                                                    as phi_score,
    coalesce(v.done_28d,       0)                                           as done_28d,
    coalesce(v.done_prev_28d,  0)                                           as done_prev_28d,
    coalesce(q.bug_count,      0)                                           as bug_count,
    coalesce(q.work_count,     0)                                           as work_count,
    coalesce(o.aging_count,    0)                                           as aging_count,
    coalesce(o.open_count,     0)                                           as open_count,
    case
      when round(
        0.40 * coalesce(v.velocity_norm, 50)
      + 0.30 * coalesce(q.quality_norm, 100)
      + 0.30 * coalesce(o.ontrack_norm, 100)
      , 1) >= 75                                                            then 'healthy'
      when round(
        0.40 * coalesce(v.velocity_norm, 50)
      + 0.30 * coalesce(q.quality_norm, 100)
      + 0.30 * coalesce(o.ontrack_norm, 100)
      , 1) >= 50                                                            then 'at_risk'
      else                                                                       'critical'
    end                                                                     as health_tier
  from all_projects a
  left join public.v_project_names    n on n.project_id = a.project_id
  left join public.v_project_velocity v on v.project_id = a.project_id
  left join public.v_project_quality  q on q.project_id = a.project_id
  left join public.v_project_ontrack  o on o.project_id = a.project_id;

grant select on public.v_project_health to authenticated;
