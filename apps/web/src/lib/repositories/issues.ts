import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';

/**
 * Lifecycle status for per-product issues. Issues are derived strings (from
 * ProjectIntelligence.issues / .alerts), so — like incidents — we persist only
 * their status, keyed by a deterministic id (product slug + issue text).
 *
 * Defensive: if the issue_status table doesn't exist yet (migration 0037 not
 * applied), reads return an empty map and everything shows as "open".
 */

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export const ISSUE_STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
export const ACTIVE_ISSUE_STATUSES = new Set<IssueStatus>(['open', 'in_progress']);

/** Stable key for an issue: ISS-XXXXXX from product slug + issue text. */
export function issueKey(slug: string, text: string): string {
  const seed = `${slug}|${text}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `ISS-${h.toString(36).toUpperCase().slice(0, 6).padStart(6, '0')}`;
}

export async function getIssueStatuses(keys: string[]): Promise<Map<string, { status: IssueStatus; updatedAt: string }>> {
  const map = new Map<string, { status: IssueStatus; updatedAt: string }>();
  if (keys.length === 0) return map;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('issue_status')
      .select('issue_key, status, updated_at')
      .in('issue_key', keys);
    if (error) return map;
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      map.set(String(r.issue_key), { status: String(r.status) as IssueStatus, updatedAt: String(r.updated_at) });
    }
  } catch { /* table missing — treat all as open */ }
  return map;
}

export async function setIssueStatus(key: string, status: IssueStatus): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdmin()
      .from('issue_status')
      .upsert({ issue_key: key, status, updated_at: new Date().toISOString() }, { onConflict: 'issue_key' });
    return !error;
  } catch {
    return false;
  }
}
