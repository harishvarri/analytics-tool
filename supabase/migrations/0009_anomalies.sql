-- ============================================================================
-- 0009_anomalies.sql
-- ============================================================================
-- Module E — Statistical Anomaly Alerts.
--
-- Pure statistical detection (no ML, no external APIs):
--   1. Bucket each (portal, event_name) into hourly counts for the last 8 days
--   2. Treat the 7 days BEFORE the most recent hour as the baseline
--   3. Compute mean + stddev for each (portal, event_name)
--   4. Flag the most recent hour where |z-score| > 2  (≈ 2-sigma rule)
--
-- The view returns a *current* anomaly snapshot — fast enough to query on
-- every page load. Re-runs on each select; no MV.
-- ============================================================================

create or replace view public.v_anomaly_signals as
  with hourly as (
    -- Hourly bucket counts per (portal, event_name) over the last 8 days
    select
      portal_id,
      name as event_name,
      date_trunc('hour', occurred_at) as hour,
      count(*)::numeric               as events
    from public.analytics_events
    where occurred_at >= now() - interval '8 days'
    group by portal_id, name, date_trunc('hour', occurred_at)
  ),
  baseline as (
    -- For each (portal, event_name): mean + stddev over the 7-day baseline,
    -- excluding the most recent hour (which we're testing against)
    select
      portal_id,
      event_name,
      avg(events)        as baseline_mean,
      stddev_pop(events) as baseline_std,
      count(*)           as baseline_samples,
      max(hour)          as last_baseline_hour
    from hourly
    where hour <  date_trunc('hour', now())
      and hour >= date_trunc('hour', now()) - interval '7 days'
    group by portal_id, event_name
    having count(*) >= 24   -- require at least one day of data
  ),
  current_hour as (
    -- Current hour activity
    select portal_id, event_name, hour, events
    from hourly
    where hour = date_trunc('hour', now()) - interval '1 hour'   -- previous full hour
  )
  select
    b.portal_id,
    b.event_name,
    coalesce(c.events, 0)                                   as current_events,
    round(b.baseline_mean, 2)                               as baseline_mean,
    round(b.baseline_std,  2)                               as baseline_std,
    b.baseline_samples,
    c.hour                                                  as observed_hour,
    case
      when b.baseline_std = 0 or b.baseline_std is null then 0
      else round((coalesce(c.events, 0) - b.baseline_mean) / b.baseline_std, 2)
    end                                                     as z_score,
    case
      when b.baseline_std = 0 or b.baseline_std is null then 'normal'
      when abs((coalesce(c.events, 0) - b.baseline_mean) / b.baseline_std) >= 3 then 'critical'
      when abs((coalesce(c.events, 0) - b.baseline_mean) / b.baseline_std) >= 2 then 'warning'
      else 'normal'
    end                                                     as severity,
    case
      when coalesce(c.events, 0) > b.baseline_mean then 'spike'
      else 'dip'
    end                                                     as direction
  from baseline b
  left join current_hour c
    on c.portal_id = b.portal_id and c.event_name = b.event_name
  -- Surface only anomalies and only metrics with enough volume to matter
  where (
    b.baseline_std is not null
    and b.baseline_std > 0
    and abs((coalesce(c.events, 0) - b.baseline_mean) / b.baseline_std) >= 2
    and (b.baseline_mean >= 3 or coalesce(c.events, 0) >= 3)
  )
  order by abs(case
    when b.baseline_std = 0 or b.baseline_std is null then 0
    else (coalesce(c.events, 0) - b.baseline_mean) / b.baseline_std
  end) desc
  limit 50;

grant select on public.v_anomaly_signals to authenticated;
