import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Risk & Anomaly has been retired — its signals were redundant with the
 * Operations Center (error spikes → Error Intelligence; outages/inactivity →
 * Incidents). Redirect old links/bookmarks to the unified page.
 */
export default function AnomaliesRedirect() {
  redirect('/dashboard/incidents');
}
