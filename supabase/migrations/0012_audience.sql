-- =============================================================================
-- Migration 0012 — Module H: Audience & Tech Analytics
-- =============================================================================
-- Surfaces the device/environment context that portals already send in event
-- metadata (browser, os, deviceType, screenResolution, language, timezone).
--
-- Exposed as a SQL function (not a view) so the dashboard's global date-range
-- picker can parameterize the window:  audience_dimensions(p_days := 7)
--
-- Returns one row per (dimension, value) with event / user / session counts.
-- Dimensions: browser, os, device_type, language, timezone, region, screen.
-- "region" is derived from the IANA timezone prefix (e.g. Asia/Kolkata → Asia)
-- as a privacy-safe geo proxy (no IP geolocation).
-- =============================================================================

create or replace function public.audience_dimensions(p_days int default 30)
returns table (
  dimension text,
  value     text,
  events    bigint,
  users     bigint,
  sessions  bigint
)
language sql stable as $$
  with ctx as (
    select
      user_id,
      session_id,
      nullif(metadata->>'browser', '')          as browser,
      nullif(metadata->>'os', '')               as os,
      nullif(metadata->>'deviceType', '')       as device_type,
      nullif(metadata->>'language', '')         as language,
      nullif(metadata->>'timezone', '')         as timezone,
      nullif(metadata->>'screenResolution', '') as screen
    from public.analytics_events
    where occurred_at >= now() - make_interval(days => p_days)
      and metadata ? 'browser'
  ),
  unpivoted as (
    select 'browser'     as dimension, coalesce(browser, 'unknown')                          as value, user_id, session_id from ctx
    union all
    select 'os',          coalesce(os, 'unknown'),                                            user_id, session_id from ctx
    union all
    select 'device_type', coalesce(device_type, 'unknown'),                                   user_id, session_id from ctx
    union all
    select 'language',    coalesce(language, 'unknown'),                                       user_id, session_id from ctx
    union all
    select 'timezone',    coalesce(timezone, 'unknown'),                                       user_id, session_id from ctx
    union all
    select 'region',      coalesce(nullif(split_part(coalesce(timezone, ''), '/', 1), ''), 'unknown'), user_id, session_id from ctx
    union all
    select 'screen',      coalesce(screen, 'unknown'),                                         user_id, session_id from ctx
  )
  select
    dimension,
    value,
    count(*)                                                  as events,
    count(distinct user_id)    filter (where user_id is not null)    as users,
    count(distinct session_id) filter (where session_id is not null) as sessions
  from unpivoted
  group by dimension, value
  order by dimension, users desc, events desc;
$$;
