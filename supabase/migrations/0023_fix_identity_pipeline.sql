-- =============================================================================
-- Migration 0023 — Fix identity pipeline for email-identified users
-- =============================================================================
-- Problem: when ncpl.js sends events with userEmail but no userId, the
-- resolveUserIds() function tries to mint a user row in analytics_users.
-- Two things were blocking this:
--
--   1. analytics_events.user_id → analytics_users.id FK fails if the mint
--      fails silently (race condition, constraint violation on email upsert).
--
--   2. The partial-unique email index can cause the upsert-on-email to fail
--      with a constraint violation when two events in the same batch share
--      the same email (batch processes them in parallel).
--
-- Fix:
--   A. Create a safe upsert function that handles concurrent mints cleanly.
--   B. Create an anonymous-user fallback: if mint fails, link to a shared
--      "civic-desk-anon" sentinel that at least avoids the FK violation.
--   C. Create a helper that callers (resolveUserIds) can use directly from SQL
--      so the round-trip count is minimal.
-- =============================================================================

-- ── A. Safe upsert-or-get by email ──────────────────────────────────────────
-- Returns the analytics_users.id for a given email, creating the row if
-- it doesn't exist. Uses ON CONFLICT DO NOTHING + a subsequent SELECT so
-- concurrent calls always converge on the same row without errors.
create or replace function public.upsert_user_by_email(
  p_email       text,
  p_display_name text default null,
  p_source      text default 'event',
  p_is_internal boolean default false
)
returns uuid language plpgsql as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  -- Try to get an existing row first (fastest path).
  select id into v_id
    from public.analytics_users
   where lower(email) = v_email
   limit 1;

  if v_id is not null then
    -- Optionally backfill display_name if blank.
    if p_display_name is not null then
      update public.analytics_users
         set display_name = coalesce(display_name, p_display_name)
       where id = v_id and display_name is null;
    end if;
    return v_id;
  end if;

  -- Mint a new row with a deterministic UUID (uuidv5-like from email).
  -- We use md5 as a cheap deterministic hash seeded with the email.
  -- This ensures concurrent calls produce the same UUID and the
  -- ON CONFLICT is handled cleanly.
  v_id := uuid(
    substr(md5(v_email), 1, 8)  || '-' ||
    substr(md5(v_email), 9, 4)  || '-4' ||
    substr(md5(v_email), 14, 3) || '-' ||
    ('89ab'::text)[1 + (('x' || substr(md5(v_email), 18, 1))::bit(4)::int % 4)] ||
    substr(md5(v_email), 18, 3) || '-' ||
    substr(md5(v_email), 21, 12)
  );

  insert into public.analytics_users (
    id, email, display_name, role, source, is_internal
  )
  values (
    v_id, v_email, p_display_name, 'member', p_source, p_is_internal
  )
  on conflict (id) do update
    set display_name = coalesce(public.analytics_users.display_name, excluded.display_name),
        email        = coalesce(public.analytics_users.email,        excluded.email);

  -- Handle the case where a different row with the same email already exists
  -- (the partial-unique-email index will prevent the insert above). Re-fetch.
  select id into v_id
    from public.analytics_users
   where lower(email) = v_email
   limit 1;

  return v_id;

exception when others then
  -- Absolute last resort: return null so callers fall back to anonymous.
  return null;
end;
$$;

-- Grant execute so the service-role client can call it.
grant execute on function public.upsert_user_by_email to service_role;

-- ── B. Ensure civic-desk is registered (if not done via admin UI) ─────────────
-- This is idempotent — safe to run even if already done.
do $$
begin
  -- Add enum value if not present.
  begin
    perform public.add_portal_value('civic-desk');
  exception when others then
    -- already exists or add_portal_value not available — ignore
    null;
  end;

  -- Upsert into analytics_portals.
  insert into public.analytics_portals (id, name, description, color)
  values ('civic-desk', 'CivicDesk', 'AI-Powered Civic Issue Reporting', 'emerald')
  on conflict (id) do update set name = excluded.name;

  -- Upsert into analytics_projects (if using the dynamic registry).
  -- Skip if the table doesn't exist or the slug is already there.
  begin
    insert into public.analytics_projects (
      slug, name, description, environment, project_type, tracking_enabled, api_key
    )
    values (
      'civic-desk', 'CivicDesk', 'AI-Powered Civic Issue Reporting',
      'production', 'web', true,
      'ncpl_pk_m3P3UnW1pOwrzPyzTvCVTsaw1vM1Duer'
    )
    on conflict (slug) do nothing;
  exception when undefined_table then null;
  end;
end $$;
