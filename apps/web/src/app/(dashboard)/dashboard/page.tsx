// The Executive Dashboard IS the Operations Center — one canonical command
// center (single source of truth). The implementation lives in ./operations
// and is re-exported here so `/dashboard` (the landing) and `/dashboard/operations`
// render the same page without duplicating logic. The former "Org Overview"
// analytics (sparklines, category donut) lived here previously; its unique
// surfaces now live under dedicated nav items (Live Activity, Project Health).
export { default } from './operations/page';

export const dynamic = 'force-dynamic';
