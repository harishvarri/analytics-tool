import { fetchApplications, fetchProjects } from '@/lib/data/fetchers';
import { TopbarClient } from './TopbarClient';

/**
 * Server-side topbar — fetches the workspace lookup tables once, hands them
 * to the client component for interactivity. This keeps the search index of
 * apps/projects out of every client bundle.
 */
export async function Topbar() {
  const [applications, projects] = await Promise.all([
    fetchApplications(),
    fetchProjects(),
  ]);

  return <TopbarClient applications={applications} projects={projects} />;
}
