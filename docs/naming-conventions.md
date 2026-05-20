# Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Component files | PascalCase.tsx | `ActivityFeed.tsx` |
| Utility / hook files | kebab-case.ts | `use-realtime-feed.ts` |
| Route segments | kebab-case | `dashboard/realtime` |
| API routes | `route.ts` under kebab-case dirs | `api/v1/analytics/portals/route.ts` |
| React components | PascalCase | `KpiCard` |
| React hooks | `use` + camelCase | `useRealtimeFeed` |
| Types / interfaces | PascalCase, no `I` prefix | `AnalyticsEvent` |
| Enums | PascalCase singular | `EventCategory` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_EVENT_BATCH_SIZE` |
| Zod schemas | camelCase + `Schema` | `trackEventSchema` |
| DB tables | snake_case plural | `analytics_events` |
| DB columns | snake_case | `created_at` |
| Event names | dot.namespaced lowercase | `portal.training.lesson_completed` |
| Env vars (public) | `NEXT_PUBLIC_*` | `NEXT_PUBLIC_SUPABASE_URL` |
| Env vars (server) | UPPER_SNAKE | `SUPABASE_SERVICE_ROLE_KEY` |
