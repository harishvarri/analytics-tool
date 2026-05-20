-- ============================================================================
-- seed.sql — non-destructive seed data for local & staging
-- ============================================================================
-- Mirrors src/config/portals.ts. Idempotent via on conflict.
-- ============================================================================

insert into public.analytics_portals (id, name, description, color) values
  ('sentinel',  'Sentinel',           'Internal Sentinel project',      'violet'),
  ('analytics', 'Analytics Platform', 'This platform (self-reporting)', 'slate')
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  color       = excluded.color;
