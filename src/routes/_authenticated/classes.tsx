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
import { Plus, Loader2, Users, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

const LEVELS = ["Maternelle", "Primaire", "Collège", "Lycée", "Supérieur"];

export const Route = createFileRoute("/_authenticated/classes")({
  component: ClassesPage,
});

function ClassesPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*, students(count)").order("name");
      return data ?? [];
    },
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez d'abord votre école.");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("classes").insert({
      school_id: schoolId,
      name: String(fd.get("name")),
      level: (fd.get("level") as string) || null,
      academic_year: String(fd.get("academic_year")),
      main_teacher_id: (fd.get("main_teacher_id") as string) || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Classe créée");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["classes"] });
  }

  const { data: teachers = [] } = useQuery({
    queryKey: ["teacher-profiles", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("school_id", schoolId!)
        .eq("role", "teacher");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,first_name,last_name")
        .in("id", ids);
      return data ?? [];
    },
  });

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Organisez vos niveaux, sections et années scolaires."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle classe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une classe</DialogTitle>
                <DialogDescription>
                  Définissez la classe, son niveau et l'enseignant principal.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nom de la classe</Label>
                  <Input name="name" required placeholder="ex. 6ème A, CP1, Terminale S2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Niveau</Label>
                    <Select name="level">
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Année scolaire</Label>
                    <Input
                      name="academic_year"
                      required
                      defaultValue={`${currentYear}-${currentYear + 1}`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Enseignant principal (optionnel)</Label>
                  <Select name="main_teacher_id">
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          teachers.length ? "Choisir..." : "Aucun enseignant — invitez-en d'abord"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.first_name} {t.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer la classe
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Année</TableHead>
                <TableHead>Effectif</TableHead>
                <TableHead className="text-right">Matières</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucune classe créée.
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.level ?? "—"}</TableCell>
                    <TableCell>{c.academic_year}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.students?.[0]?.count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ClassSubjectsManager
                        classId={c.id}
                        schoolId={schoolId}
                        teachers={teachers}
                      />
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

function ClassSubjectsManager({
  classId,
  schoolId,
  teachers,
}: {
  classId: string;
  schoolId: string | null;
  teachers: any[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [coef, setCoef] = useState("");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-min", schoolId],
    enabled: open && !!schoolId,
    queryFn: async () =>
      (await supabase.from("subjects").select("id,name,coefficient").order("name")).data ?? [],
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["class-subjects", classId],
    enabled: open,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("class_subjects")
          .select("*")
          .eq("class_id", classId)
          .order("position")
      ).data ?? [],
  });

  const subjectName = (id: string) => (subjects as any[]).find((s) => s.id === id)?.name ?? "—";
  const teacherName = (id: string | null) => {
    const t = teachers.find((t: any) => t.id === id);
    return t ? `${t.first_name} ${t.last_name}` : "—";
  };

  async function add() {
    if (!schoolId || !subjectId) return;
    const subj = (subjects as any[]).find((s) => s.id === subjectId);
    const coefficient = coef !== "" ? Number(coef) : Number(subj?.coefficient ?? 1);
    const { error } = await (supabase as any).from("class_subjects").insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId || null,
      coefficient,
      position: (rows as any[]).length,
    });
    if (error) return toast.error(error.message);
    if (teacherId) {
      await (supabase as any)
        .from("teacher_assignments")
        .upsert(
          {
            school_id: schoolId,
            teacher_user_id: teacherId,
            class_id: classId,
            subject_id: subjectId,
          },
          { onConflict: "teacher_user_id,class_id,subject_id" },
        );
    }
    setSubjectId("");
    setTeacherId("");
    setCoef("");
    qc.invalidateQueries({ queryKey: ["class-subjects", classId] });
    toast.success("Matière ajoutée");
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("class_subjects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["class-subjects", classId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <BookOpen className="h-4 w-4 mr-1" />
          Matières
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Matières & professeurs de la classe</DialogTitle>
          <DialogDescription>
            Ces matières, coefficients et professeurs apparaissent sur le bulletin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2 max-h-64 overflow-auto">
            {(rows as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune matière pour cette classe.</p>
            )}
            {(rows as any[]).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{subjectName(r.subject_id)}</span>{" "}
                  <span className="text-muted-foreground">
                    · coef {r.coefficient ?? "—"} · {teacherName(r.teacher_id)}
                  </span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-2 items-end border-t pt-3">
            <div className="col-span-5 space-y-1.5">
              <Label className="text-xs">Matière</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {(subjects as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-4 space-y-1.5">
              <Label className="text-xs">Professeur</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Coef</Label>
              <Input
                value={coef}
                onChange={(e) => setCoef(e.target.value)}
                type="number"
                step="0.5"
                placeholder="1"
              />
            </div>
            <div className="col-span-1">
              <Button size="icon" onClick={add} disabled={!subjectId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
