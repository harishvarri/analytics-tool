# Phase 5 — Enterprise Analytics Dashboard UI

## What you see

| Page | Source | Highlights |
|---|---|---|
| `/dashboard` | [page.tsx](apps/web/src/app/(dashboard)/dashboard/page.tsx) | 4 KPI cards · 24h area chart · category donut · portal stat rows · live activity |
| `/dashboard/users` | [users/page.tsx](apps/web/src/app/(dashboard)/dashboard/users/page.tsx) | Sortable user table with status badges |
| `/dashboard/portals` | [portals/page.tsx](apps/web/src/app/(dashboard)/dashboard/portals/page.tsx) | Bar chart + per-portal stat cards + registry chips |
| `/dashboard/realtime` | [realtime/page.tsx](apps/web/src/app/(dashboard)/dashboard/realtime/page.tsx) | Per-portal mini cards + 40-item activity stream |
| `/dashboard/reports` | [reports/page.tsx](apps/web/src/app/(dashboard)/dashboard/reports/page.tsx) | Card grid for saved/scheduled reports |

## Architecture

```
Server Component page
  └─ fetchers from lib/data/fetchers.ts   ← graceful fallback to mock
       ├─ repositories/*                  ← real Supabase queries
       └─ lib/mock/dashboard.ts           ← deterministic mock generators
  └─ <KpiCard>, <ChartCard>, <ActivityFeed>, <PortalStatRow>, <DataTable>
  └─ <AreaChart>, <BarChart>, <DonutChart>, <Sparkline>   (Recharts wrappers)
```

**Graceful fallback** — every page calls `fetchX()` which tries the live repository, then falls back to mock data on any error. So the UI renders end-to-end demos with zero infrastructure. Replacing mock with live data in prod is a no-op once Supabase is wired up.

## Component library

- **`components/analytics/`** — domain components: `KpiCard`, `EventBadge`, `ActivityFeed`, `PortalStatRow`, `DataTable`, `PageHeader`.
- **`components/charts/`** — Recharts wrappers: `AreaChart`, `BarChart`, `DonutChart`, `Sparkline`, plus the `ChartCard` container and `ChartTheme` color tokens.
- **`components/shared/`** — `Skeletons`, `EmptyState`, `ErrorState`, `ThemeToggle`.

## Visual system

- Slate base palette (shadcn default), dark/light via `next-themes`.
- Accent colors per portal (sky/violet/emerald/amber/rose/slate) tied through [ChartTheme.ts](apps/web/src/components/charts/ChartTheme.ts) → consistent in badges, donuts, bars, sparklines.
- Per-category event badges with subtle tinted backgrounds (`*-500/10`) and borders (`*-500/30`).
- Hover shadow on cards (`hover:shadow-md`) and row hover tint on tables.
- KPI trend arrows colored by direction; `invertTrend` flag flips green/red for metrics where up is bad (error rate).

## Loading + empty states

- `/dashboard/loading.tsx` ships a matching skeleton: header + 4 KPI skeletons + 3 chart skeletons.
- `EmptyState` and `ErrorState` are reusable across every feature.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx next lint` | no warnings or errors |
| `npx next build` | 14 routes, success — `/dashboard` first-load 224 kB (Recharts included) |
