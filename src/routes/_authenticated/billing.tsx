import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  ArrowRight,
  CreditCard,
  Building2,
  CalendarClock,
  Receipt,
  XCircle,
  Download,
  FileText,
} from "lucide-react";
import { PLANS } from "@/routes/pricing";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

const planMeta = (id: string) => PLANS.find((p) => p.id === id);
const fmt = (n: number, c: string | null = "XOF") => formatCurrency(n, { currency: c });
const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

const statusLabel: Record<string, string> = {
  trialing: "Essai gratuit",
  active: "Actif",
  past_due: "En attente de validation",
  canceled: "Annulé",
};
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  trialing: "secondary",
  active: "default",
  past_due: "secondary",
  canceled: "outline",
};
const PAY_METHODS = ["Wave", "Orange Money", "Virement bancaire", "Espèces"];

function BillingPage() {
  const qc = useQueryClient();
  const schoolId = useCurrentSchool();

  const { data: school } = useQuery({
    queryKey: ["current-school-full", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (await supabase.from("schools").select("*").eq("id", schoolId!).maybeSingle()).data,
  });

  const { data: sub } = useQuery({
    queryKey: ["school-subscription", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("school_subscriptions")
          .select("*")
          .eq("school_id", schoolId!)
          .maybeSingle()
      ).data,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["subscription-invoices", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("subscription_invoices")
          .select("*")
          .eq("school_id", schoolId!)
          .order("paid_at", { ascending: false })
      ).data ?? [],
  });

  const activePlan = sub ? planMeta(sub.plan) : null;
  const daysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : null;
  const pending = sub?.status === "past_due";

  const [confirmDoc, setConfirmDoc] = React.useState<{
    inv: any;
    kind: "invoice" | "receipt";
  } | null>(null);
  const [requestPlanId, setRequestPlanId] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState("Wave");
  const [reference, setReference] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function openConfirm(inv: any, kind: "invoice" | "receipt") {
    setConfirmDoc({ inv, kind });
  }

  function closeConfirm() {
    setConfirmDoc(null);
  }

  function doDownload() {
    if (!confirmDoc) return;
    downloadDocument(confirmDoc.inv, confirmDoc.kind);
    setConfirmDoc(null);
  }

  function openRequest(planId: string) {
    if (!schoolId) return toast.error("Configurez d'abord votre école dans « Mon école ».");
    if (planId === "enterprise") {
      window.location.href =
        "mailto:commercial@ml2group.com?subject=Demande%20Enterprise%20ML2%20EduManager";
      return;
    }
    setReference("");
    setMethod("Wave");
    setRequestPlanId(planId);
  }

  // Le directeur déclare son paiement : l'abonnement reste NON actif (past_due)
  // + une facture 'pending' est créée, jusqu'à confirmation par le super admin.
  async function submitRequest() {
    if (!schoolId || !requestPlanId) return;
    const plan = planMeta(requestPlanId);
    if (!plan) return;
    setSubmitting(true);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400000);
    const { data: upserted, error } = await supabase
      .from("school_subscriptions")
      .upsert(
        {
          school_id: schoolId,
          plan: requestPlanId as "starter" | "pro",
          status: "past_due",
          amount: plan.price,
          currency: "XOF",
          started_at: sub?.started_at ?? now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: now.toISOString(),
          canceled_at: null,
        },
        { onConflict: "school_id" },
      )
      .select()
      .single();
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    await supabase.from("subscription_invoices").insert({
      school_id: schoolId,
      subscription_id: upserted.id,
      plan: requestPlanId as "starter" | "pro",
      amount: plan.price,
      currency: "XOF",
      status: "pending",
      method,
      reference: reference || `REF-${Date.now()}`,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
    });
    setSubmitting(false);
    setRequestPlanId(null);
    toast.success("Demande envoyée. En attente de validation du paiement par ML2.");
    qc.invalidateQueries({ queryKey: ["school-subscription", schoolId] });
    qc.invalidateQueries({ queryKey: ["subscription-invoices", schoolId] });
  }

  async function cancelSubscription() {
    if (!sub) return;
    const { error } = await supabase
      .from("school_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) return toast.error(error.message);
    toast.success("Abonnement annulé");
    qc.invalidateQueries({ queryKey: ["school-subscription", schoolId] });
  }

  function buildDocument(inv: any, kind: "invoice" | "receipt") {
    const isReceipt = kind === "receipt";
    const title = isReceipt ? "Reçu de paiement" : "Facture";
    const docNumber = (isReceipt ? "REC-" : "FAC-") + (inv.reference ?? inv.id?.slice(0, 8) ?? "");
    const planName = planMeta(inv.plan)?.name ?? inv.plan;
    const schoolName = school?.name ?? "Votre école";
    const schoolAddr = [school?.address, school?.phone, school?.email].filter(Boolean).join(" • ");
    const total = fmt(inv.amount, inv.currency);
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<title>${title} ${docNumber}</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  body{margin:0;padding:48px;color:#0f1b3d;background:#fff}
  .wrap{max-width:780px;margin:0 auto}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f1b3d;padding-bottom:20px;margin-bottom:32px}
  .brand{font-size:22px;font-weight:800;letter-spacing:-.02em;color:#0f1b3d}
  .brand small{display:block;font-size:11px;color:#64748b;font-weight:500;margin-top:4px;letter-spacing:.05em;text-transform:uppercase}
  .doc-meta{text-align:right}
  .doc-meta h1{margin:0;font-size:28px;color:#0f1b3d}
  .doc-meta div{font-size:13px;color:#475569;margin-top:6px}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:${isReceipt ? "#dcfce7;color:#166534" : "#dbeafe;color:#1e40af"};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-top:8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
  .box{background:#f8fafc;border-radius:10px;padding:16px}
  .box .label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px}
  .box .value{font-size:14px;font-weight:600;color:#0f1b3d}
  .box .sub{font-size:12px;color:#64748b;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:10px;border-bottom:2px solid #e2e8f0}
  td{padding:14px 10px;border-bottom:1px solid #e2e8f0;font-size:14px}
  .total{display:flex;justify-content:flex-end;margin-top:20px}
  .total-box{min-width:280px;background:#0f1b3d;color:#fff;padding:18px 22px;border-radius:10px}
  .total-box .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;opacity:.85}
  .total-box .big{display:flex;justify-content:space-between;font-size:20px;font-weight:800;border-top:1px solid rgba(255,255,255,.2);padding-top:10px;margin-top:8px}
  footer{margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;line-height:1.6}
  .actions{margin-bottom:24px;display:flex;gap:8px}
  .btn{padding:8px 16px;border-radius:8px;border:1px solid #0f1b3d;background:#0f1b3d;color:#fff;font-size:13px;cursor:pointer;font-weight:600}
  .btn.alt{background:#fff;color:#0f1b3d}
  @media print{.actions{display:none}body{padding:24px}}
</style></head><body><div class="wrap">
<div class="actions">
  <button class="btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <button class="btn alt" onclick="window.close()">Fermer</button>
</div>
<header>
  <div class="brand">ML2 EduManager<small>Édité par ML2 Group</small></div>
  <div class="doc-meta">
    <h1>${title}</h1>
    <div><strong>N° ${docNumber}</strong></div>
    <div>Date : ${fmtDate(inv.paid_at ?? inv.created_at)}</div>
    <div><span class="badge">${isReceipt ? "Payé" : inv.status === "paid" ? "Réglée" : inv.status}</span></div>
  </div>
</header>
<div class="grid">
  <div class="box"><div class="label">Émetteur</div><div class="value">ML2 Group</div><div class="sub">commercial@ml2group.com</div></div>
  <div class="box"><div class="label">Facturé à</div><div class="value">${schoolName}</div><div class="sub">${schoolAddr || "—"}</div></div>
</div>
<table>
  <thead><tr><th>Description</th><th>Période</th><th style="text-align:right">Montant</th></tr></thead>
  <tbody><tr>
    <td><strong>Abonnement ML2 EduManager — Plan ${planName}</strong><div style="font-size:12px;color:#64748b;margin-top:4px">Méthode : ${inv.method ?? "—"}</div></td>
    <td>${fmtDate(inv.period_start)} → ${fmtDate(inv.period_end)}</td>
    <td style="text-align:right;font-weight:600">${total}</td>
  </tr></tbody>
</table>
<div class="total"><div class="total-box">
  <div class="row"><span>Sous-total</span><span>${total}</span></div>
  <div class="row"><span>TVA</span><span>Exonérée</span></div>
  <div class="big"><span>${isReceipt ? "Reçu" : "Total"}</span><span>${total}</span></div>
</div></div>
<footer>
  ${isReceipt ? "Ce reçu atteste du paiement de la prestation ci-dessus." : "Document tenant lieu de facture. Merci de votre confiance."}
  <br/>ML2 Group — commercial@ml2group.com
</footer>
</div></body></html>`;
  }

  function downloadDocument(inv: any, kind: "invoice" | "receipt") {
    const html = buildDocument(inv, kind);
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return;
    }
    // fallback: download as .html
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind === "receipt" ? "recu" : "facture"}-${inv.reference ?? inv.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnement & Tarifs"
        description="Plan actif, renouvellement et historique de facturation."
        action={
          <Link to="/pricing">
            <Button variant="outline">Page publique</Button>
          </Link>
        }
      />

      {pending && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
          <CalendarClock className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Demande d'abonnement en attente</p>
            <p className="text-xs opacity-90">
              Votre paiement est en cours de validation par ML2. L'accès sera débloqué dès
              confirmation.
            </p>
          </div>
        </div>
      )}

      {/* Active plan summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-[var(--shadow-card)] border-primary/30 bg-[image:var(--gradient-primary)] text-primary-foreground">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <CardDescription className="text-primary-foreground/80">
                    {school?.name ?? "Votre école"}
                  </CardDescription>
                  <CardTitle className="font-display text-2xl">
                    Plan {activePlan?.name ?? "—"}
                  </CardTitle>
                </div>
              </div>
              <Badge
                variant={statusVariant[sub?.status ?? "trialing"]}
                className="bg-white/20 text-primary-foreground border-white/30"
              >
                {statusLabel[sub?.status ?? "trialing"]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70">Montant</div>
              <div className="font-display text-xl font-bold mt-1">
                {sub ? fmt(sub.amount, sub.currency) : "—"}
              </div>
              <div className="text-xs opacity-70">par mois</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70">
                Prochain renouvellement
              </div>
              <div className="font-display text-xl font-bold mt-1">
                {fmtDate(sub?.current_period_end)}
              </div>
              {daysLeft !== null && (
                <div className="text-xs opacity-70">dans {daysLeft} jour(s)</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70">Depuis</div>
              <div className="font-display text-xl font-bold mt-1">{fmtDate(sub?.started_at)}</div>
              <div className="text-xs opacity-70">{history.length} paiement(s)</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Période en cours
            </CardTitle>
            <CardDescription>
              Du {fmtDate(sub?.current_period_start)} au {fmtDate(sub?.current_period_end)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sub && sub.status !== "canceled" ? (
              <Button variant="outline" size="sm" className="w-full" onClick={cancelSubscription}>
                <XCircle className="h-4 w-4 mr-2" /> Annuler l'abonnement
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun abonnement actif. Choisissez un plan ci-dessous.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans */}
      <div>
        <h2 className="font-display text-lg font-bold mb-3">Changer de plan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = sub?.plan === plan.id && sub.status !== "canceled";
            return (
              <Card
                key={plan.id}
                className={`shadow-[var(--shadow-card)] relative ${isCurrent ? "border-primary ring-2 ring-primary/30" : plan.highlight ? "border-primary/40" : ""}`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Plan actuel</Badge>
                )}
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-lg ${plan.highlight ? "bg-[image:var(--gradient-primary)] text-primary-foreground" : "bg-secondary"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-display">{plan.name}</CardTitle>
                      <CardDescription className="text-xs">{plan.description}</CardDescription>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold">{plan.priceLabel}</span>
                    {plan.period && (
                      <span className="text-xs text-muted-foreground">FCFA/mois</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : plan.highlight ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() => openRequest(plan.id)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {isCurrent ? "Plan actuel" : "Choisir ce plan"}
                    {!isCurrent && <ArrowRight className="h-4 w-4 ml-1" />}
                  </Button>
                  <ul className="space-y-1.5 text-xs">
                    {plan.features.slice(0, 5).map((f) => (
                      <li
                        key={f.label}
                        className={`flex items-start gap-2 ${f.ok ? "" : "text-muted-foreground/60"}`}
                      >
                        <Check
                          className={`h-3 w-3 mt-0.5 shrink-0 ${f.ok ? "text-success" : "text-muted-foreground/40"}`}
                        />
                        <span>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment history */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Historique des paiements
            </CardTitle>
            <CardDescription>
              Téléchargez factures et reçus pour votre comptabilité.
            </CardDescription>
          </div>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => history.forEach((inv: any) => openConfirm(inv, "invoice"))}
            >
              <Download className="h-4 w-4 mr-2" /> Tout télécharger
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Documents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucun paiement enregistré.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(inv.paid_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{inv.reference ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {inv.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}
                    </TableCell>
                    <TableCell className="text-sm">{inv.method ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(inv.amount, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                        {inv.status === "paid" ? "Payé" : inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirm(inv, "invoice")}
                          title="Télécharger la facture"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirm(inv, "receipt")}
                          title="Télécharger le reçu"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!confirmDoc} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Confirmer le téléchargement</DialogTitle>
            <DialogDescription>
              Vous allez télécharger un document pour la période ci-dessous.
            </DialogDescription>
          </DialogHeader>
          {confirmDoc && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type de document</span>
                <span className="font-medium">
                  {confirmDoc.kind === "invoice" ? "Facture" : "Reçu de paiement"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Référence</span>
                <span className="font-mono">
                  {confirmDoc.inv.reference ?? confirmDoc.inv.id?.slice(0, 8) ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Période</span>
                <span className="font-medium">
                  {fmtDate(confirmDoc.inv.period_start)} → {fmtDate(confirmDoc.inv.period_end)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-medium">
                  {fmt(confirmDoc.inv.amount, confirmDoc.inv.currency)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm}>
              Annuler
            </Button>
            <Button onClick={doDownload}>
              <Download className="h-4 w-4 mr-2" /> Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!requestPlanId} onOpenChange={(o) => !o && setRequestPlanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Demander l'activation</DialogTitle>
            <DialogDescription>
              Indiquez le moyen de paiement utilisé. Votre abonnement sera activé après validation
              par ML2.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{planMeta(requestPlanId ?? "")?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-medium">{fmt(planMeta(requestPlanId ?? "")?.price ?? 0)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Moyen de paiement</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Référence du paiement</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="N° transaction Wave/OM, réf. virement…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestPlanId(null)}>
              Annuler
            </Button>
            <Button onClick={submitRequest} disabled={submitting}>
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
