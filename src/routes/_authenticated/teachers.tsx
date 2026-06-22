import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GraduationCap, Wand2, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/teachers")({
  component: TeachersPage,
});

function TeachersPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [klass, setKlass] = useState("");
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");

  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher-assignments", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (await supabase
        .from("teacher_assignments")
        .select("*, classes(name), subjects(name)")
        .eq("school_id", schoolId!)).data ?? [],
  });

  // Only profiles that have the teacher role
  const { data: teacherProfiles = [] } = useQuery({
    queryKey: ["school-teachers", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,first_name,last_name")
        .eq("school_id", schoolId!)
        .in("id", ids);
      return data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-min"],
    queryFn: async () => (await supabase.from("subjects").select("id,name").order("name")).data ?? [],
  });

  async function add() {
    if (!schoolId || !teacher || !klass) return toast.error("Sélectionnez enseignant et classe.");
    const { error } = await supabase.from("teacher_assignments").insert({
      school_id: schoolId, teacher_user_id: teacher, class_id: klass, subject_id: subject || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Affectation ajoutée");
    setOpen(false); setTeacher(""); setKlass(""); setSubject("");
    qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
  }

  // Auto-affect a teacher to every class with no existing assignment for them
  async function autoAssignAllClasses(teacherId: string) {
    if (!schoolId) return;
    const existing = new Set(
      assignments.filter((a: any) => a.teacher_user_id === teacherId).map((a: any) => a.class_id),
    );
    const rows = classes
      .filter((c: any) => !existing.has(c.id))
      .map((c: any) => ({ school_id: schoolId, teacher_user_id: teacherId, class_id: c.id, subject_id: null }));
    if (!rows.length) return toast.info("Déjà affecté à toutes les classes.");
    const { error } = await supabase.from("teacher_assignments").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} classe(s) ajoutée(s).`);
    qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
  }

  // Auto-distribute: assign each unassigned class to a teacher (round-robin)
  async function autoDistribute() {
    if (!schoolId) return;
    if (teacherProfiles.length === 0) return toast.error("Aucun enseignant disponible.");
    const coveredClasses = new Set(assignments.map((a: any) => a.class_id));
    const toCover = classes.filter((c: any) => !coveredClasses.has(c.id));
    if (!toCover.length) return toast.info("Toutes les classes ont déjà un enseignant.");
    const rows = toCover.map((c: any, i: number) => ({
      school_id: schoolId,
      teacher_user_id: teacherProfiles[i % teacherProfiles.length].id,
      class_id: c.id,
      subject_id: null,
    }));
    const { error } = await supabase.from("teacher_assignments").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} classe(s) attribuée(s) automatiquement.`);
    qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
  }

  const nameOf = (id: string) => {
    const p: any = teacherProfiles.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8);
  };

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teacherProfiles;
    return teacherProfiles.filter((p: any) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q),
    );
  }, [teacherProfiles, search]);

  const byTeacher: Record<string, any[]> = {};
  assignments.forEach((a: any) => { (byTeacher[a.teacher_user_id] ||= []).push(a); });

  const byClass: Record<string, any[]> = {};
  assignments.forEach((a: any) => { (byClass[a.class_id] ||= []).push(a); });

  const coveredCount = Object.keys(byClass).length;
  const assignedTeachers = Object.keys(byTeacher).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enseignants & affectations"
        description="Vue d'ensemble des enseignants, des classes couvertes, et association automatique."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={autoDistribute}>
              <Wand2 className="h-4 w-4 mr-2" /> Auto-distribuer
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Affecter</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouvelle affectation</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Enseignant</Label>
                    <Select value={teacher} onValueChange={setTeacher}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>{teacherProfiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Classe</Label>
                    <Select value={klass} onValueChange={setKlass}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Matière (optionnel)</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                      <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={add}>Ajouter</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Users className="h-4 w-4" />} label="Enseignants" value={teacherProfiles.length} />
        <Stat icon={<GraduationCap className="h-4 w-4" />} label="Affectés" value={assignedTeachers} hint={`${teacherProfiles.length - assignedTeachers} sans classe`} />
        <Stat icon={<BookOpen className="h-4 w-4" />} label="Classes couvertes" value={`${coveredCount}/${classes.length}`} />
        <Stat icon={<Wand2 className="h-4 w-4" />} label="Affectations" value={assignments.length} />
      </div>

      <Tabs defaultValue="by-teacher">
        <TabsList>
          <TabsTrigger value="by-teacher"><Users className="h-4 w-4 mr-2" />Par enseignant</TabsTrigger>
          <TabsTrigger value="by-class"><BookOpen className="h-4 w-4 mr-2" />Par classe</TabsTrigger>
        </TabsList>

        <TabsContent value="by-teacher" className="space-y-4 mt-4">
          <Input placeholder="Rechercher un enseignant..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

          {filteredTeachers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Aucun enseignant. Créez un compte enseignant depuis la gestion des utilisateurs.
            </CardContent></Card>
          ) : filteredTeachers.map((p: any) => {
            const items = byTeacher[p.id] ?? [];
            return (
              <Card key={p.id}>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-muted-foreground">{items.length} affectation(s)</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => autoAssignAllClasses(p.id)}>
                      <Wand2 className="h-4 w-4 mr-2" /> Toutes les classes
                    </Button>
                  </div>
                  {items.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Aucune classe attribuée.</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Classe</TableHead><TableHead>Matière</TableHead><TableHead className="text-right">Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {items.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell>{a.classes?.name || "—"}</TableCell>
                            <TableCell>{a.subjects?.name ? <Badge variant="outline">{a.subjects.name}</Badge> : <span className="text-muted-foreground text-sm">Toutes</span>}</TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="by-class" className="space-y-3 mt-4">
          {classes.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune classe.</CardContent></Card>
          ) : classes.map((c: any) => (
            <ClassEditor
              key={c.id}
              klass={c}
              items={byClass[c.id] ?? []}
              teachers={teacherProfiles}
              subjects={subjects}
              nameOf={nameOf}
              onAdd={async (teacherId, subjectId) => {
                if (!schoolId) return;
                const dup = (byClass[c.id] ?? []).some((a: any) => a.teacher_user_id === teacherId && (a.subject_id ?? null) === (subjectId || null));
                if (dup) return toast.info("Affectation déjà existante.");
                const { error } = await supabase.from("teacher_assignments").insert({
                  school_id: schoolId, teacher_user_id: teacherId, class_id: c.id, subject_id: subjectId || null,
                });
                if (error) return toast.error(error.message);
                toast.success("Enseignant ajouté");
                qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
              }}
              onRemove={remove}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {icon}{label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-bold font-display">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ClassEditor({
  klass, items, teachers, subjects, nameOf, onAdd, onRemove,
}: {
  klass: any;
  items: any[];
  teachers: any[];
  subjects: any[];
  nameOf: (id: string) => string;
  onAdd: (teacherId: string, subjectId: string) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}) {
  const [t, setT] = useState("");
  const [s, setS] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!t) return toast.error("Choisissez un enseignant.");
    setSaving(true);
    try { await onAdd(t, s); setT(""); setS(""); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold">{klass.name}</div>
          {items.length === 0
            ? <Badge variant="destructive">Non couverte</Badge>
            : <Badge variant="outline">{items.length} enseignant(s)</Badge>}
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {items.length === 0 ? (
            <span className="text-sm text-muted-foreground italic">Aucun enseignant attribué.</span>
          ) : items.map((a: any) => (
            <Badge key={a.id} variant="secondary" className="font-normal gap-1.5 pr-1">
              {nameOf(a.teacher_user_id)}{a.subjects?.name ? ` · ${a.subjects.name}` : ""}
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="rounded-full hover:bg-destructive/20 p-0.5"
                aria-label="Retirer"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2 pt-2 border-t">
          <Select value={t} onValueChange={setT}>
            <SelectTrigger><SelectValue placeholder="Enseignant..." /></SelectTrigger>
            <SelectContent>
              {teachers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={s} onValueChange={setS}>
            <SelectTrigger><SelectValue placeholder="Matière (optionnel)" /></SelectTrigger>
            <SelectContent>
              {subjects.map((sub: any) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={!t || saving}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
