import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SuperAdminGate, SuperAdminNav } from "@/lib/super-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => (
    <SuperAdminGate>
      <SuperAdminNav />
      <UsersAdmin />
    </SuperAdminGate>
  ),
});

function UsersAdmin() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*, school:schools(name)")
        .order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const byUser: Record<string, string[]> = {};
      (roles ?? []).forEach((r: any) => {
        (byUser[r.user_id] ||= []).push(r.role);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] }));
    },
  });

  async function toggleSuperAdmin(userId: string, currently: boolean) {
    if (currently) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "super_admin");
      if (error) return toast.error(error.message);
      toast.success("Privilège retiré");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "super_admin" });
      if (error) return toast.error(error.message);
      toast.success("Super Admin promu");
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs plateforme"
        description="Administrateurs, support et accès."
      />
      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardContent className="p-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>École</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Inscrit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u: any) => {
                  const isSuper = u.roles.includes("super_admin");
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell>
                        {u.school?.name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {u.roles.length === 0 && (
                            <span className="text-muted-foreground text-xs">Aucun</span>
                          )}
                          {u.roles.map((r: string) => (
                            <Badge key={r} variant={r === "super_admin" ? "default" : "outline"}>
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isSuper ? "outline" : "default"}
                          onClick={() => toggleSuperAdmin(u.id, isSuper)}
                        >
                          {isSuper ? (
                            <>
                              <ShieldOff className="h-3 w-3 mr-1" />
                              Retirer
                            </>
                          ) : (
                            <>
                              <Shield className="h-3 w-3 mr-1" />
                              Promouvoir
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun utilisateur.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
