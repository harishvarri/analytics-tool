-- =============================================================================
-- Migration 0016 — Module L: Smart Insights & Feature Intelligence
-- =============================================================================
-- Rule-based ("no external AI") week-over-week deltas that the repository turns
-- into human-readable insight cards, e.g.:
--   "QA feature engagement increased 38% this week"
--   "Board usage dropped 45% week-over-week"
--   "Login failures spiked 3×"
--
--   v_feature_wow  — per-feature distinct users this week vs last week
--   v_metric_wow   — platform metrics (active users, sessions, logins, errors)
--                    this week vs last week
-- =============================================================================

-- ─── v_feature_wow ────────────────────────────────────────────────────────────
create or replace view public.v_feature_wow as
with tagged as (
  select
    split_part(name, '.', 1) as feature,
    user_id,
    case
      when occurred_at >= now() - interval '7 days'                                          then 'this'
      when occurred_at >= now() - interval '14 days' and occurred_at < now() - interval '7 days' then 'last'
    end as bucket
  from public.analytics_events
  where occurred_at >= now() - interval '14 days'
    and category = 'custom'
    and name not like 'session.%'
    and name not like 'auth.%'
    and name not like 'navigation.%'
)
select
  feature,
  count(distinct user_id) filter (where bucket = 'this') as users_this,
  count(distinct user_id) filter (where bucket = 'last') as users_last
from tagged
where bucket is not null
group by feature
order by users_this desc;

-- ─── v_metric_wow ─────────────────────────────────────────────────────────────
-- One row per platform metric with this-week / last-week values.
create or replace view public.v_metric_wow as
with tagged as (
  select
    user_id,
    session_id,
    category,
    name,
    case
      when occurred_at >= now() - interval '7 days'                                          then 'this'
      when occurred_at >= now() - interval '14 days' and occurred_at < now() - interval '7 days' then 'last'
    end as bucket
  from public.analytics_events
  where occurred_at >= now() - interval '14 days'
)
select 'active_users' as metric,
       count(distinct user_id) filter (where bucket = 'this') as value_this,
       count(distinct user_id) filter (where bucket = 'last') as value_last
from tagged where bucket is not null
union all
select 'sessions',
       count(distinct session_id) filter (where bucket = 'this'),
       count(distinct session_id) filter (where bucket = 'last')
from tagged where bucket is not null
union all
select 'logins',
       count(*) filter (where bucket = 'this' and name = 'auth.login'),
       count(*) filter (where bucket = 'last' and name = 'auth.login')
from tagged where bucket is not null
union all
select 'errors',
       count(*) filter (where bucket = 'this' and category = 'error'),
       count(*) filter (where bucket = 'last' and category = 'error')
from tagged where bucket is not null
union all
select 'login_failures',
       count(*) filter (where bucket = 'this' and name = 'auth.login_failed'),
       count(*) filter (where bucket = 'last' and name = 'auth.login_failed')
from tagged where bucket is not null;
