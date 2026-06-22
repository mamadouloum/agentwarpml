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
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Plus, Search, Loader2, Link2, X, Wand2 } from "lucide-react";
import { generateStudentMatricule } from "@/lib/matricule";
import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matricule, setMatricule] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  async function fillAutoMatricule() {
    if (!schoolId) return;
    setGenLoading(true);
    try {
      setMatricule(await generateStudentMatricule(schoolId));
    } finally {
      setGenLoading(false);
    }
  }

  useEffect(() => {
    if (open && schoolId && !matricule) void fillAutoMatricule();
    if (!open) setMatricule("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schoolId]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", q],
    queryFn: async () => {
      let req = supabase
        .from("students")
        .select("*, classes(name)")
        .order("created_at", { ascending: false });
      if (q) req = req.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,matricule.ilike.%${q}%`);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id,name").order("name");
      return data ?? [];
    },
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) {
      toast.error("Configurez d'abord votre école.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("students").insert({
      school_id: schoolId,
      matricule: String(fd.get("matricule") || matricule),
      first_name: String(fd.get("first_name")),
      last_name: String(fd.get("last_name")),
      gender: (fd.get("gender") as "M" | "F") || null,
      birth_date: (fd.get("birth_date") as string) || null,
      birth_place: (fd.get("birth_place") as string) || null,
      class_id: (fd.get("class_id") as string) || null,
      parent_name: (fd.get("parent_name") as string) || null,
      parent_phone: (fd.get("parent_phone") as string) || null,
      parent_email: (fd.get("parent_email") as string) || null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Élève ajouté");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Élèves"
        description="Gérez les inscriptions et fiches élèves de votre établissement."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Nouvel élève
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Inscrire un élève</DialogTitle>
                <DialogDescription>Renseignez les informations principales.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Matricule</Label>
                    <div className="flex gap-2">
                      <Input
                        name="matricule"
                        required
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                        placeholder="Généré automatiquement"
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fillAutoMatricule}
                        disabled={genLoading || !schoolId}
                        title="Régénérer"
                      >
                        {genLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format : CODE-ANNÉE-N° séquentiel. Modifiable.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prénom</Label>
                    <Input name="first_name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="last_name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date de naissance</Label>
                    <Input name="birth_date" type="date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Genre</Label>
                    <Select name="gender">
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Lieu de naissance</Label>
                    <Input name="birth_place" placeholder="ex. Dakar" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Classe</Label>
                    <Select name="class_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une classe..." />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom du parent</Label>
                    <Input name="parent_name" placeholder="Mme/M. ..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone parent</Label>
                    <Input name="parent_phone" type="tel" placeholder="+221 ..." />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Email parent</Label>
                    <Input name="parent_email" type="email" placeholder="parent@email.com" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un élève..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom complet</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun élève inscrit.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.matricule}</TableCell>
                    <TableCell className="font-medium">
                      {s.last_name} {s.first_name}
                    </TableCell>
                    <TableCell>
                      {s.classes?.name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.gender ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.parent_name ?? <span className="text-muted-foreground">—</span>}
                      <div className="text-xs text-muted-foreground">{s.parent_phone}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <LinkParentButton studentId={s.id} schoolId={s.school_id} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkParentButton({ studentId, schoolId }: { studentId: string; schoolId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["school-profiles", schoolId],
    enabled: open && !!schoolId,
    queryFn: async () =>
      (await supabase.from("profiles").select("id,first_name,last_name").eq("school_id", schoolId))
        .data ?? [],
  });

  const { data: links = [] } = useQuery({
    queryKey: ["student-parents", studentId],
    enabled: open,
    queryFn: async () =>
      (
        await supabase
          .from("student_parents")
          .select("id,parent_user_id")
          .eq("student_id", studentId)
      ).data ?? [],
  });

  async function addLink() {
    if (!parentId) return;
    const { error } = await supabase
      .from("student_parents")
      .insert({ student_id: studentId, parent_user_id: parentId, school_id: schoolId });
    if (error) return toast.error(error.message);
    toast.success("Parent lié");
    setParentId("");
    qc.invalidateQueries({ queryKey: ["student-parents", studentId] });
  }

  async function removeLink(id: string) {
    const { error } = await supabase.from("student_parents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["student-parents", studentId] });
  }

  const linkedIds = new Set(links.map((l: any) => l.parent_user_id));
  const available = profiles.filter((p: any) => !linkedIds.has(p.id));
  const nameOf = (id: string) => {
    const p: any = profiles.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Link2 className="h-4 w-4 mr-1" />
          Parents
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comptes parents liés</DialogTitle>
          <DialogDescription>
            Donnez accès au portail famille à un ou plusieurs comptes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {links.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun parent lié.</p>
            )}
            {links.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{nameOf(l.parent_user_id)}</span>
                <Button size="icon" variant="ghost" onClick={() => removeLink(l.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un compte..." />
              </SelectTrigger>
              <SelectContent>
                {available.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addLink} disabled={!parentId}>
              Lier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
