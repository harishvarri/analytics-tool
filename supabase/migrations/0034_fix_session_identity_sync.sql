-- =============================================================================
-- Migration 0034 - Fix session identity sync and error diagnostics
-- =============================================================================
-- Goals:
--   1. When a later event in an anonymous session resolves to a real user,
--      attach the session to that user and rewrite prior anonymous events in
--      the same session.
--   2. Restore the Module G v_error_groups/v_reliability_kpis contract after
--      migration 0024 changed the column shape.
--   3. Add representative stack and metadata payloads for the Reliability UI.
-- =============================================================================

-- Keep analytics_sessions in sync when events arrive. If the event is linked to
-- a user row with a real email, and the session is still anonymous, promote the
-- whole session to that resolved user.
create or replace function public.tg_bump_session_event_count()
returns trigger language plpgsql as $$
declare
  v_event_user_email text;
  v_session_user_email text;
begin
  if new.session_id is null then
    return new;
  end if;

  select email
    into v_event_user_email
    from public.analytics_users
   where id = new.user_id;

  select u.email
    into v_session_user_email
    from public.analytics_sessions s
    left join public.analytics_users u on u.id = s.user_id
   where s.id = new.session_id;

  if new.user_id is not null
     and nullif(v_event_user_email, '') is not null
     and nullif(v_session_user_email, '') is null then
    update public.analytics_sessions
       set user_id = new.user_id,
           event_count = event_count + 1,
           last_seen_at = greatest(last_seen_at, new.occurred_at)
     where id = new.session_id;

    update public.analytics_events e
       set user_id = new.user_id
      from public.analytics_users u
     where e.session_id = new.session_id
       and e.user_id = u.id
       and nullif(u.email, '') is null;

    update public.analytics_events
       set user_id = new.user_id
     where session_id = new.session_id
       and user_id is null;
  else
    update public.analytics_sessions
       set event_count = event_count + 1,
           last_seen_at = greatest(last_seen_at, new.occurred_at)
     where id = new.session_id;
  end if;

  return new;
end $$;

-- Restore the original SLO-facing view contract from 0011, preserving the
-- stronger two-input fingerprint introduced in 0024 and adding debug payloads.
drop view if exists public.v_reliability_kpis cascade;
drop view if exists public.v_error_groups cascade;

create or replace view public.v_error_groups as
with errors as (
  select
    public.error_fingerprint(metadata->>'message', metadata->>'stack') as fingerprint,
    coalesce(metadata->>'message', name) as raw_message,
    nullif(metadata->>'type', '') as error_type,
    nullif(metadata->>'name', '') as error_name,
    metadata->>'stack' as raw_stack,
    metadata as raw_metadata,
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
  (array_agg(e.raw_message order by e.occurred_at desc))[1] as sample_message,
  array_agg(e.error_type order by e.occurred_at desc)
    filter (where e.error_type is not null) as error_types,
  (array_agg(e.error_name order by e.occurred_at desc))[1] as error_name,
  (array_agg(e.raw_stack order by e.occurred_at desc))[1] as sample_stack,
  (array_agg(e.raw_metadata order by e.occurred_at desc))[1] as sample_metadata,
  count(*) as total_occurrences,
  count(distinct e.user_id) filter (where e.user_id is not null) as affected_users,
  count(distinct e.session_id) filter (where e.session_id is not null) as affected_sessions,
  count(distinct e.portal_id) as app_count,
  min(e.occurred_at) as first_seen,
  max(e.occurred_at) as last_seen,
  count(*) filter (where e.occurred_at >= now() - interval '24 hours') as occurrences_24h,
  count(*) filter (where e.occurred_at >= now() - interval '7 days') as occurrences_7d,
  min(e.occurred_at) >= now() - interval '24 hours' as is_new
from errors e
group by e.fingerprint
order by occurrences_24h desc, total_occurrences desc;

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
    (select count(*) from sess_24h) as total_sessions,
    (select count(*) from sess_24h s
      where s.id in (select session_id from errored)) as errored_sessions,
    (select count(*) from public.analytics_events
      where category = 'error'
        and occurred_at >= now() - interval '24 hours') as total_errors_24h,
    (select count(distinct public.error_fingerprint(metadata->>'message', metadata->>'stack'))
      from public.analytics_events
      where category = 'error'
        and occurred_at >= now() - interval '24 hours') as error_groups_24h,
    (select count(distinct user_id) from public.analytics_events
      where category = 'error'
        and occurred_at >= now() - interval '24 hours'
        and user_id is not null) as affected_users_24h,
    (select count(*) from public.v_error_groups where is_new) as new_error_groups_24h
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
  case
    when c.total_sessions > 0
      then round(100.0 * ((100.0 * c.errored_sessions / c.total_sessions) / (100.0 - 99.5)), 1)
    else 0
  end as budget_burn_pct
from counts c;

grant select on public.v_error_groups to authenticated;
grant select on public.v_reliability_kpis to authenticated;

-- Backfill sessions that already contain at least one resolved identified user.
with resolved_sessions as (
  select distinct on (e.session_id)
    e.session_id,
    e.user_id
  from public.analytics_events e
  join public.analytics_users u on u.id = e.user_id
  where e.session_id is not null
    and nullif(u.email, '') is not null
  order by e.session_id, e.occurred_at desc
)
update public.analytics_sessions s
   set user_id = r.user_id
  from resolved_sessions r
 where s.id = r.session_id
   and (
     s.user_id is null
     or exists (
       select 1
       from public.analytics_users existing_user
       where existing_user.id = s.user_id
         and nullif(existing_user.email, '') is null
     )
   );

-- Backfill anonymous events in those sessions to the same resolved user.
with resolved_sessions as (
  select distinct on (e.session_id)
    e.session_id,
    e.user_id
  from public.analytics_events e
  join public.analytics_users u on u.id = e.user_id
  where e.session_id is not null
    and nullif(u.email, '') is not null
  order by e.session_id, e.occurred_at desc
)
update public.analytics_events e
   set user_id = r.user_id
  from resolved_sessions r
 where e.session_id = r.session_id
   and (
     e.user_id is null
     or exists (
       select 1
       from public.analytics_users existing_user
       where existing_user.id = e.user_id
         and nullif(existing_user.email, '') is null
     )
   );
