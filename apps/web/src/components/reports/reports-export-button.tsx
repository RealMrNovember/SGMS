'use client';

type Props = {
  filename: string;
  headers: string[];
  rows: string[][];
  label: string;
};

function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ReportsExportButton({ filename, headers, rows, label }: Props) {
  function handleExport() {
    const lines = [headers, ...rows].map((row) => row.map(toCsvValue).join(','));
    // Excel'in Türkçe karakterleri doğru göstermesi için UTF-8 BOM eklenir.
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="button px-3 py-1.5 text-xs disabled:opacity-40"
    >
      {label}
    </button>
  );
}
