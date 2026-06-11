'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getSupabaseBrowser } from '@/lib/supabase/client';

/**
 * Global header refresh control — SMOOTH LIVE REFRESH.
 *
 * Every refresh path is a soft router.refresh() wrapped in useTransition: the
 * current UI stays on screen and new data swaps in when ready — no full reload,
 * no loading.tsx skeleton, no flash, scroll/expander state preserved.
 *
 * It refreshes:
 *   1. when data changes — a Supabase realtime INSERT on analytics_events fires
 *      a ~2s trailing-debounced soft refresh (whole dashboard reflects new data);
 *   2. on a gentle 60s fallback while the tab is visible (for time-window /
 *      aggregate metrics that change without a new event);
 *   3. on manual click; and once when the tab regains focus.
 *
 * Shows the exact last-updated clock time plus a relative "x ago".
 */
const FALLBACK_MS = 60_000;
const DEBOUNCE_MS = 2_000;

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<number>(() => Date.now());
  const [, force] = useState(0);

  const doRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      try { window.dispatchEvent(new CustomEvent('ncpl:refresh')); } catch { /* no-op */ }
      setLastRefreshed(Date.now());
    });
  }, [router]);

  // Keep the freshest doRefresh reachable from long-lived listeners.
  const refreshRef = useRef(doRefresh);
  refreshRef.current = doRefresh;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  // 1 + 2 + focus: realtime data-driven refresh, gentle fallback, refocus.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { if (visible()) refreshRef.current(); }, DEBOUNCE_MS);
    };

    // (1) Refresh when new analytics data lands.
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null = null;
    try {
      channel = getSupabaseBrowser()
        .channel('analytics:refresh')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_events' }, trigger)
        .subscribe();
    } catch { /* realtime unavailable — fallback interval still covers freshness */ }

    // (2) Gentle fallback — visible-tab only.
    const interval = setInterval(() => { if (visible()) refreshRef.current(); }, FALLBACK_MS);

    // (3) Refresh once when returning to the tab.
    const onVisibility = () => { if (visible()) refreshRef.current(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      try { channel?.unsubscribe(); } catch { /* no-op */ }
    };
  }, []);

  // Tick once a second so the relative label stays live (label only).
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] tabular-nums text-muted-foreground lg:inline" title={`Last updated ${clockTime(lastRefreshed)}`}>
        Updated {clockTime(lastRefreshed)} · {relativeShort(Date.now() - lastRefreshed)}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={doRefresh}
        disabled={isPending}
        aria-label="Refresh dashboard data"
        title="Refresh now — data updates in place"
        className="h-8 gap-1.5 px-2.5 text-xs"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
        <span className="hidden sm:inline">{isPending ? 'Updating…' : 'Refresh'}</span>
      </Button>
    </div>
  );
}

function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function relativeShort(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
