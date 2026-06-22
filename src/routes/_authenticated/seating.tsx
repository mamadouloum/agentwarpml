import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, useDraggable, useDroppable, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Users, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/seating")({
  component: SeatingPage,
});

function SeatingPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["seating_plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("seating_plans").select("*, classes(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId) return toast.error("École introuvable");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { data, error } = await (supabase as any).from("seating_plans").insert({
      school_id: schoolId,
      class_id: String(fd.get("class_id")),
      name: String(fd.get("name")),
      rows: Number(fd.get("rows") || 5),
      cols: Number(fd.get("cols") || 6),
    }).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plan créé");
    setOpen(false);
    setActivePlan(data.id);
    qc.invalidateQueries({ queryKey: ["seating_plans"] });
  }

  async function onDeletePlan(id: string) {
    if (!confirm("Supprimer ce plan ?")) return;
    const { error } = await (supabase as any).from("seating_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activePlan === id) setActivePlan(null);
    qc.invalidateQueries({ queryKey: ["seating_plans"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Plan de classe" description="Disposition des élèves dans la salle (glisser-déposer)" />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={activePlan ?? ""} onValueChange={setActivePlan}>
          <SelectTrigger className="w-[320px]"><SelectValue placeholder="Sélectionner un plan" /></SelectTrigger>
          <SelectContent>
            {plans.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.classes?.name} — {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouveau plan</Button></DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreate} className="space-y-4">
              <DialogHeader><DialogTitle>Créer un plan de classe</DialogTitle></DialogHeader>
              <div className="space-y-2"><Label>Classe</Label>
                <Select name="class_id" required>
                  <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Nom</Label><Input name="name" required defaultValue="Plan principal" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Rangées</Label><Input name="rows" type="number" min={1} max={20} defaultValue={5} /></div>
                <div className="space-y-2"><Label>Colonnes</Label><Input name="cols" type="number" min={1} max={20} defaultValue={6} /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {activePlan && (
          <Button variant="ghost" size="sm" onClick={() => onDeletePlan(activePlan)}>
            <Trash2 className="h-4 w-4 mr-2" />Supprimer ce plan
          </Button>
        )}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> :
        plans.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun plan. Créez-en un pour commencer.</CardContent></Card> :
        !activePlan ? <Card><CardContent className="py-12 text-center text-muted-foreground">Sélectionnez un plan ci-dessus.</CardContent></Card> :
        <PlanEditor plan={plans.find((p: any) => p.id === activePlan)} />
      }
    </div>
  );
}

function PlanEditor({ plan }: { plan: any }) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const { data: students = [] } = useQuery({
    queryKey: ["students-of-class", plan.class_id],
    queryFn: async () => (await supabase.from("students").select("id,first_name,last_name").eq("class_id", plan.class_id).order("last_name")).data ?? [],
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["seating_assignments", plan.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("seating_assignments").select("*").eq("plan_id", plan.id);
      if (error) throw error;
      return data;
    },
  });

  const byCell = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of assignments) m.set(`${a.row}-${a.col}`, a);
    return m;
  }, [assignments]);

  const assignedIds = useMemo(() => new Set(assignments.map((a: any) => a.student_id)), [assignments]);
  const unassigned = students.filter((s: any) => !assignedIds.has(s.id));

  async function placeStudent(studentId: string, row: number, col: number) {
    // remove any existing at that cell
    const existing = byCell.get(`${row}-${col}`);
    if (existing && existing.student_id === studentId) return;
    if (existing) {
      await (supabase as any).from("seating_assignments").delete().eq("id", existing.id);
    }
    // remove student's previous seat
    const prev = assignments.find((a: any) => a.student_id === studentId);
    if (prev) await (supabase as any).from("seating_assignments").delete().eq("id", prev.id);
    const { error } = await (supabase as any).from("seating_assignments").insert({ plan_id: plan.id, student_id: studentId, row, col });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["seating_assignments", plan.id] });
  }

  async function removeAssignment(id: string) {
    await (supabase as any).from("seating_assignments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["seating_assignments", plan.id] });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const studentId = String(e.active.id).replace(/^s-/, "");
    const [row, col] = String(e.over.id).replace(/^c-/, "").split("-").map(Number);
    placeStudent(studentId, row, col);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid md:grid-cols-[1fr_280px] gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{plan.classes?.name} — {plan.name}</CardTitle>
            <div className="text-xs text-muted-foreground">Tableau ↓</div>
          </CardHeader>
          <CardContent>
            <div className="h-2 bg-foreground/80 rounded mb-4" />
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${plan.cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: plan.rows * plan.cols }).map((_, idx) => {
                const row = Math.floor(idx / plan.cols);
                const col = idx % plan.cols;
                const a = byCell.get(`${row}-${col}`);
                const student = a ? students.find((s: any) => s.id === a.student_id) : null;
                return (
                  <Cell key={idx} row={row} col={col}>
                    {student ? (
                      <div className="relative group h-full w-full bg-primary/10 border-primary/40 border rounded p-2 text-xs flex flex-col items-center justify-center text-center">
                        <span className="font-medium truncate w-full">{student.first_name}</span>
                        <span className="text-muted-foreground truncate w-full">{student.last_name}</span>
                        <button onClick={() => removeAssignment(a.id)} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                      </div>
                    ) : null}
                  </Cell>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Élèves ({unassigned.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {unassigned.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">Tous placés</div> :
              unassigned.map((s: any) => <StudentChip key={s.id} student={s} />)
            }
          </CardContent>
        </Card>
      </div>
    </DndContext>
  );
}

function Cell({ row, col, children }: { row: number; col: number; children?: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `c-${row}-${col}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "aspect-square border-2 border-dashed rounded transition-colors min-h-[64px]",
        isOver ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      {children}
    </div>
  );
}

function StudentChip({ student }: { student: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `s-${student.id}` });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 p-2 rounded border bg-card text-sm cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span>{student.first_name} {student.last_name}</span>
    </div>
  );
}
