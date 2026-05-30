-- =============================================================================
-- Migration 0021 — Security fixes (QA audit)
-- =============================================================================

-- BUG-004 fix: the old self-update policy allowed any member to set their own
-- role to 'admin'/'owner' (privilege escalation). Replace it with a policy that
-- only allows updating non-role columns (email, display_name, last_seen_at).
-- Role changes must go through the service-role client (admin tool / support).
drop policy if exists "users: self can update" on public.analytics_users;

create policy "users: self can update non-role columns"
  on public.analytics_users for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- prevent self-escalation: role must remain unchanged
    and role = (select role from public.analytics_users where id = auth.uid())
  );

-- BUG-006 note: ingest key → portalId binding is enforced in application code
-- (lib/api/auth.ts requireIngestKey now validates key matches the event's project).
-- The check is additive so existing portals continue to work.

-- BUG-021 fix: SQL-level count of distinct portals active today (replaces JS Set over 10k rows).
create or replace function public.count_active_portals_today(p_since timestamptz)
returns bigint language sql stable as $$
  select count(distinct portal_id) from public.analytics_events where occurred_at >= p_since;
$$;
