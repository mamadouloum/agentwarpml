import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SuperAdminGate, SuperAdminNav } from "@/lib/super-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: () => (
    <SuperAdminGate>
      <SuperAdminNav />
      <AuditPage />
    </SuperAdminGate>
  ),
});

function AuditPage() {
  const { data = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & Sécurité"
        description="Historique des actions sensibles sur la plateforme."
      />
      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardContent className="p-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Acteur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm font-mono">
                      {new Date(l.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.target_type ?? "—"}{" "}
                      {l.target_id ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          ({String(l.target_id).slice(0, 8)})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {l.actor_id ? String(l.actor_id).slice(0, 8) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Aucun événement enregistré.
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
