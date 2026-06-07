-- 0037_issue_status.sql
-- Persisted lifecycle status for per-product issues (derived strings).
-- Keyed by a deterministic id (ISS-XXXXXX = hash of product slug + issue text).
-- Resolved/closed issues are filtered out of the active list by the application.

create table if not exists public.issue_status (
  issue_key  text primary key,
  status     text not null default 'open'
               check (status in ('open', 'in_progress', 'resolved', 'closed')),
  note       text,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.issue_status enable row level security;
-- The server uses the service-role key (bypasses RLS); no public policies needed.

comment on table public.issue_status is
  'Lifecycle status for per-product issues, keyed by issueKey() (e.g. ISS-AB12CD).';
