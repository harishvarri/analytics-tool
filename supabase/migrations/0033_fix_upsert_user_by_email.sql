-- =============================================================================
-- Migration 0033 — Fix upsert_user_by_email (emails never resolved to users)
-- =============================================================================
-- Symptom: identified events (userEmail set, e.g. civic-desk login) never
-- produced a named user — Staff Directory showed "Unidentified visitor" and
-- "Named Staff: 0", even though the SDK + ingest + schema were all correct.
--
-- Root cause: the 0025 version of upsert_user_by_email built a "deterministic"
-- UUID with `('89ab'::text)[ ... ]` — subscripting a TEXT value, which is
-- invalid in PostgreSQL and raises at runtime. The function's
-- `exception when others then return null` swallowed that error and returned
-- NULL. resolveUserIds() then saw a null result *without* an exception, so its
-- JS-mint fallback never fired, and the event's user_id stayed null.
--
-- Fix: rewrite the function to mint a plain gen_random_uuid() for new users and
-- handle the concurrent-insert race via the email unique index
-- (unique_violation) instead of a hand-rolled deterministic UUID. No more
-- blanket error swallowing.
-- =============================================================================

create or replace function public.upsert_user_by_email(
  p_email        text,
  p_display_name text    default null,
  p_source       text    default 'event',
  p_is_internal  boolean default false
)
returns uuid language plpgsql as $$
declare
  v_id    uuid;
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    return null;
  end if;

  -- Fast path: already exists.
  select id into v_id
    from public.analytics_users
   where lower(email) = v_email
   limit 1;

  if v_id is not null then
    -- Backfill a display name if we now have one and it was missing.
    if p_display_name is not null then
      update public.analytics_users
         set display_name = coalesce(display_name, p_display_name)
       where id = v_id and display_name is null;
    end if;
    return v_id;
  end if;

  -- Mint a new user. The email unique index guards against races.
  v_id := gen_random_uuid();
  insert into public.analytics_users (id, email, display_name, role, source, is_internal)
  values (v_id, v_email, p_display_name, 'member', p_source, p_is_internal);
  return v_id;

exception when unique_violation then
  -- A concurrent call inserted the same email first — return that row.
  select id into v_id
    from public.analytics_users
   where lower(email) = v_email
   limit 1;
  return v_id;
end;
$$;

grant execute on function public.upsert_user_by_email(text, text, text, boolean) to service_role;
