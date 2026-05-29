import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import type { DirectoryUserInput } from '../schemas/directory';

/**
 * Directory sync — the central SSO pushes the user directory + each user's
 * allowed projects. Idempotent: re-running with the same snapshot is a no-op.
 */

export interface DirectorySyncResult {
  usersUpserted: number;
  accessRowsUpserted: number;
  accessRowsRevoked: number;
  usersDeactivated: number;
  skippedProjects: string[];
  errors: string[];
}

// Refuse to mass-deactivate if a "full" snapshot covers too little of the
// existing directory (guards against a partial/failed SSO push).
const DEACTIVATION_FLOOR = 0.5;

export async function syncDirectory(
  users: DirectoryUserInput[],
  opts: { mode: 'full' | 'delta' },
): Promise<DirectorySyncResult> {
  const admin = getSupabaseAdmin();
  const res: DirectorySyncResult = {
    usersUpserted: 0,
    accessRowsUpserted: 0,
    accessRowsRevoked: 0,
    usersDeactivated: 0,
    skippedProjects: [],
    errors: [],
  };

  // Known project slugs (access rows must reference an existing project).
  const { data: projRows } = await admin.from('analytics_projects').select('slug');
  const knownSlugs = new Set((projRows ?? []).map((p: { slug: string }) => p.slug));

  const now = new Date().toISOString();

  // 1. Upsert users (directory-owned columns).
  const userRows = users.map((u) => ({
    id: u.id,
    email: u.email.toLowerCase(),
    display_name: u.name,
    ...(u.role ? { role: u.role } : {}),
    department: u.department ?? null,
    team: u.team ?? null,
    title: u.title ?? null,
    status: u.status ?? 'active',
    is_internal: u.isInternal ?? true,
    source: 'directory',
    last_directory_sync_at: now,
  }));
  {
    const { error } = await admin.from('analytics_users').upsert(userRows, { onConflict: 'id' });
    if (error) res.errors.push(`users upsert: ${error.message}`);
    else res.usersUpserted = userRows.length;
  }

  // 2. Reconcile access per user (upsert allowed, revoke the rest).
  const accessRows: { user_id: string; project_slug: string; source: string }[] = [];
  for (const u of users) {
    for (const slug of u.allowedProjects ?? []) {
      if (!knownSlugs.has(slug)) {
        if (!res.skippedProjects.includes(slug)) res.skippedProjects.push(slug);
        continue;
      }
      accessRows.push({ user_id: u.id, project_slug: slug, source: 'directory' });
    }
  }
  if (accessRows.length) {
    const { error } = await admin
      .from('analytics_user_access')
      .upsert(accessRows, { onConflict: 'user_id,project_slug', ignoreDuplicates: true });
    if (error) res.errors.push(`access upsert: ${error.message}`);
    else res.accessRowsUpserted = accessRows.length;
  }
  // Revoke access rows no longer granted (per user in this push).
  for (const u of users) {
    const allowed = (u.allowedProjects ?? []).filter((s) => knownSlugs.has(s));
    let q = admin.from('analytics_user_access').delete({ count: 'exact' }).eq('user_id', u.id);
    if (allowed.length) q = q.not('project_slug', 'in', `(${allowed.map((s) => `"${s}"`).join(',')})`);
    const { count, error } = await q;
    if (error) res.errors.push(`access revoke (${u.id}): ${error.message}`);
    else res.accessRowsRevoked += count ?? 0;
  }

  // 3. Full-mode soft-deactivation of directory users absent from the snapshot.
  if (opts.mode === 'full') {
    const { count: totalDir } = await admin
      .from('analytics_users')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'directory');
    const coverage = totalDir && totalDir > 0 ? users.length / totalDir : 1;
    if (coverage >= DEACTIVATION_FLOOR) {
      const presentIds = users.map((u) => u.id);
      const { count, error } = await admin
        .from('analytics_users')
        .update({ status: 'inactive', last_directory_sync_at: now }, { count: 'exact' })
        .eq('source', 'directory')
        .not('id', 'in', `(${presentIds.map((id) => `"${id}"`).join(',')})`)
        .neq('status', 'inactive');
      if (error) res.errors.push(`deactivate: ${error.message}`);
      else res.usersDeactivated = count ?? 0;
    } else {
      res.errors.push(
        `deactivation skipped — snapshot covers ${Math.round(coverage * 100)}% of directory (< ${DEACTIVATION_FLOOR * 100}% floor)`,
      );
    }
  }

  return res;
}
