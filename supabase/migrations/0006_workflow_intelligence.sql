-- ============================================================================
-- 0006_workflow_intelligence.sql
-- ============================================================================
-- Module B — Workflow Intelligence.
--
-- Derives cycle time, throughput, WIP and bottlenecks from the
-- `ticket.status_changed` events emitted by the Sentinel portal. No new
-- ingestion path required — these are views over analytics_events.
--
-- Source event shape (Sentinel):
--   name      = 'ticket.status_changed'
--   metadata  = { ticketKey, fromStatus, toStatus, projectId, severity, trigger }
--
-- Views:
--   v_ticket_transitions       — flattened transitions with typed columns
--   v_ticket_lifecycle         — paired transitions producing dwell_time per status
--   v_cycle_time_by_status     — p50/p75/p95 of dwell per status (last 30d)
--   v_throughput_weekly        — items reaching 'Done' per week per project
--   v_workflow_kpis            — single-row scorecard (median cycle, throughput, WIP)
--   v_aging_tickets            — currently-open tickets aged > stage p75
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Flatten status_changed events into typed columns
-- ---------------------------------------------------------------------------
create or replace view public.v_ticket_transitions as
  select
    e.id                                                  as event_id,
    e.portal_id,
    e.occurred_at,
    (e.metadata->>'ticketKey')                            as ticket_key,
    (e.metadata->>'projectId')                            as project_id,
    (e.metadata->>'fromStatus')                           as from_status,
    (e.metadata->>'toStatus')                             as to_status,
    (e.metadata->>'severity')                             as severity,
    (e.metadata->>'trigger')                              as trigger,
    coalesce(e.user_id::text, e.metadata->>'_user_id')    as actor_id
  from public.analytics_events e
  where e.name in ('ticket.status_changed', 'board.ticket_moved')
    and e.metadata ? 'ticketKey'
    and e.metadata ? 'toStatus';

grant select on public.v_ticket_transitions to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Pair consecutive transitions to compute dwell time per status
--
-- For each (ticket_key, transition), dwell_time = next.occurred_at - this.occurred_at.
-- A NULL next means the ticket is currently in this status (open).
-- ---------------------------------------------------------------------------
create or replace view public.v_ticket_lifecycle as
  select
    t.ticket_key,
    t.project_id,
    t.to_status                                                       as status,
    t.occurred_at                                                     as entered_at,
    lead(t.occurred_at) over (
      partition by t.ticket_key
      order by t.occurred_at
    )                                                                 as exited_at,
    extract(epoch from (
      lead(t.occurred_at) over (
        partition by t.ticket_key
        order by t.occurred_at
      ) - t.occurred_at
    )) / 3600.0                                                       as dwell_hours,
    t.severity,
    t.actor_id
  from public.v_ticket_transitions t;

grant select on public.v_ticket_lifecycle to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Cycle-time distribution per status (last 30 days, completed legs only)
-- ---------------------------------------------------------------------------
create or replace view public.v_cycle_time_by_status as
  select
    status,
    count(*)                                                   as samples,
    percentile_cont(0.50) within group (order by dwell_hours)  as p50_hours,
    percentile_cont(0.75) within group (order by dwell_hours)  as p75_hours,
    percentile_cont(0.95) within group (order by dwell_hours)  as p95_hours,
    avg(dwell_hours)                                           as avg_hours,
    max(dwell_hours)                                           as max_hours
  from public.v_ticket_lifecycle
  where exited_at is not null
    and dwell_hours is not null
    and entered_at >= now() - interval '30 days'
  group by status;

grant select on public.v_cycle_time_by_status to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Weekly throughput — tickets entering 'Done' per ISO week, last 12 weeks
-- ---------------------------------------------------------------------------
create or replace view public.v_throughput_weekly as
  select
    date_trunc('week', t.occurred_at)::date                     as week_start,
    t.project_id,
    count(distinct t.ticket_key)                                as done_count
  from public.v_ticket_transitions t
  where t.to_status = 'Done'
    and t.occurred_at >= date_trunc('week', now() - interval '12 weeks')
  group by 1, 2;

grant select on public.v_throughput_weekly to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Currently-open tickets aging past the stage p75
--
-- Uses v_ticket_lifecycle WHERE exited_at IS NULL to identify the *current*
-- stage of every ticket, then joins to v_cycle_time_by_status to see if
-- dwell is above the historical p75 — flagged as a bottleneck candidate.
-- ---------------------------------------------------------------------------
create or replace view public.v_aging_tickets as
  with current_stage as (
    select
      l.ticket_key,
      l.project_id,
      l.status,
      l.entered_at,
      l.severity,
      extract(epoch from (now() - l.entered_at)) / 3600.0 as current_dwell_hours
    from public.v_ticket_lifecycle l
    where l.exited_at is null
      and l.status not in ('Done')
  )
  select
    c.ticket_key,
    c.project_id,
    c.status,
    c.severity,
    c.entered_at,
    c.current_dwell_hours,
    coalesce(b.p75_hours, 0) as benchmark_p75,
    case
      when b.p75_hours is null then false
      else c.current_dwell_hours > b.p75_hours
    end                                                          as is_aging
  from current_stage c
  left join public.v_cycle_time_by_status b on b.status = c.status
  order by c.current_dwell_hours desc;

grant select on public.v_aging_tickets to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Workflow KPIs — single-row scorecard (used by KPI strip)
-- ---------------------------------------------------------------------------
create or replace view public.v_workflow_kpis as
  select
    -- median end-to-end cycle (Backlog->Done) over last 30d
    (
      select percentile_cont(0.50) within group (order by lifetime_hours)
      from (
        select
          ticket_key,
          extract(epoch from (max(occurred_at) filter (where to_status = 'Done')
                              - min(occurred_at))) / 3600.0 as lifetime_hours
        from public.v_ticket_transitions
        where occurred_at >= now() - interval '30 days'
        group by ticket_key
        having max(occurred_at) filter (where to_status = 'Done') is not null
      ) s
    )                                                            as median_cycle_hours,

    -- throughput: items Done in the trailing 7 days
    (
      select count(distinct ticket_key)
      from public.v_ticket_transitions
      where to_status = 'Done'
        and occurred_at >= now() - interval '7 days'
    )                                                            as throughput_7d,

    -- WIP: tickets currently not in Done
    (
      select count(*) from public.v_aging_tickets
    )                                                            as wip_total,

    -- aging count: tickets above stage p75
    (
      select count(*) from public.v_aging_tickets where is_aging
    )                                                            as aging_count;

grant select on public.v_workflow_kpis to authenticated;
