-- ============================================================================
-- 0005_allow_portal_users.sql
-- ============================================================================
-- Problem: analytics_users.id has an FK → auth.users(id). This blocks portals
-- (e.g. Sentinel) from tracking their users because those users live in the
-- portal's own Supabase project — not this one's auth.users.
--
-- Fix: drop only the FK reference to auth.users while keeping the UUID PK on
-- analytics_users. The cascade trigger on auth.users is also removed because
-- portal users are not local auth accounts. This project's own admins/owners
-- are still stored in analytics_users (just without the auth FK).
--
-- After this migration:
--   - Any UUID can be upserted into analytics_users (e.g. Sentinel user IDs)
--   - analytics_events.user_id → analytics_users.id still works (FK stays)
--   - The realtime view and user dashboards show real portal user activity
-- ============================================================================

-- Drop the FK that forces analytics_users.id to exist in auth.users.
-- The primary key (UUID) on analytics_users.id is preserved.
do $$
declare
  v_constraint text;
begin
  select constraint_name
    into v_constraint
    from information_schema.table_constraints
   where table_schema = 'public'
     and table_name   = 'analytics_users'
     and constraint_type = 'FOREIGN KEY'
   limit 1;

  if v_constraint is not null then
    execute format('alter table public.analytics_users drop constraint %I', v_constraint);
    raise notice 'Dropped FK constraint % from analytics_users', v_constraint;
  else
    raise notice 'No FK constraint found on analytics_users — already clean';
  end if;
end $$;

-- Drop the auth.users mirror trigger (no longer valid without the FK).
-- Portals handle their own auth; this project's analytics_users is now
-- populated by the ingest pipeline, not by Supabase Auth hooks.
drop trigger if exists on_auth_user_created on auth.users;
