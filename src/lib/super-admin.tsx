import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Shield,
  Building2,
  CreditCard,
  UserCog,
  FileText,
  LayoutDashboard,
  Inbox,
} from "lucide-react";

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });
}

const tabs = [
  { to: "/admin", label: "Vue globale", icon: LayoutDashboard },
  { to: "/admin/registrations", label: "Demandes", icon: Inbox },
  { to: "/admin/schools", label: "Établissements", icon: Building2 },
  { to: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
  { to: "/admin/users", label: "Utilisateurs", icon: UserCog },
  { to: "/admin/audit", label: "Audit & Sécurité", icon: FileText },
] as const;

export function SuperAdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-r border-border px-3 py-1.5">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Super Admin
        </span>
      </div>
      {tabs.map((t) => {
        const active = pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            <span className="whitespace-nowrap">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { data: isAdmin, isLoading } = useIsSuperAdmin();
  if (isLoading) return <div className="p-8 text-muted-foreground">Vérification des accès…</div>;
  if (!isAdmin) {
    return (
      <div className="grid place-items-center p-16">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
          <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-2xl font-bold">Accès refusé</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Cette zone est réservée aux Super Administrateurs de la plateforme.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
