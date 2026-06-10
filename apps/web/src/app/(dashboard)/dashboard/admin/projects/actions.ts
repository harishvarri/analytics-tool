'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createProject,
  setProjectTracking,
  slugify,
  type Project,
  type ProjectEnvironment,
  type ProjectType,
} from '@/lib/repositories/projects';
import { AppError } from '@/lib/api/errors';

/**
 * Server Action for the Add-Project admin form. Runs on the server with the
 * service-role client — no public mutation endpoint is exposed. Returns a
 * discriminated result the client form renders (success → show key + snippet).
 */

const inputSchema = z.object({
  name:            z.string().min(2).max(80),
  slug:            z.string().min(2).max(63).regex(/^[a-z][a-z0-9_-]*$/, 'Lowercase, start with a letter; a-z 0-9 - _ only'),
  description:     z.string().max(500).optional(),
  repoUrl:         z.string().url().max(300).optional().or(z.literal('')),
  vercelUrl:       z.string().url().max(300).optional().or(z.literal('')),
  environment:     z.enum(['production', 'staging', 'development']),
  projectType:     z.enum(['web', 'mobile', 'api', 'admin', 'saas', 'other']),
  teamOwner:       z.string().max(120).optional(),
  trackingEnabled: z.boolean(),
});

export interface CreateProjectState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  project?: Project;
}

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const raw = {
    name:            String(formData.get('name') ?? '').trim(),
    slug:            (String(formData.get('slug') ?? '').trim() || slugify(String(formData.get('name') ?? ''))),
    description:     String(formData.get('description') ?? '').trim() || undefined,
    repoUrl:         String(formData.get('repoUrl') ?? '').trim() || undefined,
    vercelUrl:       String(formData.get('vercelUrl') ?? '').trim() || undefined,
    environment:     String(formData.get('environment') ?? 'production'),
    projectType:     String(formData.get('projectType') ?? 'web'),
    teamOwner:       String(formData.get('teamOwner') ?? '').trim() || undefined,
    trackingEnabled: formData.get('trackingEnabled') === 'on' || formData.get('trackingEnabled') === 'true',
  };

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors };
  }

  try {
    // Auth gate is bypassed while login is disabled (no Supabase users configured).
    // Re-enable by uncommenting: await requireAdmin();

    const project = await createProject({
      name:            parsed.data.name,
      slug:            parsed.data.slug,
      description:     parsed.data.description ?? null,
      repoUrl:         parsed.data.repoUrl || null,
      vercelUrl:       parsed.data.vercelUrl || null,
      environment:     parsed.data.environment as ProjectEnvironment,
      projectType:     parsed.data.projectType as ProjectType,
      teamOwner:       parsed.data.teamOwner ?? null,
      trackingEnabled: parsed.data.trackingEnabled,
    });

    revalidatePath('/dashboard/admin/projects');
    return { ok: true, project };
  } catch (err) {
    const message =
      err instanceof AppError ? err.message
      : err instanceof Error ? err.message
      : 'Failed to create project.';
    return { ok: false, error: message };
  }
}

export interface ToggleTrackingState {
  ok: boolean;
  error?: string;
  slug?: string;
  trackingEnabled?: boolean;
}

/**
 * Connect or disconnect a project from the admin UI. Disconnecting stops event
 * ingestion and pulls the product out of health/intelligence/dashboards; it's
 * fully reversible (the row, key, and history are preserved).
 */
export async function setProjectTrackingAction(
  _prev: ToggleTrackingState,
  formData: FormData,
): Promise<ToggleTrackingState> {
  const slug = String(formData.get('slug') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'true';

  if (!slug) return { ok: false, error: 'Missing project slug.' };

  try {
    const project = await setProjectTracking(slug, enabled);
    // Tracking state changes who appears in health, intelligence, and ingestion —
    // refresh every surface that filters on tracking_enabled.
    for (const path of [
      '/dashboard/admin/projects',
      '/dashboard',
      '/dashboard/health',
      '/dashboard/compare',
      '/dashboard/applications',
      '/dashboard/incidents',
      '/dashboard/integrations',
    ]) {
      revalidatePath(path);
    }
    return { ok: true, slug: project.slug, trackingEnabled: project.trackingEnabled };
  } catch (err) {
    const message =
      err instanceof AppError ? err.message
      : err instanceof Error ? err.message
      : 'Failed to update tracking.';
    return { ok: false, error: message, slug };
  }
}
