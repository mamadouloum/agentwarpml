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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";

export const Route = createFileRoute("/_authenticated/schedule")({
  component: SchedulePage,
});

const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function SchedulePage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<string>("");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id,name").order("name")).data ?? [],
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("schedules").select("*, subjects(name)").eq("class_id", classId).order("start_time")).data ?? [],
  });

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId || !classId) return toast.error("Sélectionnez une classe.");
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("schedules").insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: String(fd.get("subject_id")),
      day_of_week: Number(fd.get("day_of_week")),
      start_time: String(fd.get("start_time")),
      end_time: String(fd.get("end_time")),
      room: (fd.get("room") as string) || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Créneau ajouté");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["schedules"] });
  }

  const byDay = days.map((_, i) => schedules.filter((s: any) => s.day_of_week === i + 1));

  return (
    <div className="space-y-6">
      <PageHeader title="Emploi du temps" description="Planifiez les cours par classe et créneau horaire." />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="ml-auto" disabled={!classId}><Plus className="h-4 w-4 mr-2" />Ajouter un cours</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau créneau</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Matière</Label>
                    <Select name="subject_id" required>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label>Jour</Label>
                      <Select name="day_of_week" required defaultValue="1">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{days.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Début</Label><Input name="start_time" type="time" required /></div>
                    <div className="space-y-1.5"><Label>Fin</Label><Input name="end_time" type="time" required /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Salle</Label><Input name="room" /></div>
                  <DialogFooter><Button type="submit">Ajouter</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {classId ? (
            <div className="grid grid-cols-7 gap-2 mt-4">
              {days.map((d, i) => (
                <div key={d} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">{d}</div>
                  <div className="space-y-2 min-h-48 rounded-lg border border-dashed border-border p-2 bg-secondary/30">
                    {byDay[i].map((s: any) => (
                      <div key={s.id} className="rounded-md bg-card border border-border p-2 text-xs shadow-sm">
                        <div className="font-semibold">{s.subjects?.name}</div>
                        <div className="text-muted-foreground">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</div>
                        {s.room && <div className="text-muted-foreground">Salle {s.room}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sélectionnez une classe.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
