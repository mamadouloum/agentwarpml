import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/cantine")({
  component: CantinePage,
});

function CantinePage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["cantine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cantine_subscriptions")
        .select("*, students(first_name,last_name,matricule)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-min"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id,first_name,last_name").order("last_name");
      return data ?? [];
    },
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("cantine_subscriptions").insert({
      school_id: schoolId,
      student_id: String(fd.get("student_id")),
      formula: String(fd.get("formula")),
      monthly_amount: Number(fd.get("monthly_amount")) || 0,
      start_date: (fd.get("start_date") as string) || new Date().toISOString().slice(0, 10),
      end_date: (fd.get("end_date") as string) || null,
      notes: (fd.get("notes") as string) || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Abonnement créé");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["cantine"] });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cet abonnement ?")) return;
    const { error } = await supabase.from("cantine_subscriptions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cantine"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cantine"
        description="Abonnements et formules de restauration"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nouvel abonnement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvel abonnement cantine</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Élève</Label>
                  <Select name="student_id" required>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {students.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formule</Label>
                  <Select name="formula" defaultValue="Standard">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Demi-pension">Demi-pension</SelectItem>
                      <SelectItem value="Pension complète">Pension complète</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Montant mensuel</Label><Input type="number" step="0.01" name="monthly_amount" required /></div>
                  <div><Label>Début</Label><Input type="date" name="start_date" /></div>
                </div>
                <div><Label>Fin (optionnel)</Label><Input type="date" name="end_date" /></div>
                <div><Label>Notes</Label><Input name="notes" /></div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Formule</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.students?.last_name} {s.students?.first_name}</TableCell>
                    <TableCell>{s.formula}</TableCell>
                    <TableCell>{Number(s.monthly_amount).toLocaleString()} F</TableCell>
                    <TableCell>{s.start_date}</TableCell>
                    <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {subs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun abonnement</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
