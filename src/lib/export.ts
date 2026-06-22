import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPDF(
  filename: string,
  title: string,
  columns: string[],
  rows: Array<Array<string | number>>,
  subtitle?: string,
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 25);
  }
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: subtitle ? 30 : 24,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
