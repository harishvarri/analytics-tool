## Summary

<!-- 1-3 bullet points on what this change does -->

## Why

<!-- The problem this solves. Link the issue if one exists. -->

## Test plan

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Local smoke (`/dashboard` renders, `POST /api/v1/events` accepts a sample payload)
- [ ] If SDK changed: `npm run sdk:build` clean and a consumer example still imports without errors

## Phase / Area

<!-- e.g. Phase 4 — API · ingestion · adds Zod strict mode -->

## Rollout notes

<!-- Migrations, env additions, breaking SDK changes, etc. Leave blank if none. -->
