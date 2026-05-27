-- =============================================================================
-- Migration 0011 — Module G: SLO / Reliability Center
-- =============================================================================
-- Views created here:
--   v_error_groups       — errors grouped by normalized fingerprint
--   v_error_rate_trend   — hourly error count + error rate over last 24h
--   v_reliability_kpis   — single-row SLO scorecard (error-free session %, budget burn)
--
-- All error events arrive as: category = 'error', name = 'error.captured',
-- with the human message in metadata->>'message' and an optional
-- metadata->>'type' (e.g. 'boundary') and metadata->>'name' (JS error class).
--
-- "Fingerprint" = the error message with volatile tokens stripped (UUIDs,
-- numbers, hex, quoted strings) so "User 4821 not found" and "User 9 not found"
-- collapse into one group. No AI — pure regex normalization.
-- =============================================================================

-- ─── Helper: normalize an error message into a stable fingerprint ─────────────
create or replace function public.error_fingerprint(p_msg text)
returns text language sql immutable as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(coalesce(p_msg, 'unknown error')),
                '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<id>', 'g'  -- UUIDs
              ),
              '0x[0-9a-f]+', '<hex>', 'g'                                                    -- hex literals
            ),
            '''[^'']*''|"[^"]*"', '<str>', 'g'                                               -- quoted strings
          ),
          '\d+', '<n>', 'g'                                                                  -- bare numbers
        ),
        '\s+', ' ', 'g'                                                                      -- collapse whitespace
      )
    ),
    ''
  )
$$;

-- ─── v_error_groups ───────────────────────────────────────────────────────────
-- One row per distinct fingerprint over the last 30 days.
create or replace view public.v_error_groups as
with errors as (
  select
    public.error_fingerprint(metadata->>'message')      as fingerprint,
    coalesce(metadata->>'message', name)                 as raw_message,
    nullif(metadata->>'type', '')                        as error_type,
    nullif(metadata->>'name', '')                        as error_name,
    portal_id,
    user_id,
    session_id,
    occurred_at
  from public.analytics_events
  where category = 'error'
    and occurred_at >= now() - interval '30 days'
)
select
  e.fingerprint,
  -- A representative human-readable sample (most recent raw message)
  (array_agg(e.raw_message order by e.occurred_at desc))[1]   as sample_message,
  (array_agg(e.error_type order by e.occurred_at desc))
    filter (where e.error_type is not null)                   as error_types,
  (array_agg(e.error_name order by e.occurred_at desc))[1]    as error_name,
  count(*)                                                    as total_occurrences,
  count(distinct e.user_id)    filter (where e.user_id is not null)    as affected_users,
  count(distinct e.session_id) filter (where e.session_id is not null) as affected_sessions,
  count(distinct e.portal_id)                                 as app_count,
  min(e.occurred_at)                                          as first_seen,
  max(e.occurred_at)                                          as last_seen,
  count(*) filter (where e.occurred_at >= now() - interval '24 hours') as occurrences_24h,
  count(*) filter (where e.occurred_at >= now() - interval '7 days')   as occurrences_7d,
  (min(e.occurred_at) >= now() - interval '24 hours')         as is_new
from errors e
group by e.fingerprint
order by occurrences_24h desc, total_occurrences desc;

-- ─── v_error_rate_trend ───────────────────────────────────────────────────────
-- Hourly buckets for the last 24h: error count, total events, error rate %.
create or replace view public.v_error_rate_trend as
with buckets as (
  select generate_series(
    date_trunc('hour', now()) - interval '23 hours',
    date_trunc('hour', now()),
    interval '1 hour'
  ) as bucket
),
hourly as (
  select
    date_trunc('hour', occurred_at)                              as bucket,
    count(*)                                                     as total_events,
    count(*) filter (where category = 'error')                  as error_events
  from public.analytics_events
  where occurred_at >= date_trunc('hour', now()) - interval '23 hours'
  group by 1
)
select
  b.bucket,
  coalesce(h.error_events, 0)  as error_events,
  coalesce(h.total_events, 0)  as total_events,
  case
    when coalesce(h.total_events, 0) > 0
    then round(100.0 * coalesce(h.error_events, 0) / h.total_events, 2)
    else 0
  end                          as error_rate_pct
from buckets b
left join hourly h on h.bucket = b.bucket
order by b.bucket;

-- ─── v_reliability_kpis ───────────────────────────────────────────────────────
-- Single-row SLO scorecard. SLO target is 99.5% error-free sessions over 24h.
-- Error budget = 0.5%; burn = how much of that budget has been consumed.
create or replace view public.v_reliability_kpis as
with sess_24h as (
  select id
  from public.analytics_sessions
  where started_at >= now() - interval '24 hours'
),
errored as (
  select distinct session_id
  from public.analytics_events
  where category = 'error'
    and occurred_at >= now() - interval '24 hours'
    and session_id is not null
),
counts as (
  select
    (select count(*) from sess_24h)                                              as total_sessions,
    (select count(*) from sess_24h s
       where s.id in (select session_id from errored))                           as errored_sessions,
    (select count(*) from public.analytics_events
       where category = 'error' and occurred_at >= now() - interval '24 hours')  as total_errors_24h,
    (select count(distinct public.error_fingerprint(metadata->>'message'))
       from public.analytics_events
       where category = 'error' and occurred_at >= now() - interval '24 hours')  as error_groups_24h,
    (select count(distinct user_id) from public.analytics_events
       where category = 'error' and occurred_at >= now() - interval '24 hours'
         and user_id is not null)                                               as affected_users_24h,
    (select count(*) from public.v_error_groups where is_new)                    as new_error_groups_24h
)
select
  c.total_sessions,
  c.errored_sessions,
  c.total_errors_24h,
  c.error_groups_24h,
  c.affected_users_24h,
  c.new_error_groups_24h,
  99.5::numeric as slo_target_pct,
  case
    when c.total_sessions > 0
    then round(100.0 * (c.total_sessions - c.errored_sessions) / c.total_sessions, 2)
    else 100.0
  end as error_free_pct,
  -- Budget burn: fraction of the 0.5% budget consumed (capped at the metric, can exceed 100%)
  case
    when c.total_sessions > 0
    then round(
      100.0 * ((100.0 * c.errored_sessions / c.total_sessions) / (100.0 - 99.5)),
      1
    )
    else 0
  end as budget_burn_pct
from counts c;
