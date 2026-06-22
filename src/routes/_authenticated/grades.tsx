import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { Plus, Loader2, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { ExportMenu } from "@/components/export-menu";
import { SEMESTERS, EVAL_CC, EVAL_COMPO } from "@/lib/report-card";

export const Route = createFileRoute("/_authenticated/grades")({
  component: GradesPage,
});

function GradesPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSubject, setOpenSubject] = useState(false);

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("*, students(first_name,last_name,matricule), subjects(name,coefficient)")
        .order("recorded_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-min"],
    queryFn: async () =>
      (await supabase.from("students").select("id,first_name,last_name").order("last_name")).data ??
      [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () =>
      (await supabase.from("subjects").select("id,name,coefficient").order("name")).data ?? [],
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez votre école.");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("grades").insert({
      school_id: schoolId,
      student_id: String(fd.get("student_id")),
      subject_id: String(fd.get("subject_id")),
      score: Number(fd.get("score")),
      max_score: Number(fd.get("max_score") ?? 20),
      term: String(fd.get("term")),
      evaluation_type: String(fd.get("evaluation_type") || ""),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Note enregistrée");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["grades"] });
  }

  async function createSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("Configurez votre école.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("subjects").insert({
      school_id: schoolId,
      name: String(fd.get("name")),
      coefficient: Number(fd.get("coefficient") || 1),
    });
    if (error) return toast.error(error.message);
    toast.success("Matière ajoutée");
    setOpenSubject(false);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  const exportColumns = ["Élève", "Matricule", "Matière", "Note", "Coefficient", "Période", "Type"];
  const exportRows: Array<Array<string | number>> = grades.map((g: any) => [
    `${g.students?.last_name ?? ""} ${g.students?.first_name ?? ""}`.trim(),
    g.students?.matricule ?? "",
    g.subjects?.name ?? "",
    `${g.score}/${g.max_score}`,
    g.subjects?.coefficient ?? "",
    g.term ?? "",
    g.evaluation_type ?? "",
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & évaluations"
        description="Saisissez les notes par matière, par élève et par période."
        action={
          <div className="flex gap-2">
            <ExportMenu
              filename="notes"
              title="Notes & évaluations"
              columns={exportColumns}
              rows={exportRows}
              subtitle={new Date().toLocaleDateString("fr-FR")}
            />
            <GradeGrid schoolId={schoolId} />
            <Dialog open={openSubject} onOpenChange={setOpenSubject}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Matière
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter une matière</DialogTitle>
                </DialogHeader>
                <form onSubmit={createSubject} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coefficient</Label>
                    <Input name="coefficient" type="number" step="0.5" defaultValue={1} />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Ajouter</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Saisir une note
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle note</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Élève</Label>
                    <Select name="student_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.last_name} {s.first_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Matière</Label>
                    <Select name="subject_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label>Note</Label>
                      <Input name="score" type="number" step="0.25" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sur</Label>
                      <Input name="max_score" type="number" defaultValue={20} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Semestre</Label>
                      <Select name="term" defaultValue={SEMESTERS[0]}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMESTERS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select name="evaluation_type" defaultValue={EVAL_CC}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EVAL_CC}>Contrôle continu (C.C)</SelectItem>
                        <SelectItem value={EVAL_COMPO}>Composition</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Période</TableHead>
                <TableHead className="text-right">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : grades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucune note saisie.
                  </TableCell>
                </TableRow>
              ) : (
                grades.map((g: any) => {
                  const pct = (Number(g.score) / Number(g.max_score)) * 100;
                  const color = pct >= 50 ? "default" : "destructive";
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(g.recorded_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {g.students?.last_name} {g.students?.first_name}
                      </TableCell>
                      <TableCell>{g.subjects?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{g.term}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={color as any}>
                          {g.score}/{g.max_score}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function GradeGrid({ schoolId }: { schoolId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState<string>(SEMESTERS[0]);
  const [vals, setVals] = useState<Record<string, { cc: string; compo: string }>>({});
  const [saving, setSaving] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-min", schoolId],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("subjects").select("id,name").order("name")).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["grid-students", classId],
    enabled: open && !!classId,
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id,first_name,last_name,matricule")
          .eq("class_id", classId)
          .order("last_name")
      ).data ?? [],
  });
  const { data: existing = [] } = useQuery({
    queryKey: ["grid-grades", classId, subjectId, term],
    enabled: open && !!classId && !!subjectId,
    queryFn: async () =>
      (
        await supabase
          .from("grades")
          .select("id,student_id,evaluation_type,score")
          .eq("subject_id", subjectId)
          .eq("term", term)
      ).data ?? [],
  });

  useEffect(() => {
    const map: Record<string, { cc: string; compo: string }> = {};
    for (const st of students as any[]) map[st.id] = { cc: "", compo: "" };
    for (const g of existing as any[]) {
      if (!map[g.student_id]) continue;
      if (g.evaluation_type === EVAL_COMPO) map[g.student_id].compo = String(g.score ?? "");
      else map[g.student_id].cc = String(g.score ?? "");
    }
    setVals(map);
  }, [students, existing]);

  const findExisting = (studentId: string, type: string) =>
    (existing as any[]).find(
      (g) => g.student_id === studentId && (g.evaluation_type ?? "") === type,
    );

  async function saveAll() {
    if (!schoolId || !subjectId || !classId) return;
    setSaving(true);
    try {
      const ops: any[] = [];
      for (const st of students as any[]) {
        const v = vals[st.id] ?? { cc: "", compo: "" };
        const entries: [string, string][] = [
          [EVAL_CC, v.cc],
          [EVAL_COMPO, v.compo],
        ];
        for (const [type, raw] of entries) {
          const val = String(raw).trim();
          if (val === "") continue;
          const score = Number(val);
          if (Number.isNaN(score)) continue;
          const ex = findExisting(st.id, type);
          if (ex) {
            ops.push(supabase.from("grades").update({ score }).eq("id", ex.id));
          } else {
            ops.push(
              supabase.from("grades").insert({
                school_id: schoolId,
                student_id: st.id,
                subject_id: subjectId,
                score,
                max_score: 20,
                term,
                evaluation_type: type,
              } as any),
            );
          }
        }
      }
      if (!ops.length) {
        toast.info("Aucune note à enregistrer.");
        return;
      }
      const results = await Promise.all(ops);
      const err = results.find((r: any) => r?.error);
      if (err?.error) {
        toast.error(err.error.message);
        return;
      }
      toast.success("Notes enregistrées");
      qc.invalidateQueries({ queryKey: ["grades"] });
      qc.invalidateQueries({ queryKey: ["grid-grades", classId, subjectId, term] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LayoutGrid className="h-4 w-4 mr-2" />
          Grille CC/Compo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Saisie des notes par classe</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>Classe</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {(classes as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Matière</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Matière" />
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
          <div className="space-y-1.5">
            <Label>Semestre</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto rounded border mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead className="w-28">C.C /20</TableHead>
                <TableHead className="w-28">Compo /20</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!classId || !subjectId ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Choisissez une classe et une matière.
                  </TableCell>
                </TableRow>
              ) : (students as any[]).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Aucun élève.
                  </TableCell>
                </TableRow>
              ) : (
                (students as any[]).map((st) => (
                  <TableRow key={st.id}>
                    <TableCell className="font-medium">
                      {st.last_name} {st.first_name}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={vals[st.id]?.cc ?? ""}
                        onChange={(e) =>
                          setVals((p) => ({
                            ...p,
                            [st.id]: { ...(p[st.id] ?? { cc: "", compo: "" }), cc: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={vals[st.id]?.compo ?? ""}
                        onChange={(e) =>
                          setVals((p) => ({
                            ...p,
                            [st.id]: {
                              ...(p[st.id] ?? { cc: "", compo: "" }),
                              compo: e.target.value,
                            },
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button onClick={saveAll} disabled={saving || !classId || !subjectId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer les notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
