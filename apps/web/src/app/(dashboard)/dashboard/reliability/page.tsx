import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * The Error Intelligence Center is now the "Error Intelligence" tab of the
 * unified Operations Center. Redirect old links/bookmarks there.
 */
export default function ReliabilityRedirect() {
  redirect('/dashboard/incidents?view=errors');
}
