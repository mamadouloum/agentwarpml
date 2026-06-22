import { Link, useRouterState } from "@tanstack/react-router";
import { CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscriptionStatus, GRACE_PERIOD_DAYS } from "@/lib/use-subscription-status";
import { useIsSuperAdmin } from "@/lib/super-admin";

const ALWAYS_ALLOWED = ["/billing", "/school", "/settings", "/admin", "/pricing"];

function isAllowed(pathname: string) {
  return ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { loading, isActive, inGrace, isBlocked, isMissing, status, periodEnd, graceDaysLeft } =
    useSubscriptionStatus();

  if (loading || isSuperAdmin) return <>{children}</>;

  // In grace: show a warning banner above the content but keep access.
  if (isActive || inGrace) {
    return (
      <>
        {inGrace && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
            <Clock className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Abonnement presque terminé</p>
              <p className="text-xs opacity-90">
                Votre période a expiré. Vous bénéficiez d'un délai de grâce de {GRACE_PERIOD_DAYS}{" "}
                jours — il reste <strong>{graceDaysLeft} jour(s)</strong> avant la suspension
                automatique des modules.
              </p>
            </div>
            <Link to="/billing">
              <Button size="sm" variant="outline" className="border-amber-600/40">
                <CreditCard className="h-3 w-3 mr-1" /> Renouveler
              </Button>
            </Link>
          </div>
        )}
        {children}
      </>
    );
  }

  if (!isBlocked || isAllowed(pathname)) return <>{children}</>;

  const pending = status === "past_due";

  return (
    <div className="grid place-items-center py-10">
      <Card className="max-w-xl border-primary/30 shadow-[var(--shadow-card)]">
        <CardContent className="p-8 text-center space-y-4">
          <div
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
              pending
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-primary/10 text-primary"
            }`}
          >
            {pending ? <Clock className="h-7 w-7" /> : <CreditCard className="h-7 w-7" />}
          </div>
          {pending ? (
            <>
              <h2 className="font-display text-2xl font-bold">Paiement en cours de validation</h2>
              <p className="text-sm text-muted-foreground">
                Votre demande d'abonnement a bien été transmise. Un administrateur ML2 va confirmer
                votre paiement — vous obtiendrez l'accès complet dès validation.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold">Activez votre abonnement</h2>
              <p className="text-sm text-muted-foreground">
                {isMissing
                  ? "Pour accéder à toutes les fonctionnalités de votre établissement, choisissez un abonnement."
                  : `Votre abonnement a expiré${periodEnd ? ` le ${new Date(periodEnd).toLocaleDateString("fr-FR")}` : ""}. Renouvelez-le pour rétablir l'accès.`}
              </p>
            </>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Link to="/billing">
              <Button>
                <CreditCard className="h-4 w-4 mr-2" />{" "}
                {pending ? "Voir ma demande" : "Choisir un abonnement"}
              </Button>
            </Link>
            <Link to="/school">
              <Button variant="outline">Mon école</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
