/**
 * Deprecated: auto-refresh is now owned by the global header <RefreshButton>
 * (components/layout/RefreshButton.tsx), which auto-refreshes every page on an
 * interval AND exposes a manual refresh + "last updated" timestamp.
 *
 * This component is kept as a no-op so the many existing `<AutoRefresh />`
 * call sites don't need to be touched and we avoid a double refresh loop.
 */
export function AutoRefresh(_props: { intervalMs?: number }) {
  return null;
}
