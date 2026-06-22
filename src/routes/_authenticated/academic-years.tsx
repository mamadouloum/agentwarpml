import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/academic-years")({
  component: YearsPage,
});

function YearsPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);

  const { data: years = [] } = useQuery({
    queryKey: ["academic-years", schoolId],
    enabled: !!schoolId,
    queryFn: async () => (await supabase.from("academic_years").select("*").eq("school_id", schoolId!).order("starts_on", { ascending: false })).data ?? [],
  });

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez votre école.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("academic_years").insert({
      school_id: schoolId,
      name: String(fd.get("name")),
      starts_on: String(fd.get("starts_on")),
      ends_on: String(fd.get("ends_on")),
    });
    if (error) return toast.error(error.message);
    toast.success("Année créée");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["academic-years"] });
  }

  async function setActive(id: string) {
    await supabase.from("academic_years").update({ is_active: false }).eq("school_id", schoolId!).eq("is_active", true);
    const { error } = await supabase.from("academic_years").update({ is_active: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Année active mise à jour");
    qc.invalidateQueries({ queryKey: ["academic-years"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("academic_years").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["academic-years"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Années scolaires"
        description="Gérez vos années académiques et archivez les données historiques."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouvelle année</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une année scolaire</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div className="space-y-1.5"><Label>Nom (ex: 2025-2026)</Label><Input name="name" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Début</Label><Input type="date" name="starts_on" required /></div>
                  <div className="space-y-1.5"><Label>Fin</Label><Input type="date" name="ends_on" required /></div>
                </div>
                <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Année</TableHead><TableHead>Début</TableHead><TableHead>Fin</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {years.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune année configurée.</TableCell></TableRow>}
              {years.map((y: any) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">{y.name}</TableCell>
                  <TableCell>{new Date(y.starts_on).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{new Date(y.ends_on).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{y.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Archivée</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!y.is_active && <Button size="sm" variant="ghost" onClick={() => setActive(y.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Activer</Button>}
                      <Button size="icon" variant="ghost" onClick={() => remove(y.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
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
