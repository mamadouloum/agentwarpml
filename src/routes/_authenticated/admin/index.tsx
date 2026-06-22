import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, GraduationCap, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SuperAdminGate, SuperAdminNav } from "@/lib/super-admin";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: () => (
    <SuperAdminGate>
      <SuperAdminNav />
      <AdminOverview />
    </SuperAdminGate>
  ),
});

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="shadow-[var(--shadow-card)] border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold">{value}</p>
          </div>
          <div className={`grid h-10 w-10 place-items-center rounded-lg ${accent ?? "bg-accent text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminOverview() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [schools, students, teachers, subs, invoices] = await Promise.all([
        supabase.from("schools").select("id,status,created_at"),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("school_subscriptions").select("status,amount,current_period_end"),
        supabase.from("subscription_invoices").select("amount,paid_at,status").order("paid_at", { ascending: true }),
      ]);
      const now = Date.now();
      const expired = (subs.data ?? []).filter(
        (s: any) => s.current_period_end && new Date(s.current_period_end).getTime() < now,
      ).length;
      const active = (subs.data ?? []).filter((s: any) => s.status === "active").length;
      const mrr = (subs.data ?? []).filter((s: any) => s.status === "active").reduce((a: number, s: any) => a + Number(s.amount ?? 0), 0);
      // monthly revenue from invoices
      const byMonth: Record<string, number> = {};
      (invoices.data ?? []).forEach((i: any) => {
        const d = i.paid_at ? new Date(i.paid_at) : null;
        if (!d) return;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth[k] = (byMonth[k] ?? 0) + Number(i.amount ?? 0);
      });
      const revenue = Object.entries(byMonth).map(([month, value]) => ({ month, value })).slice(-12);
      // new schools per month
      const sm: Record<string, number> = {};
      (schools.data ?? []).forEach((s: any) => {
        const d = new Date(s.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        sm[k] = (sm[k] ?? 0) + 1;
      });
      const growth = Object.entries(sm).map(([month, value]) => ({ month, value })).slice(-12);
      return {
        totalSchools: schools.data?.length ?? 0,
        totalStudents: students.count ?? 0,
        totalTeachers: teachers.count ?? 0,
        active,
        expired,
        mrr,
        revenue,
        growth,
      };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord plateforme" description="Vue d'ensemble de tous les établissements." />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat icon={Building2} label="Établissements" value={data?.totalSchools ?? "—"} />
        <Stat icon={GraduationCap} label="Élèves" value={data?.totalStudents ?? "—"} />
        <Stat icon={Users} label="Enseignants" value={data?.totalTeachers ?? "—"} />
        <Stat icon={CheckCircle2} label="Abonnés actifs" value={data?.active ?? "—"} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
        <Stat icon={AlertTriangle} label="Expirés" value={data?.expired ?? "—"} accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
        <Stat icon={Wallet} label="MRR" value={`${(data?.mrr ?? 0).toLocaleString()} F`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardContent className="p-5">
            <h3 className="font-display text-lg font-bold mb-4">Revenus SaaS (12 derniers mois)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.revenue ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardContent className="p-5">
            <h3 className="font-display text-lg font-bold mb-4">Nouvelles écoles par mois</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.growth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
