-- 0036_incident_status.sql
-- Persisted lifecycle status for auto-detected incidents.
--
-- Incidents are derived deterministically (Incident.id = INC-XXXXXX, a stable
-- hash of project|category), so we only need to store the *status* keyed by that
-- id. Resolved/closed incidents are filtered out of the active board by the
-- application, so they stop appearing as active problems.

create table if not exists public.incident_status (
  incident_key text primary key,
  status       text not null default 'open'
                 check (status in ('open', 'investigating', 'resolved', 'closed')),
  note         text,
  updated_by   text,
  updated_at   timestamptz not null default now()
);

alter table public.incident_status enable row level security;
-- The server uses the service-role key (bypasses RLS); no public policies needed.

comment on table public.incident_status is
  'Lifecycle status for auto-detected incidents, keyed by Incident.id (e.g. INC-AB12CD).';
