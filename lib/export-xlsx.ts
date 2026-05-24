import * as XLSX from "xlsx";

/** Build an .xlsx workbook from header row + data rows and trigger browser download. */
export function downloadXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string,
) {
  const aoa = [headers, ...rows.map((r) => r.map((c) => (c == null ? "" : c)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
