'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { NAV_SECTIONS } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * Enterprise-style sidebar: branded header, grouped sections (Overview /
 * Intelligence / Realtime / Admin), filter state preserved across nav clicks.
 */
export function Sidebar() {
  const pathname = usePathname();
  const search = useSearchParams();

  // Preserve global filters (app, project) when navigating between pages —
  // exactly the behaviour Datadog/Mixpanel use.
  const queryString = (() => {
    const app = search.get('app');
    const project = search.get('project');
    const p = new URLSearchParams();
    if (app) p.set('app', app);
    if (project) p.set('project', project);
    const s = p.toString();
    return s ? `?${s}` : '';
  })();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{siteConfig.shortName}</span>
          <span className="text-xs text-muted-foreground">Analytics Platform</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className={cn(i > 0 && 'mt-4')}>
            {section.label && (
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}${queryString}`}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-4 text-[11px] text-muted-foreground">
        {siteConfig.company} · v0.2.0
      </div>
    </aside>
  );
}
