import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { Save } from "lucide-react";
import { ExportMenu } from "@/components/export-menu";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const statusColors: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  present: "default",
  absent: "destructive",
  late: "secondary",
  excused: "outline",
};

function AttendancePage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState<string>("");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () =>
      (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-by-class", classId],
    enabled: !!classId,
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
    queryKey: ["attendance", date, classId],
    enabled: !!classId,
    queryFn: async () => {
      const ids = students.map((s: any) => s.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("attendances")
        .select("*")
        .eq("date", date)
        .in("student_id", ids);
      return data ?? [];
    },
  });

  const [marks, setMarks] = useState<Record<string, string>>({});
  const getStatus = (id: string) =>
    marks[id] ?? existing.find((e: any) => e.student_id === id)?.status ?? "present";

  async function save() {
    if (!schoolId || !classId) return;
    const rows = students.map((s: any) => ({
      school_id: schoolId,
      student_id: s.id,
      date,
      status: getStatus(s.id) as any,
    }));
    const { error } = await supabase
      .from("attendances")
      .upsert(rows, { onConflict: "student_id,date" });
    if (error) return toast.error(error.message);
    toast.success("Présences enregistrées");
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  const exportColumns = ["Matricule", "Élève", "Statut"];
  const exportRows: Array<Array<string | number>> = students.map((s: any) => [
    s.matricule ?? "",
    `${s.last_name} ${s.first_name}`,
    getStatus(s.id),
  ]);
  const className = classes.find((c: any) => c.id === classId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Présences"
        description="Faites l'appel et suivez l'assiduité de vos élèves."
        action={
          <ExportMenu
            filename={`presences-${date}`}
            title="Feuille de présence"
            subtitle={`${className} — ${new Date(date).toLocaleDateString("fr-FR")}`}
            columns={exportColumns}
            rows={exportRows}
          />
        }
      />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Classe</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="ml-auto" onClick={save} disabled={!classId || students.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer l'appel
            </Button>
          </div>

          {classId ? (
            students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun élève dans cette classe.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s: any) => {
                    const status = getStatus(s.id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.matricule}</TableCell>
                        <TableCell className="font-medium">
                          {s.last_name} {s.first_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            {(["present", "absent", "late", "excused"] as const).map((st) => (
                              <Badge
                                key={st}
                                variant={status === st ? statusColors[st] : "outline"}
                                className="cursor-pointer"
                                onClick={() => setMarks({ ...marks, [s.id]: st })}
                              >
                                {st === "present"
                                  ? "Présent"
                                  : st === "absent"
                                    ? "Absent"
                                    : st === "late"
                                      ? "Retard"
                                      : "Justifié"}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sélectionnez une classe pour faire l'appel.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
