import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SuperAdminGate, SuperAdminNav } from "@/lib/super-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/registrations")({
  component: () => (
    <SuperAdminGate>
      <SuperAdminNav />
      <RegistrationsAdmin />
    </SuperAdminGate>
  ),
});

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};
const statusLabel: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};

function RegistrationsAdmin() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-registrations"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("school_registration_requests")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function approve(id: string) {
    setBusy(id);
    const { error } = await (supabase as any).rpc("approve_school_registration", {
      _request_id: id,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Établissement approuvé et créé");
    qc.invalidateQueries({ queryKey: ["admin-registrations"] });
    qc.invalidateQueries({ queryKey: ["admin-schools"] });
  }

  async function confirmReject() {
    if (!rejectId) return;
    setBusy(rejectId);
    const { error } = await (supabase as any).rpc("reject_school_registration", {
      _request_id: rejectId,
      _reason: reason || null,
    });
    setBusy(null);
    setRejectId(null);
    setReason("");
    if (error) return toast.error(error.message);
    toast.success("Demande refusée");
    qc.invalidateQueries({ queryKey: ["admin-registrations"] });
  }

  const pending = (rows as any[]).filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes d'inscription"
        description="Validez les directeurs qui souhaitent créer leur établissement."
      />

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardContent className="p-4">
          <div className="mb-3 text-sm text-muted-foreground">
            {pending.length} demande(s) en attente
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Directeur</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.school_name}
                      <div className="text-xs font-mono text-muted-foreground">{r.school_code}</div>
                    </TableCell>
                    <TableCell>
                      {r.director_first_name} {r.director_last_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.email ?? "—"}
                      <div className="text-xs">{r.phone}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status] ?? "secondary"}>
                        {statusLabel[r.status] ?? r.status}
                      </Badge>
                      {r.status === "rejected" && r.rejection_reason && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                          {r.rejection_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id)}>
                            {busy === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRejectId(r.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Traitée</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(rows as any[]).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune demande.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Motif (communiqué au directeur)</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. Informations incomplètes, établissement non reconnu…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={busy === rejectId} onClick={confirmReject}>
              {busy === rejectId && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
