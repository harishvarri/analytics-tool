'use client';

import { Download } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Client-side CSV export.
 *
 * IMPORTANT: this is a Client Component, so every prop must be serializable —
 * no functions may cross the Server → Client boundary. Callers therefore pass
 * already-flattened data: a `headers` string array and a `rows` 2D array of
 * primitive cells. The server component owns the row/column mapping.
 */

export type CsvCell = string | number | boolean | null | undefined;

interface Props {
  /** File name without extension */
  filename: string;
  /** Column headers */
  headers: readonly string[];
  /** Row data — each inner array is one row of primitive cells */
  rows: ReadonlyArray<readonly CsvCell[]>;
  label?: string;
}

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote if the value contains comma, quote, or newline
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportButton({ filename, headers, rows, label = 'Export CSV' }: Props) {
  const handleExport = useCallback(() => {
    const headerLine = headers.map(escapeCell).join(',');
    const dataLines = rows.map((row) => row.map(escapeCell).join(','));
    const csv = [headerLine, ...dataLines].join('\r\n');

    // Prepend a UTF-8 BOM so Excel detects encoding correctly.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filename, headers, rows]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="h-8 gap-1.5 text-xs"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
