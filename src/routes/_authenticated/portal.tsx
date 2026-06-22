import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, GraduationCap, ClipboardCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  component: PortalPage,
});

function PortalPage() {
  const { data: me } = useQuery({
    queryKey: ["portal-me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["portal-students", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data: links } = await supabase
        .from("student_parents")
        .select("student_id")
        .eq("parent_user_id", me!.id);
      const ids = (links ?? []).map((l) => l.student_id);
      const { data: ownStudents } = await supabase
        .from("students")
        .select("id,first_name,last_name,matricule,classes(name)")
        .eq("student_user_id", me!.id);
      if (ids.length) {
        const { data: kids } = await supabase
          .from("students")
          .select("id,first_name,last_name,matricule,classes(name)")
          .in("id", ids);
        return [...(ownStudents ?? []), ...(kids ?? [])];
      }
      return ownStudents ?? [];
    },
  });

  const studentIds = students.map((s: any) => s.id);

  const { data: grades = [] } = useQuery({
    queryKey: ["portal-grades", studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("grades")
          .select("*, subjects(name), students(first_name,last_name)")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["portal-attendance", studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("attendances")
          .select("*, students(first_name,last_name)")
          .in("student_id", studentIds)
          .order("date", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["portal-invoices", studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("*, students(first_name,last_name)")
          .in("student_id", studentIds)
          .order("due_date", { ascending: false })
      ).data ?? [],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portail famille"
        description="Suivez la scolarité de vos enfants en temps réel."
      />

      {isLoading ? null : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Aucun élève rattaché à votre compte. Demandez à l'administration de lier votre profil.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {students.map((s: any) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {s.last_name} {s.first_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div>
                    Matricule : <span className="font-mono">{s.matricule || "—"}</span>
                  </div>
                  <div>Classe : {s.classes?.name || "—"}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="grades">
            <TabsList>
              <TabsTrigger value="grades">
                <GraduationCap className="h-4 w-4 mr-2" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="attendance">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Présences
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <Wallet className="h-4 w-4 mr-2" />
                Factures
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grades">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead>Matière</TableHead>
                        <TableHead>Évaluation</TableHead>
                        <TableHead className="text-right">Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map((g: any) => (
                        <TableRow key={g.id}>
                          <TableCell>
                            {g.students?.last_name} {g.students?.first_name}
                          </TableCell>
                          <TableCell>{g.subjects?.name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {g.assessment_name || "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {g.score}/{g.max_score}
                          </TableCell>
                        </TableRow>
                      ))}
                      {grades.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Aucune note
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>{new Date(a.date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>
                            {a.students?.last_name} {a.students?.first_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.status === "present" ? "default" : "outline"}>
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.note || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {attendance.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Aucune présence
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((i: any) => (
                        <TableRow key={i.id}>
                          <TableCell>
                            {i.students?.last_name} {i.students?.first_name}
                          </TableCell>
                          <TableCell>{i.description || "—"}</TableCell>
                          <TableCell>
                            {i.due_date ? new Date(i.due_date).toLocaleDateString("fr-FR") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={i.status === "paid" ? "default" : "outline"}>
                              {i.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {Number(i.amount).toLocaleString()} F
                          </TableCell>
                        </TableRow>
                      ))}
                      {invoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucune facture
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
