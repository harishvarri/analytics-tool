import { fetchApplications } from '@/lib/data/fetchers';
import { TopbarClient } from './TopbarClient';

/**
 * Server-side topbar — fetches the Application lookup table once and hands it
 * to the client component for interactivity. (The legacy per-project lookup was
 * removed along with the non-functional Project filter.)
 */
export async function Topbar() {
  const applications = await fetchApplications();
  return <TopbarClient applications={applications} />;
}
