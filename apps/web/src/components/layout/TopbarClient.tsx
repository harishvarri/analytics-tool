'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { NAV_SECTIONS } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';
import { WorkspaceFilter } from './WorkspaceFilter';
import { RangePicker } from './RangePicker';
import { RefreshButton } from './RefreshButton';
import type { ApplicationOption } from '@/lib/repositories/workspace';

interface Props {
  applications: ApplicationOption[];
}

export function TopbarClient({ applications }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // BUG-015 fix: preserve the workspace filter query string in mobile nav links,
  // exactly as the desktop Sidebar does (Sidebar.tsx line 20-28).
  const queryString = (() => {
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  })();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      {/* Mobile menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{siteConfig.shortName} — Operational Intelligence</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-3 p-4">
            {NAV_SECTIONS.map((section, i) => (
              <div key={section.label ?? `m-${i}`}>
                {section.label && (
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.label}
                  </div>
                )}
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={`${item.href}${queryString}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Workspace filter (Application) + date range — each self-hides on pages
          that don't support it (lib/page-filters). */}
      <WorkspaceFilter applications={applications} />
      <div className="hidden md:block">
        <RangePicker />
      </div>

      <div className="flex-1" />

      <div className="ml-auto flex items-center gap-2">
        <RefreshButton />
        <Badge variant="outline" className="hidden border-emerald-500/40 text-emerald-600 dark:text-emerald-400 md:inline-flex">
          ● Live
        </Badge>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="hidden text-xs text-muted-foreground md:inline-flex"
          onClick={async () => {
            const { createBrowserClient } = await import('@supabase/ssr');
            const sb = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            );
            await sb.auth.signOut();
            window.location.href = '/login';
          }}
        >
          Sign out
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">NC</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
