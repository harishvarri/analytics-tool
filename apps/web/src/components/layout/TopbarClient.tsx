'use client';

import { Menu, Search } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import type { ApplicationOption, ProjectOption } from '@/lib/repositories/workspace';

interface Props {
  applications: ApplicationOption[];
  projects:     ProjectOption[];
}

export function TopbarClient({ applications, projects }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            <SheetTitle>{siteConfig.shortName} Analytics</SheetTitle>
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
                      href={item.href}
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

      {/* Workspace filter (Application + Project) */}
      <WorkspaceFilter applications={applications} projects={projects} />

      {/* Search */}
      <div className="hidden flex-1 items-center gap-2 md:flex">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search applications, users, events…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" className="hidden border-emerald-500/40 text-emerald-600 dark:text-emerald-400 md:inline-flex">
          ● Live
        </Badge>
        <ThemeToggle />
        <Avatar className="h-9 w-9">
          <AvatarFallback>NC</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
