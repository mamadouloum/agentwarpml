import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Wallet, ClipboardCheck, TrendingUp, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <Card className="shadow-[var(--shadow-card)] border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`grid h-10 w-10 place-items-center rounded-lg ${accent ?? "bg-accent text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, classes, invoices, attendances] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("amount,amount_paid,status"),
        supabase.from("attendances").select("status").gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      ]);
      const totalDue = (invoices.data ?? []).reduce((s, i) => s + Number(i.amount) - Number(i.amount_paid), 0);
      const totalPaid = (invoices.data ?? []).reduce((s, i) => s + Number(i.amount_paid), 0);
      const attCount = (attendances.data ?? []).length;
      const present = (attendances.data ?? []).filter((a) => a.status === "present").length;
      const rate = attCount ? Math.round((present / attCount) * 100) : 100;
      return {
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        totalDue,
        totalPaid,
        attendanceRate: rate,
      };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de votre établissement en temps réel." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <StatCard icon={Users} label="Élèves inscrits" value={data!.students} hint="Total actuel" />
            <StatCard icon={GraduationCap} label="Classes" value={data!.classes} hint="Année en cours" accent="bg-primary/10 text-primary" />
            <StatCard icon={ClipboardCheck} label="Taux de présence" value={`${data!.attendanceRate}%`} hint="7 derniers jours" accent="bg-success/10 text-success" />
            <StatCard icon={Wallet} label="Encaissements" value={`${data!.totalPaid.toLocaleString("fr-FR")} F`} hint={`Reste dû: ${data!.totalDue.toLocaleString("fr-FR")} F`} accent="bg-warning/10 text-warning" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-glow" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Bienvenue dans votre nouvel espace ML2 EduManager. Pour commencer :
            <ol className="mt-4 space-y-2 text-foreground list-decimal pl-5">
              <li>Créez votre école dans <strong>Mon école</strong>.</li>
              <li>Ajoutez vos classes et matières.</li>
              <li>Importez ou créez vos élèves.</li>
              <li>Commencez à saisir notes, présences et paiements.</li>
            </ol>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              À surveiller
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Factures impayées</span><span className="font-semibold">{data ? `${data.totalDue.toLocaleString("fr-FR")} F` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Taux de présence</span><span className="font-semibold">{data ? `${data.attendanceRate}%` : "—"}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
