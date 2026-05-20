-- ============================================================================
-- 0008_retention.sql
-- ============================================================================
-- Module D — User Behavior & Retention.
--
-- Three views, all plain (always fresh):
--   v_user_first_seen      — earliest activity timestamp per user
--   v_retention_cohorts    — % of weekly cohort still active on D1/D7/D30
--   v_dormant_users        — users active in last 30d but silent ≥ 14d
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) First-seen per user (acquisition timestamp)
-- ---------------------------------------------------------------------------
create or replace view public.v_user_first_seen as
  select
    user_id,
    min(occurred_at) as first_seen_at,
    min(occurred_at)::date as acquisition_day,
    date_trunc('week', min(occurred_at))::date as cohort_week
  from public.analytics_events
  where user_id is not null
  group by user_id;

grant select on public.v_user_first_seen to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Weekly cohort retention (D1 / D7 / D30)
--
-- For each cohort_week (last 8 weeks), count:
--   cohort_size — distinct users acquired that week
--   d1_active   — users who had ≥1 event between day 1 and 2 after first_seen
--   d7_active   — users who had ≥1 event between day 7 and 8
--   d30_active  — users who had ≥1 event between day 30 and 31
-- ---------------------------------------------------------------------------
create or replace view public.v_retention_cohorts as
  with cohorts as (
    select user_id, cohort_week, first_seen_at
    from public.v_user_first_seen
    where cohort_week >= (date_trunc('week', now()) - interval '8 weeks')::date
  ),
  retained as (
    select
      c.cohort_week,
      c.user_id,
      bool_or(e.occurred_at >= c.first_seen_at + interval '1 day'
              and e.occurred_at <  c.first_seen_at + interval '2 days')  as d1_active,
      bool_or(e.occurred_at >= c.first_seen_at + interval '7 days'
              and e.occurred_at <  c.first_seen_at + interval '8 days')  as d7_active,
      bool_or(e.occurred_at >= c.first_seen_at + interval '30 days'
              and e.occurred_at <  c.first_seen_at + interval '31 days') as d30_active
    from cohorts c
    left join public.analytics_events e on e.user_id = c.user_id
    group by c.cohort_week, c.user_id
  )
  select
    cohort_week,
    count(*)                                              as cohort_size,
    count(*) filter (where d1_active)                     as d1_active,
    count(*) filter (where d7_active)                     as d7_active,
    count(*) filter (where d30_active)                    as d30_active,
    round(100.0 * count(*) filter (where d1_active)  / nullif(count(*), 0), 1) as d1_pct,
    round(100.0 * count(*) filter (where d7_active)  / nullif(count(*), 0), 1) as d7_pct,
    round(100.0 * count(*) filter (where d30_active) / nullif(count(*), 0), 1) as d30_pct
  from retained
  group by cohort_week
  order by cohort_week desc;

grant select on public.v_retention_cohorts to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Dormant users — active in last 30 days but silent ≥ 14 days
-- ---------------------------------------------------------------------------
create or replace view public.v_dormant_users as
  with last_seen as (
    select user_id, max(occurred_at) as last_seen_at
    from public.analytics_events
    where user_id is not null
      and occurred_at >= now() - interval '60 days'
    group by user_id
  )
  select
    ls.user_id,
    u.email,
    u.display_name,
    ls.last_seen_at,
    extract(epoch from (now() - ls.last_seen_at))::int / 86400 as days_since_active
  from last_seen ls
  left join public.analytics_users u on u.id = ls.user_id
  where ls.last_seen_at < now() - interval '14 days'
    and ls.last_seen_at >= now() - interval '60 days'
  order by ls.last_seen_at asc;

grant select on public.v_dormant_users to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Top user journey paths — most common 2-step sequences (last 7 days)
--
-- For each session, build adjacent event-name pairs (prev, curr) and count
-- the most frequent transitions. Bounded to events_per_session ≤ 20 to keep
-- the result small without a stored procedure.
-- ---------------------------------------------------------------------------
create or replace view public.v_top_journeys as
  with seq as (
    select
      session_id,
      name,
      occurred_at,
      lag(name) over (partition by session_id order by occurred_at) as prev_name
    from public.analytics_events
    where session_id is not null
      and occurred_at >= now() - interval '7 days'
  )
  select
    prev_name as from_event,
    name      as to_event,
    count(*)  as transitions
  from seq
  where prev_name is not null
    and prev_name <> name
  group by prev_name, name
  order by transitions desc
  limit 20;

grant select on public.v_top_journeys to authenticated;
