# NCPL Command Center — Operational Intelligence

This platform is an **internal operations/usage intelligence** layer across all NCPL
products — not website/marketing analytics. It answers: who logged in, which products
each person actually uses, who has access but never uses it, what's healthy.

It works for **both** application types:
- **Central-SSO apps** — send events with the central `userId` (uuid). The SSO system
  also pushes the user directory + per-user access (below).
- **Independent apps** (own auth) — send events with the user's **email**
  (`userEmail`); the platform links them to the directory by email.

## 1. Directory sync (central SSO → platform)

`POST https://ncpl-analytics-tool.vercel.app/api/v1/directory`
Header: `x-ncpl-api-key: <DIRECTORY_API_KEY>`

```jsonc
{
  "mode": "full",              // "full" = authoritative snapshot (may deactivate); "delta" = upsert only
  "users": [
    {
      "id": "0b1e…-uuid",       // central user uuid (= analytics_users.id)
      "email": "harish@ncpl.com",
      "name": "Harish",
      "role": "member",
      "department": "Recruitment",
      "team": "EU",
      "title": "Recruiter",
      "status": "active",       // active | inactive | invited
      "isInternal": true,       // employee vs candidate/external
      "allowedProjects": ["nucleus", "galaxy", "atlas"]   // analytics_projects slugs
    }
  ]
}
```
- Idempotent. `full` mode soft-deactivates directory users absent from the snapshot
  (never deletes; guarded by a coverage floor). `delta` never deactivates.
- Unknown project slugs are skipped + reported (onboard the project first via Admin →
  Projects). Call on login + nightly.

## 2. Sending events

Use the `ncpl.js` tag (auto-capture) or `POST /api/v1/events`.

```js
// Central SSO app — identify with the central uuid
window.ncpl.identify('0b1e…-uuid');

// Independent app — identify by email (linked to the directory)
window.ncpl.identify(null, { email: 'harish@ncpl.com', name: 'Harish' });

// Custom domain events (optional) light up Features/Journeys
window.ncpl.track('candidate.created');
```

## 3. What you get
- **Command Center** — org snapshot: active people today, most-used app, inactive
  people, unused access.
- **Access vs Usage** — per app: who's allowed vs who actually uses it, adoption %,
  unused access (licence/permission cleanup).
- **People Directory** — known users by department/team/role, apps used, last active.
- **Inactive Users** — access granted but idle ≥30 days (or never active).
- Plus the existing activity, retention, audience, reliability, performance views.

## Identity resolution rules
- Event has `userId` (uuid) → used as-is; email/name enrich the user row only when blank
  (directory values always win).
- Event has `userEmail` only → resolved to the central user by email; a synthetic
  user is minted (deterministic uuid) if none exists yet.
- Neither → anonymous browser id; **excluded from all people/headcount views**.
