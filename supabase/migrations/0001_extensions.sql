-- ============================================================================
-- 0001_extensions.sql
-- ============================================================================
-- Required Postgres extensions for the NCPL Analytics platform.
-- Run before any other migration.
-- ============================================================================

create extension if not exists "pgcrypto" with schema "extensions";    -- gen_random_uuid()
create extension if not exists "pg_trgm"  with schema "extensions";    -- trigram search on event names
create extension if not exists "btree_gin" with schema "extensions";   -- composite GIN indexes
