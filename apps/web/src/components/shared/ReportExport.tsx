'use client';

import { useCallback, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export type Cell = string | number | boolean | null | undefined;

export interface ReportSection {
  title: string;
  headers: readonly string[];
  rows: ReadonlyArray<readonly Cell[]>;
}

interface Props {
  filename: string;
  title?: string;
  sections: readonly ReportSection[];
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
 * Multi-format comprehensive export for the Operations Report.
 * - CSV: multi-section with blank-line separators
 * - Excel (.xls): stacked tables per section via SpreadsheetML
 * - PDF: browser print → Save as PDF
 */
export function ReportExport({ filename, sections, title }: Props) {
  const [open, setOpen] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportCsv = useCallback(() => {
    const escCell = (v: Cell) => {
      const s = cellText(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    if (title) {
      lines.push(escCell(title), escCell(`Generated: ${stamp}`), '');
    }
    for (const section of sections) {
      lines.push(escCell(`=== ${section.title} ===`));
      lines.push(section.headers.map(escCell).join(','));
      for (const row of section.rows) lines.push(row.map(escCell).join(','));
      lines.push('');
    }
    download(
      new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' }),
      `${filename}-${stamp}.csv`,
    );
  }, [sections, filename, title, stamp]);

  const exportExcel = useCallback(() => {
    const thStyle = 'background:#1e293b;color:#fff;text-align:left;padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold';
    const tdStyle = 'padding:6px 10px;border:1px solid #e2e8f0;vertical-align:top';
    const hdStyle = 'font-size:13px;font-weight:bold;color:#1e293b;padding:10px 2px 4px;border:none;background:none';
    const spacerStyle = 'border:none;background:none;height:12px';

    let body = '';
    if (title) {
      body += `<tr><td colspan="10" style="font-size:16px;font-weight:bold;padding:8px 2px;border:none">${escapeHtml(title)} — ${stamp}</td></tr>`;
      body += `<tr><td colspan="10" style="${spacerStyle}"></td></tr>`;
    }

    for (const section of sections) {
      body += `<tr><td colspan="${section.headers.length}" style="${hdStyle}">${escapeHtml(section.title)}</td></tr>`;
      body += `<tr>${section.headers.map(h => `<th style="${thStyle}">${escapeHtml(h)}</th>`).join('')}</tr>`;
      for (const row of section.rows) {
        body += `<tr>${row.map(c => `<td style="${tdStyle}">${escapeHtml(cellText(c))}</td>`).join('')}</tr>`;
      }
      body += `<tr><td colspan="${section.headers.length}" style="${spacerStyle}"></td></tr>`;
    }

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table>${body}</table></body></html>`;
    download(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${filename}-${stamp}.xls`);
  }, [sections, filename, title, stamp]);

  const exportPdf = useCallback(() => {
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
          <DropdownMenuItem onClick={exportExcel}><FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Excel — all sections</DropdownMenuItem>
          <DropdownMenuItem onClick={exportCsv}><FileText className="mr-2 h-3.5 w-3.5" /> CSV — all sections</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
