'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Global header refresh control — MANUAL ONLY.
 *
 * Clicking it does a soft router.refresh(): every server component on the
 * current page (KPIs, charts, tables) re-fetches and updates in place — no
 * full-page reload, no flash, scroll position and client state preserved.
 * There is deliberately NO automatic/interval refresh: auto-reloading the tab
 * while someone is working is disruptive, so refreshing only happens on click.
 * A passive "Updated Xs ago" label keeps data-freshness visible.
 */
export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<number>(() => Date.now());
  const [, force] = useState(0);

  const doRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      // Let client-only surfaces (e.g. the live feed) reset if they listen.
      try { window.dispatchEvent(new CustomEvent('ncpl:refresh')); } catch { /* no-op */ }
      setLastRefreshed(Date.now());
    });
  }, [router]);

  // Tick once a second so the "x ago" label stays live (label only — never refreshes).
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] tabular-nums text-muted-foreground lg:inline">
        Updated {relativeShort(Date.now() - lastRefreshed)}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={doRefresh}
        disabled={isPending}
        aria-label="Refresh dashboard data"
        title="Refresh this page's data"
        className="h-8 gap-1.5 px-2.5 text-xs"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
        <span className="hidden sm:inline">{isPending ? 'Refreshing…' : 'Refresh'}</span>
      </Button>
    </div>
  );
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
