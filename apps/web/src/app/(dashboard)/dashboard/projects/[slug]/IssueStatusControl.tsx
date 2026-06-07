'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { updateIssueStatus } from './actions';
import type { IssueStatus } from '@/lib/repositories/issues';

const STEPS: { key: IssueStatus; label: string; tone: string }[] = [
  { key: 'open',        label: 'Open',        tone: 'data-[on=true]:bg-rose-500 data-[on=true]:text-white' },
  { key: 'in_progress', label: 'In progress', tone: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white' },
  { key: 'resolved',    label: 'Resolved',    tone: 'data-[on=true]:bg-emerald-500 data-[on=true]:text-white' },
  { key: 'closed',      label: 'Closed',      tone: 'data-[on=true]:bg-slate-500 data-[on=true]:text-white' },
];

export function IssueStatusControl({ slug, issueKey, current }: { slug: string; issueKey: string; current: IssueStatus }) {
  const [status, setStatus] = useState<IssueStatus>(current);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (next: IssueStatus) => {
    if (next === status || pending) return;
    const prev = status;
    setStatus(next);
    setFailed(false);
    startTransition(async () => {
      const res = await updateIssueStatus(slug, issueKey, next);
      if (!res.ok) { setStatus(prev); setFailed(true); }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex overflow-hidden rounded-md border text-[10px]">
        {STEPS.map((s) => (
          <button
            key={s.key}
            type="button"
            data-on={status === s.key}
            onClick={() => choose(s.key)}
            disabled={pending}
            className={`flex items-center gap-1 px-1.5 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60 ${s.tone}`}
          >
            {status === s.key && <Check className="h-2.5 w-2.5" />}{s.label}
          </button>
        ))}
      </div>
      {failed && <span className="text-[10px] text-rose-500">Apply migration 0037 to save.</span>}
    </div>
  );
}
