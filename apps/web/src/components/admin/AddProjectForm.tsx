'use client';

import { useActionState, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createProjectAction, type CreateProjectState } from '@/app/(dashboard)/dashboard/admin/projects/actions';
import { ScriptInstallGuide } from '@/components/shared/ScriptInstallGuide';

const initialState: CreateProjectState = { ok: false };

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';

function autoSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
}

export function AddProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  // Keep slug in sync with name until the user manually edits it.
  useEffect(() => {
    if (!slugEdited) setSlug(autoSlug(name));
  }, [name, slugEdited]);

  // On success, reset the input fields (the success card shows separately).
  useEffect(() => {
    if (state.ok && state.project) {
      setName('');
      setSlug('');
      setSlugEdited(false);
    }
  }, [state]);

  const fieldErr = (k: string) => state.fieldErrors?.[k];

  return (
    <div className="space-y-4">
      {/* Success panel with generated key + snippet */}
      {state.ok && state.project && (
        <Card className="border-emerald-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {state.project.name} onboarded
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Product <code className="rounded bg-muted px-1">{state.project.slug}</code> is registered and
              tracking is {state.project.trackingEnabled ? 'enabled' : 'disabled'}. Follow the 2-step setup below
              (paste the script, then add one identify call) — events start flowing into every dashboard automatically.
            </p>
            <ScriptInstallGuide
              projectSlug={state.project.slug}
              projectName={state.project.name}
              apiKey={state.project.apiKey}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          {state.error && !state.fieldErrors && (
            <div className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {state.error}
            </div>
          )}

          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="name">Product Name *</label>
              <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Customer CRM" className={inputCls} required />
              {fieldErr('name') && <p className="mt-1 text-[11px] text-rose-500">{fieldErr('name')}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="slug">Product Slug *</label>
              <input id="slug" name="slug" value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
                placeholder="crm" className={`${inputCls} font-mono`} required />
              {fieldErr('slug') && <p className="mt-1 text-[11px] text-rose-500">{fieldErr('slug')}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="description">Description</label>
              <input id="description" name="description" placeholder="Internal CRM for the sales team" className={inputCls} />
            </div>

            <div>
              <label className={labelCls} htmlFor="repoUrl">GitHub Repository URL</label>
              <input id="repoUrl" name="repoUrl" placeholder="https://github.com/org/crm" className={inputCls} />
              {fieldErr('repoUrl') && <p className="mt-1 text-[11px] text-rose-500">{fieldErr('repoUrl')}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="vercelUrl">Vercel / Live URL</label>
              <input id="vercelUrl" name="vercelUrl" placeholder="https://crm.vercel.app" className={inputCls} />
              {fieldErr('vercelUrl') && <p className="mt-1 text-[11px] text-rose-500">{fieldErr('vercelUrl')}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="environment">Environment</label>
              <select id="environment" name="environment" defaultValue="production" className={inputCls}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="projectType">Product Type</label>
              <select id="projectType" name="projectType" defaultValue="web" className={inputCls}>
                <option value="web">Web app</option>
                <option value="mobile">Mobile app</option>
                <option value="api">API / Backend</option>
                <option value="admin">Admin portal</option>
                <option value="saas">SaaS product</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="teamOwner">Team Owner</label>
              <input id="teamOwner" name="teamOwner" placeholder="Platform team" className={inputCls} />
            </div>

            <div className="flex items-center gap-2 self-end pb-2">
              <input id="trackingEnabled" name="trackingEnabled" type="checkbox" defaultChecked
                className="h-4 w-4 rounded border-input" />
              <label htmlFor="trackingEnabled" className="text-xs font-medium">Tracking enabled</label>
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} className="gap-1.5">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {pending ? 'Creating…' : 'Add product & generate key'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
