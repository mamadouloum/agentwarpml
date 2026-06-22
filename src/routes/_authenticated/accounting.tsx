import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  Trash2,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
});

const fmt = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} F`;

function AccountingPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [openExp, setOpenExp] = useState(false);
  const [openCat, setOpenCat] = useState(false);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () =>
      (
        await supabase
          .from("expenses")
          .select("*, expense_categories(name,color)")
          .order("spent_at", { ascending: false })
      ).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () =>
      (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments-feed"],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*, invoices(label, students(first_name,last_name))")
          .order("paid_at", { ascending: false })
      ).data ?? [],
  });

  const totals = useMemo(() => {
    const revenue = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const spent = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    return { revenue, spent, balance: revenue - spent };
  }, [payments, expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number }>();
    for (const e of expenses as any[]) {
      const key = e.expense_categories?.name ?? "Sans catégorie";
      const color = e.expense_categories?.color ?? "#94a3b8";
      const cur = map.get(key) ?? { name: key, color, total: 0 };
      cur.total += Number(e.amount);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const monthly = useMemo(() => {
    const map: Record<string, { month: string; recettes: number; depenses: number }> = {};
    const key = (d: string) => d.slice(0, 7);
    for (const p of payments as any[]) {
      const k = key(p.paid_at);
      map[k] ||= { month: k, recettes: 0, depenses: 0 };
      map[k].recettes += Number(p.amount);
    }
    for (const e of expenses as any[]) {
      const k = key(e.spent_at);
      map[k] ||= { month: k, recettes: 0, depenses: 0 };
      map[k].depenses += Number(e.amount);
    }
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [payments, expenses]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const exp = (expenses as any[]).map((e) => ({
      Date: e.spent_at,
      Libellé: e.label,
      Catégorie: e.expense_categories?.name ?? "",
      Fournisseur: e.supplier ?? "",
      Montant: Number(e.amount),
    }));
    const rev = (payments as any[]).map((p) => ({
      Date: p.paid_at,
      Élève:
        `${p.invoices?.students?.last_name ?? ""} ${p.invoices?.students?.first_name ?? ""}`.trim(),
      Libellé: p.invoices?.label ?? "",
      Montant: Number(p.amount),
    }));
    const bal = [
      { Indicateur: "Recettes", Montant: totals.revenue },
      { Indicateur: "Dépenses", Montant: totals.spent },
      { Indicateur: "Solde", Montant: totals.balance },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bal), "Balance");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rev), "Recettes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exp), "Dépenses");
    XLSX.writeFile(wb, `comptabilite_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Journal de comptabilité", 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Édité le ${new Date().toLocaleDateString("fr-FR")} — Recettes ${fmt(totals.revenue)} · Dépenses ${fmt(totals.spent)} · Solde ${fmt(totals.balance)}`,
      14,
      23,
    );
    autoTable(doc, {
      startY: 30,
      head: [["Date", "Type", "Libellé", "Montant"]],
      body: [
        ...(payments as any[]).map((p) => [
          new Date(p.paid_at).toLocaleDateString("fr-FR"),
          "Recette",
          p.invoices?.label ?? "",
          fmt(p.amount),
        ]),
        ...(expenses as any[]).map((e) => [
          new Date(e.spent_at).toLocaleDateString("fr-FR"),
          "Dépense",
          e.label,
          `- ${fmt(e.amount)}`,
        ]),
      ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save(`journal_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function createExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("expenses").insert({
      school_id: schoolId,
      category_id: (fd.get("category_id") as string) || null,
      label: String(fd.get("label")),
      amount: Number(fd.get("amount")),
      spent_at: String(fd.get("spent_at")),
      method: (fd.get("method") as string) || null,
      supplier: (fd.get("supplier") as string) || null,
      note: (fd.get("note") as string) || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Dépense enregistrée");
    setOpenExp(false);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  async function createCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("expense_categories").insert({
      school_id: schoolId,
      name: String(fd.get("name")),
      color: String(fd.get("color") || "#3b6fa0"),
    });
    if (error) return toast.error(error.message);
    toast.success("Catégorie créée");
    setOpenCat(false);
    qc.invalidateQueries({ queryKey: ["expense-categories"] });
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dépense supprimée");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptabilité"
        description="Suivi des recettes, dépenses et solde de trésorerie."
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={exportPdf}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Dialog open={openCat} onOpenChange={setOpenCat}>
              <DialogTrigger asChild>
                <Button variant="outline">Catégorie</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle catégorie</DialogTitle>
                </DialogHeader>
                <form onSubmit={createCategory} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="name" required placeholder="Salaires, Loyer, Fournitures..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Couleur</Label>
                    <Input
                      name="color"
                      type="color"
                      defaultValue="#3b6fa0"
                      className="h-10 w-20 p-1"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Créer</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={openExp} onOpenChange={setOpenExp}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Dépense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enregistrer une dépense</DialogTitle>
                </DialogHeader>
                <form onSubmit={createExpense} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Libellé</Label>
                    <Input name="label" required placeholder="Achat fournitures" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Montant</Label>
                      <Input name="amount" type="number" step="0.01" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        name="spent_at"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Catégorie</Label>
                    <Select name="category_id">
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Fournisseur</Label>
                      <Input name="supplier" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mode de paiement</Label>
                      <Input name="method" placeholder="Espèces, virement..." />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note</Label>
                    <Textarea name="note" rows={2} />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Enregistrer</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recettes</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-success">
              {fmt(totals.revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{payments.length} encaissement(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-destructive">
              {fmt(totals.spent)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} ligne(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)] bg-[image:var(--gradient-primary)] text-primary-foreground">
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium opacity-90">Solde</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{fmt(totals.balance)}</div>
            <p className="text-xs opacity-80 mt-1">Trésorerie nette</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display">Journal</CardTitle>
            <CardDescription>Recettes et dépenses récentes</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="expenses">
              <TabsList>
                <TabsTrigger value="expenses">Dépenses</TabsTrigger>
                <TabsTrigger value="revenue">Recettes</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Aucune dépense.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(e.spent_at).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {e.label}
                            {e.supplier && (
                              <div className="text-xs text-muted-foreground">{e.supplier}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {e.expense_categories ? (
                              <Badge
                                style={{
                                  backgroundColor: e.expense_categories.color,
                                  color: "#fff",
                                }}
                              >
                                {e.expense_categories.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            <ArrowDownRight className="inline h-3 w-3" /> {fmt(e.amount)}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteExpense(e.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="revenue">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Aucun encaissement.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(p.paid_at).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {p.invoices?.students?.last_name} {p.invoices?.students?.first_name}
                          </TableCell>
                          <TableCell>{p.invoices?.label}</TableCell>
                          <TableCell className="text-right font-medium text-success">
                            <ArrowUpRight className="inline h-3 w-3" /> {fmt(p.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display">Répartition</CardTitle>
            <CardDescription>Dépenses par catégorie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune dépense à analyser.</p>
            ) : (
              byCategory.map((c) => {
                const pct = totals.spent ? Math.round((c.total / totals.spent) * 100) : 0;
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="text-muted-foreground">
                        {fmt(c.total)} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="font-display">Évolution mensuelle</CardTitle>
          <CardDescription>Recettes vs dépenses sur les 12 derniers mois</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="recettes" fill="hsl(var(--success, 142 71% 45%))" name="Recettes" />
              <Bar dataKey="depenses" fill="hsl(var(--destructive))" name="Dépenses" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
