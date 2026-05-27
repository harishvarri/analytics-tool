-- =============================================================================
-- Migration 0013 — Module I: Funnel Analytics
-- =============================================================================
-- Funnels are computed with "first-touch ordered" semantics: a user reaches
-- step N if the first time they fired step N's event is at or after the first
-- time they fired step N-1's event. This is the standard medium-complexity
-- funnel model (Mixpanel/Amplitude "ordered, first occurrence").
--
-- The heavy lifting (sequence + drop-off) is done in the repository in JS over
-- a small per-user/per-event first-occurrence set. This view provides that set
-- efficiently and is reusable by journey/path features too.
-- =============================================================================

create or replace view public.v_event_first_times as
select
  user_id,
  name,
  min(occurred_at) as first_at
from public.analytics_events
where user_id is not null
  and occurred_at >= now() - interval '90 days'
group by user_id, name;

comment on view public.v_event_first_times is
  'Per-user earliest occurrence of each event name (90d). Powers funnel + path analytics.';
