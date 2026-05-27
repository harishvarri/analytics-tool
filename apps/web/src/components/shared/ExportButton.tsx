'use client';

import { Download } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Client-side CSV export. Takes already-serialized rows (plain objects) plus a
 * column spec, builds a CSV in the browser, and triggers a download — no
 * backend round-trip. Safe to drop into any server-rendered page because the
 * data is passed as plain props.
 */

export interface ExportColumn<T> {
  /** Header text in the CSV */
  header: string;
  /** Cell accessor — returns a primitive */
  accessor: (row: T) => string | number | boolean | null | undefined;
}

interface Props<T> {
  rows: ReadonlyArray<T>;
  columns: ReadonlyArray<ExportColumn<T>>;
  /** File name without extension */
  filename: string;
  label?: string;
}

function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote if the value contains comma, quote, or newline
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportButton<T>({ rows, columns, filename, label = 'Export CSV' }: Props<T>) {
  const handleExport = useCallback(() => {
    const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
    const dataLines = rows.map((row) =>
      columns.map((c) => escapeCell(c.accessor(row))).join(','),
    );
    const csv = [headerLine, ...dataLines].join('\r\n');

    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows, columns, filename]);

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
