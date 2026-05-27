import 'server-only';
import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Dynamic project registry repository (migration 0017).
 *
 * Projects are onboarded as data — a row in analytics_projects plus a
 * dynamically-added portal_id enum label (via the add_portal_value RPC). No
 * platform redeploy or source edit is required to add a new application.
 */

export type ProjectEnvironment = 'production' | 'staging' | 'development';
export type ProjectType = 'web' | 'mobile' | 'api' | 'admin' | 'saas' | 'other';

export interface Project {
  slug:            string;
  name:            string;
  description:     string | null;
  repoUrl:         string | null;
  vercelUrl:       string | null;
  environment:     string;
  projectType:     string;
  teamOwner:       string | null;
  trackingEnabled: boolean;
  apiKey:          string;
  createdAt:       string;
}

export interface CreateProjectInput {
  name:            string;
  slug:            string;
  description?:    string | null;
  repoUrl?:        string | null;
  vercelUrl?:      string | null;
  environment:     ProjectEnvironment;
  projectType:     ProjectType;
  teamOwner?:      string | null;
  trackingEnabled: boolean;
}

const SLUG_RE = /^[a-z][a-z0-9_-]{1,62}$/;

/** Generate a project-scoped ingest key. */
export function generateApiKey(): string {
  return `ncpl_pk_${randomBytes(24).toString('base64url')}`;
}

/** Normalize a free-text name into a candidate slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function mapRow(r: Record<string, unknown>): Project {
  return {
    slug:            String(r.slug),
    name:            String(r.name),
    description:     (r.description as string | null) ?? null,
    repoUrl:         (r.repo_url as string | null) ?? null,
    vercelUrl:       (r.vercel_url as string | null) ?? null,
    environment:     String(r.environment ?? 'production'),
    projectType:     String(r.project_type ?? 'web'),
    teamOwner:       (r.team_owner as string | null) ?? null,
    trackingEnabled: Boolean(r.tracking_enabled),
    apiKey:          String(r.api_key),
    createdAt:       String(r.created_at),
  };
}

export async function listProjectsRegistry(): Promise<Project[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('analytics_projects')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new AppError('PROJECTS_REGISTRY_FAILED', error.message, 500);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('analytics_projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new AppError('PROJECT_GET_FAILED', error.message, 500);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/**
 * Onboard a new project. Order matters because Postgres forbids using a
 * freshly-added enum value in the same transaction:
 *   1. add_portal_value(slug)            — own statement/transaction
 *   2. insert analytics_portals(slug)    — keeps existing views/joins working
 *   3. insert analytics_projects(...)    — rich registry + generated key
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const admin = getSupabaseAdmin();
  const slug = input.slug;

  if (!SLUG_RE.test(slug)) {
    throw new AppError('PROJECT_INVALID_SLUG', 'Slug must be lowercase, start with a letter, and use only a-z, 0-9, - or _.', 400);
  }

  const existing = await getProjectBySlug(slug);
  if (existing) {
    throw new AppError('PROJECT_EXISTS', `A project with slug "${slug}" already exists.`, 409);
  }

  // 1. Grow the enum (separate transaction via RPC).
  const { error: enumErr } = await admin.rpc('add_portal_value', { p_slug: slug });
  if (enumErr) throw new AppError('PROJECT_ENUM_FAILED', enumErr.message, 500);

  // 2. Mirror into analytics_portals so existing views/joins recognise it.
  const { error: portalErr } = await admin
    .from('analytics_portals')
    .upsert({ id: slug, name: input.name, description: input.description ?? null, color: 'slate' }, { onConflict: 'id' });
  if (portalErr) throw new AppError('PROJECT_PORTAL_FAILED', portalErr.message, 500);

  // 3. Insert the rich registry row with a generated key.
  const apiKey = generateApiKey();
  const { data, error } = await admin
    .from('analytics_projects')
    .insert({
      slug,
      name:             input.name,
      description:      input.description ?? null,
      repo_url:         input.repoUrl ?? null,
      vercel_url:       input.vercelUrl ?? null,
      environment:      input.environment,
      project_type:     input.projectType,
      team_owner:       input.teamOwner ?? null,
      tracking_enabled: input.trackingEnabled,
      api_key:          apiKey,
    })
    .select('*')
    .single();

  if (error) throw new AppError('PROJECT_CREATE_FAILED', error.message, 500);
  return mapRow(data as Record<string, unknown>);
}
