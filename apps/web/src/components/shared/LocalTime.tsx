'use client';

import { useEffect, useState } from 'react';

type Mode = 'time' | 'datetime' | 'date';

/**
 * Renders an absolute timestamp in the VIEWER's local timezone.
 *
 * Server components format dates on the server (Vercel = UTC), so a 1:22 PM IST
 * login would render as "7:52 AM". This formats on the client after mount, so
 * everyone sees their own local time. Until mounted it shows a neutral
 * placeholder rather than the wrong (UTC) time.
 */
export function LocalTime({
  iso,
  mode = 'time',
  fallback = '—',
}: {
  iso: string | null | undefined;
  mode?: Mode;
  fallback?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) { setText(fallback); return; }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) { setText(fallback); return; }
    const opts: Intl.DateTimeFormatOptions =
      mode === 'date' ? { dateStyle: 'medium' }
      : mode === 'datetime' ? { dateStyle: 'medium', timeStyle: 'short' }
      : { hour: 'numeric', minute: '2-digit' };
    setText(d.toLocaleString(undefined, opts));
  }, [iso, mode, fallback]);

  return <span suppressHydrationWarning>{text ?? '·'}</span>;
}
