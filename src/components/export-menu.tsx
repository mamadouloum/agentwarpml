import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet } from "lucide-react";

type Props = {
  filename: string;
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  subtitle?: string;
};

export function ExportMenu({ filename, title, columns, rows, subtitle }: Props) {
  async function onCSV() {
    const { exportCSV } = await import("@/lib/export");
    const data = rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""])));
    exportCSV(filename, data);
  }
  async function onPDF() {
    const { exportPDF } = await import("@/lib/export");
    exportPDF(filename, title, columns, rows, subtitle);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPDF}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
