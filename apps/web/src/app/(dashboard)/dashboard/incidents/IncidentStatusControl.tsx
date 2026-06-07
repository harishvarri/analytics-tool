'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { updateIncidentStatus } from './actions';
import type { IncidentStatus } from '@/lib/repositories/incidents';

const STEPS: { key: IncidentStatus; label: string; tone: string }[] = [
  { key: 'open',          label: 'Open',          tone: 'data-[on=true]:bg-rose-500 data-[on=true]:text-white' },
  { key: 'investigating', label: 'Investigating', tone: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white' },
  { key: 'resolved',      label: 'Resolved',      tone: 'data-[on=true]:bg-emerald-500 data-[on=true]:text-white' },
  { key: 'closed',        label: 'Closed',        tone: 'data-[on=true]:bg-slate-500 data-[on=true]:text-white' },
];

export function IncidentStatusControl({ incidentKey, current }: { incidentKey: string; current: IncidentStatus }) {
  const [status, setStatus] = useState<IncidentStatus>(current);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (next: IncidentStatus) => {
    if (next === status || pending) return;
    const prev = status;
    setStatus(next);
    setFailed(false);
    startTransition(async () => {
      const res = await updateIncidentStatus(incidentKey, next);
      if (!res.ok) { setStatus(prev); setFailed(true); }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex overflow-hidden rounded-md border text-[10px]">
        {STEPS.map((s) => (
          <button
            key={s.key}
            type="button"
            data-on={status === s.key}
            onClick={() => choose(s.key)}
            disabled={pending}
            className={`flex items-center gap-1 px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60 ${s.tone}`}
          >
            {status === s.key && <Check className="h-3 w-3" />}{s.label}
          </button>
        ))}
      </div>
      {failed && <span className="text-[10px] text-rose-500">Couldn&apos;t save — apply migration 0036 first.</span>}
    </div>
  );
}
