# Phase 9 — Deployment & DevOps

End-to-end shipping story for the analytics platform.

## Targets

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| Production | `analytics.ncpl.internal` | `main` | Live platform |
| Staging | `staging.analytics.ncpl.internal` | `staging` | Pre-prod soak |
| Preview | `*.vercel.app` | any PR | Per-PR review env |

## Provisioning (one-time)

1. **Supabase project** — create two: `ncpl-analytics-prod`, `ncpl-analytics-staging`.
2. **DB migrations** — `supabase db push` from `supabase/migrations/0001…0004` against each project.
3. **Seed** — run `supabase/seed.sql` once per project (idempotent).
4. **Initial admin** — manually insert one row into `analytics_users` with `role = 'owner'` to bootstrap admin access.
5. **Vercel project** — link this repo, point root to `/`, set `vercel.json` as authoritative.
6. **Vercel env vars** — populate the table below per environment.
7. **Custom domains** — attach in Vercel; DNS via internal infra.
8. **Cron secret rotation policy** — schedule quarterly via the security checklist.

## Environment matrix

| Variable | Where set | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel · all envs | Per-environment Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel · all envs | Public, safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel · server-only | **Secret.** Never expose. |
| `INGEST_API_KEY` | Vercel · server-only | Portal SDK shared secret |
| `IP_HASH_SALT` | Vercel · server-only | Rotate to invalidate historical IP correlations |
| `CRON_SECRET` | Vercel · server-only | Vercel Cron uses this on `authorization` |
| `NEXT_PUBLIC_APP_URL` | Vercel · all envs | Used by SDK self-reporting |
| `LOG_LEVEL` | Vercel · all envs | `info` in prod, `debug` in staging |

All required values are validated at boot by [`lib/env.ts`](apps/web/src/lib/env.ts) — misconfiguration crashes the process loudly instead of failing silently downstream.

## CI/CD

**GitHub Actions** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push to `main` and every PR:

| Job | Command | Purpose |
|---|---|---|
| `lint` | `npm run lint` | ESLint (Next.js config) |
| `typecheck` | `npm run typecheck` | `tsc --noEmit` across workspaces |
| `sdk-build` | `npm run sdk:build` | tsup ESM+CJS+DTS; uploads artifact |
| `web-build` | `npm run build -w apps/web` | Next.js production build with placeholder env vars |

**CodeQL** ([`.github/workflows/codeql.yml`](.github/workflows/codeql.yml)) runs `security-and-quality` query suite on every PR + weekly schedule.

**Dependabot** ([`.github/dependabot.yml`](.github/dependabot.yml)) opens grouped weekly PRs for npm dependencies (Next stack, Supabase, UI, dev), monthly for GitHub Actions.

**Vercel** auto-deploys via `vercel.json`:
- `main` → production
- PRs → preview deploys (URL posted by Vercel bot)

## Scheduled jobs

Defined in [`vercel.json`](vercel.json):

| Path | Schedule | Purpose |
|---|---|---|
| `/api/v1/admin/refresh-aggregates` | `*/5 * * * *` | Concurrent refresh of `mv_portal_daily`, `mv_user_daily`, `mv_feature_usage_30d` |
| `/api/v1/admin/ensure-partitions` | `0 0 1 * *` (monthly) | Pre-creates current + next 2 monthly partitions of `analytics_events` |

Both routes authenticate with `CRON_SECRET` via the `authorization: Bearer …` header Vercel Cron sends automatically.

## Monitoring strategy

| Signal | Source | Threshold | Channel |
|---|---|---|---|
| Ingestion error rate | Vercel logs · `withApiHandler` `level=error` count | > 1% over 5 min | Slack #analytics-oncall |
| Dashboard 5xx | Vercel logs on `/dashboard/*` | > 0.5% over 5 min | Slack #analytics-oncall |
| Cron failures | Vercel Cron run history | any non-2xx | Email + Slack |
| Realtime channel errors | Browser dashboards (`ConnectionPill` state) | persistent `error` state | Operator-driven |
| DB CPU / connection pool | Supabase project metrics | > 75% sustained 10 min | PagerDuty |
| MV staleness | Last `refresh_analytics_aggregates` timestamp | > 15 min | Daily report |

Structured `pino` logs include `requestId`, so any alert can be traced from client → server → DB with one grep.

## Production readiness checklist

Before each major release:

- [ ] All migrations applied (`supabase db push` against prod)
- [ ] Env vars match the matrix above in Vercel production scope
- [ ] `CRON_SECRET` rotated within the last 90 days
- [ ] `INGEST_API_KEY` rotated within the last 90 days
- [ ] At least one row in `analytics_users` with role `owner`
- [ ] `REPLICA IDENTITY FULL` confirmed on `analytics_events` + `analytics_sessions`
- [ ] `supabase_realtime` publication includes both tables
- [ ] One end-to-end test event from each portal landed in the live dashboard
- [ ] CI green on the deploy SHA
- [ ] Vercel Cron runs visible and succeeding
- [ ] Sentry / Datadog (or equivalent) wired into the SDK `onDrop` callback in each portal
- [ ] Security headers verified via [securityheaders.com](https://securityheaders.com)
- [ ] HSTS preloading enabled and the domain submitted to [hstspreload.org](https://hstspreload.org/)
- [ ] WAF rules at the edge (Vercel / Cloudflare) covering `/api/v1/events`
- [ ] Runbook owner assigned in `docs/runbook.md` (Phase 10 territory)

## Rollback

```bash
# Vercel UI → Deployments → previous deployment → Promote to Production
# Or via CLI:
vercel rollback <deployment-url>
```

DB rollback is by **forward-only migration** — never run a backwards migration in prod. If schema needs reverting, ship a new migration that undoes the change.

## What's NOT here (future)

- IaC for Supabase (currently provisioned via dashboard)
- Cross-region read replicas
- Synthetic uptime probing
- Per-portal usage quotas
- Audit trail of admin actions
