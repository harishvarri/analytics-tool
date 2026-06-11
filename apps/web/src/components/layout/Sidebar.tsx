'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_SECTIONS } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';
import { ACCENT_BAR, accentFromLabel } from '@/lib/accent';

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
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" fill="none">
            <rect x="3" y="18" width="4.5" height="10" rx="1.5" fill="white" opacity="0.65"/>
            <rect x="10" y="11" width="4.5" height="17" rx="1.5" fill="white"/>
            <rect x="17" y="5" width="4.5" height="23" rx="1.5" fill="white"/>
            <rect x="24" y="9" width="4.5" height="19" rx="1.5" fill="white" opacity="0.75"/>
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{siteConfig.shortName}</span>
          <span className="text-xs text-muted-foreground">Operational Intelligence</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className={cn(i > 0 && 'mt-4')}>
            {section.label && (
              <div className="mb-1.5 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT_BAR[accentFromLabel(section.label)])} aria-hidden />
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
                      'relative flex items-center gap-3 rounded-md py-1.5 pl-4 pr-3 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-accent font-semibold text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
                    )}
                    <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-4 text-[11px] text-muted-foreground">
        {siteConfig.company} · Internal Platform
      </div>
    </aside>
  );
}
