import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SuperAdminGate, SuperAdminNav } from "@/lib/super-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pause, Play, Trash2, Plus, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/schools")({
  component: () => (
    <SuperAdminGate>
      <SuperAdminNav />
      <SchoolsAdmin />
    </SuperAdminGate>
  ),
});

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  suspended: "secondary",
  expired: "destructive",
};
const statusLabel: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  expired: "Expiré",
};

function SchoolsAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", email: "", phone: "", address: "" });

  const { data: schools = [] } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = schools.filter((s) =>
    [s.name, s.email, s.address, s.code]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
  );

  async function setStatus(id: string, status: "active" | "suspended" | "expired") {
    const { error } = await supabase.from("schools").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("platform_audit_logs").insert({
        actor_id: u.user.id,
        action: `school.${status}`,
        target_type: "school",
        target_id: id,
      });
    }
    toast.success("Statut mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-schools"] });
  }

  function copyPortal(code: string) {
    const url = `${window.location.origin}/e/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Lien portail copié"),
      () => toast.error("Copie impossible"),
    );
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cet établissement ?")) return;
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Établissement supprimé");
    qc.invalidateQueries({ queryKey: ["admin-schools"] });
  }

  async function create() {
    if (!form.name || !form.code) return toast.error("Nom et code requis");
    const { error } = await supabase.from("schools").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Établissement créé");
    setOpen(false);
    setForm({ name: "", code: "", email: "", phone: "", address: "" });
    qc.invalidateQueries({ queryKey: ["admin-schools"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Établissements"
        description="Gérez toutes les écoles de la plateforme."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardContent className="p-4">
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm mb-4"
          />
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créée</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[s.status] ?? "default"}>
                        {statusLabel[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyPortal(s.code)}
                        title="Copier le lien du portail"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {s.status !== "suspended" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(s.id, "suspended")}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(s.id, "active")}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucun établissement.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel établissement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nom *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Code unique *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              placeholder="Téléphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              placeholder="Adresse"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
