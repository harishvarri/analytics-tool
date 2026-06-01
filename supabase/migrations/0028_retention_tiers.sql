-- =============================================================================
-- Migration 0028 — Tiered retention (archive business-critical, drop the rest)
-- =============================================================================
-- The "event explosion" risk: at scale (1M+ events/day) keeping every page_view
-- and perf sample forever is wasteful. Strategy:
--
--   * Raw events live in monthly range partitions (0002).
--   * business_critical events (importance from 0027) are copied into a
--     permanent, non-partitioned archive BEFORE an old partition is dropped.
--   * Partitions fully older than the raw-retention window (default 90d) are
--     detached and dropped — far cheaper than per-row DELETEs.
--
-- This keeps business history forever while high-volume Tier-2/3 noise ages out.
-- =============================================================================

-- ── Permanent archive (Tier-1 events kept forever) ──────────────────────────
-- Same columns as analytics_events but NOT partitioned and no FK constraints
-- (the referenced rows may themselves age out). Append-only.
create table if not exists public.analytics_events_archive (
  id           uuid not null,
  portal_id    text not null,
  category     text not null,
  name         text not null,
  source       text,
  user_id      uuid,
  session_id   uuid,
  url          text,
  referrer     text,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null,
  archived_at  timestamptz not null default now(),
  primary key (id, occurred_at)
);

create index if not exists analytics_events_archive_occurred_idx
  on public.analytics_events_archive (occurred_at desc);
create index if not exists analytics_events_archive_portal_idx
  on public.analytics_events_archive (portal_id, occurred_at desc);
create index if not exists analytics_events_archive_name_idx
  on public.analytics_events_archive (name);

-- ── Retention enforcement ────────────────────────────────────────────────────
-- For each child partition of analytics_events whose UPPER bound is older than
-- (now - p_raw_days): archive its business_critical rows, then detach+drop it.
-- Returns the number of partitions dropped.
create or replace function public.enforce_event_retention(p_raw_days int default 90)
returns int language plpgsql security definer set search_path = public as $$
declare
  cutoff       timestamptz := date_trunc('day', now()) - make_interval(days => p_raw_days);
  part         record;
  upper_bound  timestamptz;
  bound_expr   text;
  dropped      int := 0;
begin
  for part in
    select c.oid, c.relname, pg_get_expr(c.relpartbound, c.oid) as bound
    from pg_inherits i
    join pg_class c     on c.oid = i.inhrelid
    join pg_class p     on p.oid = i.inhparent
    where p.relname = 'analytics_events'
      and c.relname <> 'analytics_events_default'   -- never drop the catch-all
  loop
    -- bound looks like: FOR VALUES FROM ('2026-05-01...') TO ('2026-06-01...')
    -- Extract the TO timestamp (the partition's exclusive upper bound).
    bound_expr := substring(part.bound from 'TO \(''([0-9]{4}-[0-9]{2}-[0-9]{2}[^'']*)''\)');
    if bound_expr is null then
      continue; -- unparseable / not a range partition we manage
    end if;
    upper_bound := bound_expr::timestamptz;

    if upper_bound <= cutoff then
      -- 1) Archive business-critical events from this partition.
      execute format(
        'insert into public.analytics_events_archive
           (id, portal_id, category, name, source, user_id, session_id, url, referrer, metadata, occurred_at)
         select id, portal_id::text, category::text, name, source::text, user_id, session_id, url, referrer, metadata, occurred_at
         from public.%I
         where metadata->>''_importance'' = ''business_critical''
         on conflict (id, occurred_at) do nothing',
        part.relname
      );

      -- 2) Detach and drop the whole partition (cheap; reclaims space instantly).
      execute format('alter table public.analytics_events detach partition public.%I', part.relname);
      execute format('drop table public.%I', part.relname);
      dropped := dropped + 1;

      raise notice 'Retention: archived + dropped partition % (upper bound %)', part.relname, upper_bound;
    end if;
  end loop;

  return dropped;
end;
$$;

grant select on public.analytics_events_archive to authenticated;
