'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  /**
   * How often to re-fetch server data, in milliseconds.
   * Default: 30 000 (30 s).
   */
  intervalMs?: number;
}

/**
 * Invisible client component that calls `router.refresh()` on a fixed interval,
 * triggering a server-side re-fetch of all `force-dynamic` data on the page
 * without a full navigation. Drop it anywhere inside a server page layout.
 *
 * @example
 * // In a server page component:
 * return (
 *   <>
 *     <AutoRefresh intervalMs={30_000} />
 *     ... page content ...
 *   </>
 * );
 */
export function AutoRefresh({ intervalMs = 30_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
