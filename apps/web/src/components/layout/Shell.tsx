import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex bg-background print:block">
      {/* Sticky sidebar — stays fixed while main content scrolls */}
      <div className="print:hidden sticky top-0 h-screen shrink-0 self-start">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col min-h-screen">
        <div className="print:hidden"><Topbar /></div>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
