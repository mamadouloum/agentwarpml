import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SuperAdminGate, SuperAdminNav } from "@/lib/super-admin";
import { useRealtimeSync } from "@/lib/use-realtime";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Gift, Ban, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: () => (
    <SuperAdminGate>
      <SuperAdminNav />
      <SubscriptionsAdmin />
    </SuperAdminGate>
  ),
});

const PRESETS = [
  { value: "1", label: "1 mois", months: 1 },
  { value: "3", label: "3 mois", months: 3 },
  { value: "6", label: "6 mois", months: 6 },
  { value: "12", label: "12 mois", months: 12 },
];
const PLANS = ["starter", "pro", "enterprise"] as const;

function SubscriptionsAdmin() {
  const qc = useQueryClient();
  useRealtimeSync(
    ["school_subscriptions", "subscription_invoices", "schools"],
    [["admin-subs"], ["admin-sub-invoices"], ["admin-schools-list"], ["admin-pending-invoices"]],
  );

  const { data = [] } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_subscriptions")
        .select("*, school:schools(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["admin-sub-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_invoices")
        .select("*, school:schools(name)")
        .order("paid_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["admin-pending-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_invoices")
        .select("*, school:schools(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: schools = [] } = useQuery({
    queryKey: ["admin-schools-list"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("id,name").order("name");
      return data ?? [];
    },
  });

  const totalRevenue = invoices.reduce((a, i: any) => a + Number(i.amount ?? 0), 0);

  const [open, setOpen] = useState(false);
  const [schoolId, setSchoolId] = useState<string>("");
  const [plan, setPlan] = useState<string>("pro");
  const [preset, setPreset] = useState<string>("3");
  const [saving, setSaving] = useState(false);

  async function grant() {
    if (!schoolId) return toast.error("Choisissez un établissement");
    const months = PRESETS.find((p) => p.value === preset)?.months ?? 1;
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    setSaving(true);
    const { error } = await supabase.from("school_subscriptions").upsert(
      {
        school_id: schoolId,
        plan: plan as "starter" | "pro" | "enterprise",
        status: "active",
        amount: 0,
        currency: "XOF",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        canceled_at: null,
      },
      { onConflict: "school_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    await supabase.from("platform_audit_logs").insert({
      action: "grant_subscription",
      target_type: "school",
      target_id: schoolId,
      metadata: { plan, months },
    });
    toast.success(`Abonnement ${plan} accordé pour ${months} mois`);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-subs"] });
  }

  async function revoke(id: string) {
    if (!confirm("Révoquer cet abonnement ?")) return;
    const { error } = await supabase
      .from("school_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Abonnement révoqué");
  }

  async function extend(id: string, months: number, schoolName?: string) {
    const sub = data.find((s: any) => s.id === id) as any;
    const base = sub?.current_period_end ? new Date(sub.current_period_end) : new Date();
    if (base.getTime() < Date.now()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + months);
    const { error } = await supabase
      .from("school_subscriptions")
      .update({ status: "active", current_period_end: base.toISOString(), canceled_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`+${months} mois ajoutés${schoolName ? ` à ${schoolName}` : ""}`);
  }

  async function confirmPayment(inv: any) {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    const { error } = await supabase.from("school_subscriptions").upsert(
      {
        school_id: inv.school_id,
        plan: inv.plan,
        status: "active",
        amount: inv.amount,
        currency: inv.currency ?? "XOF",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        canceled_at: null,
      },
      { onConflict: "school_id" },
    );
    if (error) return toast.error(error.message);
    await supabase
      .from("subscription_invoices")
      .update({ status: "paid", paid_at: now.toISOString() })
      .eq("id", inv.id);
    await supabase.from("platform_audit_logs").insert({
      action: "confirm_payment",
      target_type: "school",
      target_id: inv.school_id,
      metadata: { plan: inv.plan, amount: inv.amount, reference: inv.reference },
    });
    toast.success("Paiement confirmé, abonnement activé");
    qc.invalidateQueries({ queryKey: ["admin-pending-invoices"] });
    qc.invalidateQueries({ queryKey: ["admin-subs"] });
    qc.invalidateQueries({ queryKey: ["admin-sub-invoices"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnements & Facturation"
        description="Tous les abonnements et paiements de la plateforme — données en temps réel."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Abonnements</p>
            <p className="font-display text-2xl font-bold mt-1">{data.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Actifs</p>
            <p className="font-display text-2xl font-bold mt-1">
              {data.filter((s: any) => s.status === "active").length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Paiements</p>
            <p className="font-display text-2xl font-bold mt-1">{invoices.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Revenu total</p>
            <p className="font-display text-2xl font-bold mt-1">
              {totalRevenue.toLocaleString()} F
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)] border-amber-400/50">
        <CardContent className="p-4">
          <h3 className="font-display text-lg font-bold mb-3">
            Paiements à confirmer ({pendingInvoices.length})
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvoices.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.school?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{i.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      {Number(i.amount ?? 0).toLocaleString()} {i.currency ?? "F"}
                    </TableCell>
                    <TableCell className="text-sm">{i.method ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{i.reference ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {i.created_at ? new Date(i.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => confirmPayment(i)}>
                        <Check className="h-4 w-4 mr-1" />
                        Confirmer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pendingInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Aucun paiement en attente.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold">Abonnements en cours</h3>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Gift className="h-4 w-4 mr-1" /> Accorder un abonnement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Accorder un abonnement gratuit</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Établissement</Label>
                    <Select value={schoolId} onValueChange={setSchoolId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une école" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Plan</Label>
                      <Select value={plan} onValueChange={setPlan}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLANS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Durée</Label>
                      <Select value={preset} onValueChange={setPreset}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESETS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={grant} disabled={saving}>
                    Accorder
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Renouvellement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.school?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {Number(s.amount ?? 0).toLocaleString()} {s.currency ?? "F"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.current_period_end
                        ? new Date(s.current_period_end).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extend(s.id, 1, s.school?.name)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          +1m
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extend(s.id, 12, s.school?.name)}
                        >
                          +1an
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun abonnement.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardContent className="p-4">
          <h3 className="font-display text-lg font-bold mb-3">Derniers paiements</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>École</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">
                      {i.paid_at ? new Date(i.paid_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>{i.school?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{i.plan}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{i.reference ?? "—"}</TableCell>
                    <TableCell>
                      {Number(i.amount ?? 0).toLocaleString()} {i.currency ?? "F"}
                    </TableCell>
                    <TableCell>
                      <Badge>{i.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun paiement.
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
