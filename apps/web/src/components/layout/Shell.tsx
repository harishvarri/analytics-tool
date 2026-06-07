import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background print:block print:min-h-0">
      <div className="print:hidden"><Sidebar /></div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden"><Topbar /></div>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
