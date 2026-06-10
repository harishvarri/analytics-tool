'use client';

import { useEffect, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Accent-color theme picker. Independent of light/dark — sets a `data-accent`
 * attribute on <html> that re-tints the brand primary, focus ring, and accent
 * text (so every button, link, tab, and active state follows the chosen color).
 * Persisted in localStorage and applied pre-paint by the inline script in the
 * root layout (no flash on reload).
 */
export const ACCENT_STORAGE_KEY = 'ncpl-accent';

const ACCENTS = [
  { id: 'indigo',  label: 'Indigo',  swatch: 'hsl(234 89% 60%)' },
  { id: 'emerald', label: 'Emerald', swatch: 'hsl(160 84% 39%)' },
  { id: 'violet',  label: 'Violet',  swatch: 'hsl(262 83% 58%)' },
  { id: 'amber',   label: 'Amber',   swatch: 'hsl(28 92% 45%)' },
] as const;

function applyAccent(id: string) {
  const root = document.documentElement;
  if (id === 'indigo') root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', id);
}

export function AccentPicker() {
  const [accent, setAccent] = useState('indigo');

  useEffect(() => {
    try {
      setAccent(localStorage.getItem(ACCENT_STORAGE_KEY) || 'indigo');
    } catch { /* storage blocked — default indigo */ }
  }, []);

  const choose = (id: string) => {
    setAccent(id);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, id); } catch { /* ignore */ }
    applyAccent(id);
  };

  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Accent color">
          <Palette className="h-[1.2rem] w-[1.2rem]" style={{ color: current.swatch }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Accent color
        </DropdownMenuLabel>
        {ACCENTS.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => choose(a.id)} className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-border" style={{ background: a.swatch }} />
            <span className="flex-1">{a.label}</span>
            {accent === a.id && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
