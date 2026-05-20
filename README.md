# NCPL Analytics Tool

Centralized internal enterprise analytics platform for **NCPL Consultancy**.

Ingests events from internal portals (Training, Project Management, Resume Marketing, Job Application, Admin, and future apps) via a reusable SDK, and exposes realtime dashboards, user/portal/session analytics, and reporting.

## Stack

- **Frontend:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · TailwindCSS · shadcn/ui · Recharts · TanStack Query
- **Backend:** Next.js API Routes · Supabase (PostgreSQL · Auth · Realtime)
- **Infra:** Vercel · GitHub Actions

## Workspace Layout

```
ncpl-analytics-tool/
├── apps/web              # Next.js dashboard (the platform)
├── packages/sdk          # @ncpl/analytics-sdk (reusable tracking SDK)
├── supabase              # SQL migrations & seed
└── docs                  # Architecture & conventions
```

## Quick Start

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the web app in dev mode |
| `npm run build` | Build the web app |
| `npm run lint` | ESLint across the web app |
| `npm run typecheck` | TypeScript check across workspaces |
| `npm run format` | Prettier write |
| `npm run sdk:build` | Build the analytics SDK |

## Phased Roadmap

| Phase | Doc |
|---|---|
| 1 — Foundation | scaffolding · npm workspaces · `apps/web` + `packages/sdk` |
| 2 — Database | [docs/phases/phase-2-database.md](docs/phases/phase-2-database.md) |
| 3 — Analytics SDK | [packages/sdk/README.md](packages/sdk/README.md) |
| 4 — Backend API | [docs/phases/phase-4-api.md](docs/phases/phase-4-api.md) |
| 5 — Dashboard UI | [docs/phases/phase-5-ui.md](docs/phases/phase-5-ui.md) |
| 6 — Realtime | [docs/phases/phase-6-realtime.md](docs/phases/phase-6-realtime.md) |
| 7 — Portal Integrations | [docs/phases/phase-7-integration.md](docs/phases/phase-7-integration.md) · [examples/](examples/) |
| 8 — Production Hardening | [docs/phases/phase-8-hardening.md](docs/phases/phase-8-hardening.md) |
| 9 — Deployment & DevOps | [docs/phases/phase-9-deployment.md](docs/phases/phase-9-deployment.md) |

Architecture overview: [`docs/architecture.md`](docs/architecture.md).
