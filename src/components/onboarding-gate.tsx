import { useNavigate } from "@tanstack/react-router";
import { useOnboardingState } from "@/hooks/use-onboarding-state";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, XCircle, Phone, Loader2, LogOut } from "lucide-react";
import { SUPPORT_PHONE } from "@/lib/support";

export function OnboardingBoundary({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useOnboardingState();
  const navigate = useNavigate();

  if (isLoading || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Super admins and users attached to a school enter the app normally.
  if (!data.authed || data.isSuperAdmin || data.hasSchool) return <>{children}</>;

  const req = data.request;
  const rejected = req?.status === "rejected";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-lg border-border shadow-[var(--shadow-elegant)]">
        <CardContent className="space-y-4 p-8 text-center">
          <div
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
              rejected
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            {rejected ? <XCircle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </div>

          {req ? (
            rejected ? (
              <>
                <h2 className="font-display text-2xl font-bold">Demande refusée</h2>
                <p className="text-sm text-muted-foreground">
                  Votre demande pour <strong>{req.school_name}</strong> n'a pas été retenue.
                  {req.rejection_reason && (
                    <>
                      <br />
                      Motif : <em>{req.rejection_reason}</em>
                    </>
                  )}
                </p>
                <Button onClick={() => navigate({ to: "/register" })}>Refaire une demande</Button>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold">En attente de validation</h2>
                <p className="text-sm text-muted-foreground">
                  Votre demande pour <strong>{req.school_name}</strong> (code{" "}
                  <span className="font-mono">{req.school_code}</span>) est en cours d'examen par
                  l'administration ML2. Vous serez activé dès l'approbation.
                </p>
              </>
            )
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold">Aucun établissement associé</h2>
              <p className="text-sm text-muted-foreground">
                Votre compte n'est rattaché à aucune école. Si vous êtes directeur, inscrivez votre
                établissement ; sinon demandez à votre direction de vous ajouter.
              </p>
              <Button onClick={() => navigate({ to: "/register" })}>
                Inscrire mon établissement
              </Button>
            </>
          )}

          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground">
            <Phone className="h-4 w-4 text-primary" />
            <span>
              Besoin d'aide ?{" "}
              <a className="font-semibold underline" href={`tel:${SUPPORT_PHONE}`}>
                {SUPPORT_PHONE}
              </a>
            </span>
          </div>

          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
