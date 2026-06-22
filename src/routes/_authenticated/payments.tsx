import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { ExportMenu } from "@/components/export-menu";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

const statusVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  paid: "default", pending: "secondary", partial: "outline", overdue: "destructive",
};
const statusLabel: Record<string, string> = { paid: "Payé", pending: "En attente", partial: "Partiel", overdue: "En retard" };

function PaymentsPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [openPay, setOpenPay] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, students(first_name,last_name,matricule)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-min"],
    queryFn: async () => (await supabase.from("students").select("id,first_name,last_name").order("last_name")).data ?? [],
  });

  async function createInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez votre école.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("invoices").insert({
      school_id: schoolId,
      student_id: String(fd.get("student_id")),
      label: String(fd.get("label")),
      amount: Number(fd.get("amount")),
      due_date: (fd.get("due_date") as string) || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Facture créée");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  async function recordPayment(e: React.FormEvent<HTMLFormElement>, invoice: any) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const { error } = await supabase.from("payments").insert({
      invoice_id: invoice.id,
      school_id: invoice.school_id,
      amount,
      method: String(fd.get("method") || ""),
    });
    if (error) return toast.error(error.message);
    const newPaid = Number(invoice.amount_paid) + amount;
    const newStatus = newPaid >= Number(invoice.amount) ? "paid" : "partial";
    await supabase.from("invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", invoice.id);
    toast.success("Paiement enregistré");
    setOpenPay(null);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  const exportColumns = ["Matricule", "Élève", "Libellé", "Montant", "Payé", "Reste", "Échéance", "Statut"];
  const exportRows: Array<Array<string | number>> = invoices.map((i: any) => [
    i.students?.matricule ?? "",
    `${i.students?.last_name ?? ""} ${i.students?.first_name ?? ""}`.trim(),
    i.label ?? "",
    Number(i.amount).toLocaleString(),
    Number(i.amount_paid ?? 0).toLocaleString(),
    Math.max(0, Number(i.amount) - Number(i.amount_paid ?? 0)).toLocaleString(),
    i.due_date ? new Date(i.due_date).toLocaleDateString("fr-FR") : "",
    statusLabel[i.status] ?? i.status,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements"
        description="Facturez la scolarité et suivez les encaissements."
        action={
          <div className="flex gap-2">
            <ExportMenu filename="factures" title="Factures & paiements" subtitle={new Date().toLocaleDateString("fr-FR")} columns={exportColumns} rows={exportRows} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouvelle facture</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une facture</DialogTitle></DialogHeader>
              <form onSubmit={createInvoice} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Élève</Label>
                  <Select name="student_id" required>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Libellé</Label><Input name="label" required placeholder="Scolarité - Trimestre 1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Montant</Label><Input name="amount" type="number" step="0.01" required /></div>
                  <div className="space-y-1.5"><Label>Échéance</Label><Input name="due_date" type="date" /></div>
                </div>
                <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Libellé</TableHead><TableHead>Montant</TableHead><TableHead>Payé</TableHead><TableHead>Statut</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune facture.</TableCell></TableRow>
              ) : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.students?.last_name} {inv.students?.first_name}</TableCell>
                  <TableCell>{inv.label}</TableCell>
                  <TableCell>{Number(inv.amount).toLocaleString("fr-FR")} F</TableCell>
                  <TableCell className="text-success font-medium">{Number(inv.amount_paid).toLocaleString("fr-FR")} F</TableCell>
                  <TableCell><Badge variant={statusVariant[inv.status]}>{statusLabel[inv.status]}</Badge></TableCell>
                  <TableCell>
                    <Dialog open={openPay === inv.id} onOpenChange={(o) => setOpenPay(o ? inv.id : null)}>
                      <DialogTrigger asChild><Button size="sm" variant="ghost" disabled={inv.status === "paid"}><CreditCard className="h-4 w-4 mr-1" />Encaisser</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Encaisser un paiement</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => recordPayment(e, inv)} className="space-y-3">
                          <div className="space-y-1.5"><Label>Montant</Label><Input name="amount" type="number" step="0.01" required defaultValue={Number(inv.amount) - Number(inv.amount_paid)} /></div>
                          <div className="space-y-1.5"><Label>Mode</Label><Input name="method" placeholder="Espèces, virement..." /></div>
                          <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
