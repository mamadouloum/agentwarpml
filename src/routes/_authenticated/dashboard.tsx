import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Wallet, ClipboardCheck, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

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

type ActivityItem = {
  id: string;
  kind: "student" | "payment";
  title: string;
  subtitle: string;
  at: string;
};

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return "";
  }
}

function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, classes, invoices, attendances] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("amount,amount_paid,status"),
        supabase.from("attendances").select("status").gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      ]);
      const firstError = students.error ?? classes.error ?? invoices.error ?? attendances.error;
      if (firstError) throw new Error(firstError.message);
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

  const {
    data: activity = [],
    isLoading: activityLoading,
    isError: activityError,
  } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const [students, payments] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("payments")
          .select("id, amount, method, paid_at")
          .order("paid_at", { ascending: false })
          .limit(6),
      ]);
      const firstError = students.error ?? payments.error;
      if (firstError) throw new Error(firstError.message);
      const items: ActivityItem[] = [
        ...(students.data ?? []).map((s) => ({
          id: `student-${s.id}`,
          kind: "student" as const,
          title: `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim() || "Nouvel élève",
          subtitle: "Nouvel élève inscrit",
          at: s.created_at,
        })),
        ...(payments.data ?? []).map((p) => ({
          id: `payment-${p.id}`,
          kind: "payment" as const,
          title: `Paiement reçu — ${Number(p.amount).toLocaleString("fr-FR")} F`,
          subtitle: p.method ? `Mode : ${p.method}` : "Encaissement",
          at: p.paid_at,
        })),
      ];
      return items
        .filter((i) => i.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 6);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de votre établissement en temps réel." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : isError ? (
          <Card className="sm:col-span-2 lg:col-span-4 border-destructive/40 bg-destructive/5 shadow-[var(--shadow-card)]">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Impossible de charger les statistiques.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Une erreur est survenue. Veuillez réessayer."}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
                <RefreshCw className="mr-2 h-4 w-4" />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <StatCard icon={Users} label="Élèves inscrits" value={data?.students ?? 0} hint="Total actuel" />
            <StatCard icon={GraduationCap} label="Classes" value={data?.classes ?? 0} hint="Année en cours" accent="bg-primary/10 text-primary" />
            <StatCard icon={ClipboardCheck} label="Taux de présence" value={`${data?.attendanceRate ?? 0}%`} hint="7 derniers jours" accent="bg-success/10 text-success" />
            <StatCard icon={Wallet} label="Encaissements" value={`${(data?.totalPaid ?? 0).toLocaleString("fr-FR")} F`} hint={`Reste dû: ${(data?.totalDue ?? 0).toLocaleString("fr-FR")} F`} accent="bg-warning/10 text-warning" />
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
          <CardContent className="text-sm">
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityError ? (
              <p className="text-muted-foreground">Impossible de charger l'activité récente.</p>
            ) : activity.length === 0 ? (
              <div className="text-muted-foreground">
                Aucune activité récente pour le moment. Pour commencer :
                <ol className="mt-4 space-y-2 text-foreground list-decimal pl-5">
                  <li>Créez votre école dans <strong>Mon école</strong>.</li>
                  <li>Ajoutez vos classes et matières.</li>
                  <li>Importez ou créez vos élèves.</li>
                  <li>Commencez à saisir notes, présences et paiements.</li>
                </ol>
              </div>
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        item.kind === "payment" ? "bg-success/10 text-success" : "bg-accent text-primary"
                      }`}
                    >
                      {item.kind === "payment" ? (
                        <Wallet className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
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
