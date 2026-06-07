'use server';

import { revalidatePath } from 'next/cache';
import { setIssueStatus, type IssueStatus } from '@/lib/repositories/issues';

/** Server action: update a product issue's lifecycle status and refresh the page. */
export async function updateIssueStatus(slug: string, issueKey: string, status: IssueStatus): Promise<{ ok: boolean }> {
  const ok = await setIssueStatus(issueKey, status);
  if (ok) revalidatePath(`/dashboard/projects/${slug}`);
  return { ok };
}
