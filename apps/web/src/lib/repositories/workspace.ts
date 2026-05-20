import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Workspace repository — list of every Application (portal) and Project that
 * has produced at least one event. Used to populate the global filter
 * dropdowns in the topbar.
 */

export interface ApplicationOption {
  id:   string;     // portal_id
  name: string;     // human-friendly name (from analytics_portals)
}

export interface ProjectOption {
  id:    string;     // projectId UUID
  name:  string;     // resolved from project.viewed events (or fallback)
  appId: string | null;  // portal_id this project belongs to (best-effort)
}

/** Every registered application (portal). */
export async function listApplications(): Promise<ApplicationOption[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('analytics_portals')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  if (error) throw new AppError('APPS_LIST_FAILED', error.message, 500);

  return ((data ?? []) as { id: string; name: string; is_active: boolean }[])
    .filter((r) => r.is_active !== false)
    .map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Every project that has appeared in event metadata, with the best-effort
 * application (portal) it belongs to.
 */
export async function listProjects(appId?: string): Promise<ProjectOption[]> {
  const admin = getSupabaseAdmin();

  // Pull recent events that carry a projectId
  let query = admin
    .from('analytics_events')
    .select('portal_id, metadata')
    .not('metadata->projectId', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(5000);

  if (appId) query = query.eq('portal_id', appId);

  const { data, error } = await query;
  if (error) throw new AppError('PROJECTS_LIST_FAILED', error.message, 500);

  // Dedupe by projectId; keep first portal_id + best name we encounter
  const byId = new Map<string, ProjectOption>();
  for (const row of (data ?? []) as { portal_id: string; metadata: Record<string, unknown> }[]) {
    const pid = String(row.metadata?.projectId ?? '');
    if (!pid) continue;
    const name = String(row.metadata?.projectName ?? '');
    if (!byId.has(pid)) {
      byId.set(pid, { id: pid, name: name || `Project ${pid.slice(0, 8)}`, appId: row.portal_id ?? null });
    } else if (name && byId.get(pid)!.name.startsWith('Project ')) {
      // Upgrade a fallback name once we see a real one
      byId.get(pid)!.name = name;
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
