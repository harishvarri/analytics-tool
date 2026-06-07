'use client';

import { useCallback, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export type Cell = string | number | boolean | null | undefined;

interface Props {
  filename: string;
  headers: readonly string[];
  rows: ReadonlyArray<readonly Cell[]>;
  /** Optional report title used in the Excel/print header. */
  title?: string;
}

function cellText(v: Cell): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Multi-format export for executive reports:
 *  - CSV  (Excel-compatible, UTF-8 BOM)
 *  - Excel (.xls via SpreadsheetML HTML table — opens as a real workbook)
 *  - PDF  (browser print dialog → Save as PDF, using print styles)
 */
export function ReportExport({ filename, headers, rows, title }: Props) {
  const [open, setOpen] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportCsv = useCallback(() => {
    const esc = (v: Cell) => {
      const s = cellText(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
    download(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }), `${filename}-${stamp}.csv`);
  }, [headers, rows, filename, stamp]);

  const exportExcel = useCallback(() => {
    const head = `<tr>${headers.map((h) => `<th style="background:#1e293b;color:#fff;text-align:left;padding:6px 10px;border:1px solid #cbd5e1">${escapeHtml(h)}</th>`).join('')}</tr>`;
    const body = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px;border:1px solid #e2e8f0">${escapeHtml(cellText(c))}</td>`).join('')}</tr>`).join('');
    const caption = title ? `<caption style="text-align:left;font-size:16px;font-weight:bold;padding:8px 0">${escapeHtml(title)} — ${stamp}</caption>` : '';
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table border="1">${caption}${head}${body}</table></body></html>`;
    download(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${filename}-${stamp}.xls`);
  }, [headers, rows, filename, title, stamp]);

  const exportPdf = useCallback(() => {
    // Use the browser's print → "Save as PDF". The print stylesheet on the page
    // hides chrome and formats the report for paper.
    window.print();
  }, []);

  return (
    <div className="print:hidden">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportPdf}><Printer className="mr-2 h-3.5 w-3.5" /> PDF (print)</DropdownMenuItem>
          <DropdownMenuItem onClick={exportExcel}><FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Excel (.xls)</DropdownMenuItem>
          <DropdownMenuItem onClick={exportCsv}><FileText className="mr-2 h-3.5 w-3.5" /> CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
