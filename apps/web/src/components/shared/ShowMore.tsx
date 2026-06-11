'use client';

import { Children, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Progressive-disclosure wrapper for lists/grids that render one item per
 * connected product (or any large collection). Shows the first `initial` items
 * and a "Show all N" toggle for the rest — so a page stays compact whether
 * there are 3 products or 300. Renders the wrapper element with `className`
 * (pass the grid/stack classes), then the toggle below.
 *
 * At small N (≤ initial) it's a no-op: every item shows, no button.
 */
export function ShowMore({
  initial = 8,
  children,
  className,
  noun = 'items',
}: {
  initial?: number;
  children: ReactNode;
  className?: string;
  noun?: string;
}) {
  const items = Children.toArray(children);
  const [expanded, setExpanded] = useState(false);
  const overflow = items.length - initial;
  const visible = expanded ? items : items.slice(0, initial);

  return (
    <>
      <div className={className}>{visible}</div>
      {overflow > 0 && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="h-8 gap-1.5 text-xs"
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Show all {items.length} {noun}</>
            )}
          </Button>
        </div>
      )}
    </>
  );
}
