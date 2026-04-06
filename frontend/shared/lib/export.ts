import * as XLSX from 'xlsx';

type ExportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

const downloadBlob = (filename: string, content: BlobPart, mimeType: string) => {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const escapeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
};

export const exportRowsToCsv = (
  filename: string,
  rows: Record<string, unknown>[],
  headers?: string[],
) => {
  if (!rows.length && !headers?.length) return;

  const keys = headers ?? Object.keys(rows[0] ?? {});
  const csvLines = [
    keys.join(','),
    ...rows.map((row) => keys.map((key) => escapeCsvValue(row[key])).join(',')),
  ];

  downloadBlob(filename, csvLines.join('\n'), 'text/csv;charset=utf-8;');
};

export const exportSheetsToExcel = (filename: string, sheets: ExportSheet[]) => {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(workbook, filename, { compression: true });
};
