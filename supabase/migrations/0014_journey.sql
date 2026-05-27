-- =============================================================================
-- Migration 0014 — Module J: Customer Journey Flow (Sankey)
-- =============================================================================
-- Reconstructs the ordered event sequence within each session and aggregates
-- step-to-step transitions, so we can render a Sankey flow:
--
--   step1.event ──▶ step2.event ──▶ step3.event ...
--
-- Same event at different steps is treated as a distinct flow node (no cycles),
-- which is the standard journey-flow model (Amplitude Pathfinder / Mixpanel Flows).
--
-- Exposed as a function so the global date-range picker can parameterize it.
-- =============================================================================

create or replace function public.journey_steps(
  p_days      int default 30,
  p_max_steps int default 5
)
returns table (
  from_step    int,
  from_event   text,
  to_event     text,
  transitions  bigint,
  sessions     bigint
)
language sql stable as $$
  with seq as (
    select
      session_id,
      name,
      row_number() over (partition by session_id order by occurred_at) as step
    from public.analytics_events
    where session_id is not null
      and occurred_at >= now() - make_interval(days => p_days)
      and category <> 'error'
  )
  select
    a.step::int                   as from_step,
    a.name                        as from_event,
    b.name                        as to_event,
    count(*)                      as transitions,
    count(distinct a.session_id)  as sessions
  from seq a
  join seq b
    on  b.session_id = a.session_id
    and b.step       = a.step + 1
  where a.step <= p_max_steps
  group by a.step, a.name, b.name
  order by a.step, count(*) desc;
$$;
