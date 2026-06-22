import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Building2, ArrowRight, Sparkles, Crown, Rocket } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Tarifs — ML2 EduManager" },
      {
        name: "description",
        content:
          "Plans Starter, Pro et Enterprise pour les établissements scolaires : choisissez l'abonnement adapté à votre école.",
      },
      { property: "og:title", content: "Tarifs ML2 EduManager" },
      {
        property: "og:description",
        content: "Comparez Starter, Pro et Enterprise pour la gestion de vos écoles.",
      },
    ],
  }),
  component: PricingPage,
});

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: Sparkles,
    price: 29000,
    priceLabel: "29 000",
    period: "/mois",
    description: "Pour une école qui démarre sa digitalisation.",
    highlight: false,
    cta: "Démarrer Starter",
    features: [
      { ok: true, label: "1 établissement" },
      { ok: true, label: "Jusqu'à 150 élèves" },
      { ok: true, label: "Gestion des élèves & classes" },
      { ok: true, label: "Notes & bulletins" },
      { ok: true, label: "Appel & présences" },
      { ok: true, label: "Messagerie interne" },
      { ok: false, label: "Module Comptabilité" },
      { ok: false, label: "Paiements en ligne parents" },
      { ok: false, label: "Multi-écoles" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    icon: Crown,
    price: 69000,
    priceLabel: "69 000",
    period: "/mois",
    description: "L'essentiel pour piloter une école professionnelle.",
    highlight: true,
    cta: "Démarrer Pro",
    features: [
      { ok: true, label: "1 établissement" },
      { ok: true, label: "Élèves illimités" },
      { ok: true, label: "Tous les modules Starter" },
      { ok: true, label: "Module Comptabilité complet" },
      { ok: true, label: "Facturation & encaissements" },
      { ok: true, label: "Planning avancé & salles" },
      { ok: true, label: "Exports PDF (bulletins, factures)" },
      { ok: true, label: "Support prioritaire" },
      { ok: false, label: "Multi-écoles & SSO" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Rocket,
    price: 199000,
    priceLabel: "Sur devis",
    period: "",
    description: "Pour les groupes scolaires et réseaux d'établissements.",
    highlight: false,
    cta: "Contacter l'équipe",
    features: [
      { ok: true, label: "Multi-écoles illimité" },
      { ok: true, label: "Tous les modules Pro" },
      { ok: true, label: "Tableau de bord groupe consolidé" },
      { ok: true, label: "SSO (Google, Microsoft, SAML)" },
      { ok: true, label: "Domaine personnalisé" },
      { ok: true, label: "API & intégrations" },
      { ok: true, label: "Sauvegardes dédiées" },
      { ok: true, label: "Account manager ML2" },
      { ok: true, label: "SLA contractuel 99,9%" },
    ],
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
              <Building2 className="h-5 w-5" />
            </div>
            <span>
              ML2 <span className="text-primary-glow">EduManager</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Accueil
            </Link>
            <Link to="/pricing" className="text-foreground font-medium">
              Tarifs
            </Link>
          </nav>
          <Link to="/auth">
            <Button>
              Se connecter <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          Tarification transparente · FCFA
        </Badge>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Un plan pour chaque école
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Démarrez avec Starter, passez à Pro quand vous grandissez, et basculez en Enterprise quand
          vous gérez plusieurs établissements.
        </p>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border bg-card p-8 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elegant)] ${
                  plan.highlight
                    ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                    : "border-border"
                }`}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[image:var(--gradient-primary)] text-primary-foreground border-0">
                    Le plus populaire
                  </Badge>
                )}
                <div className="flex items-center gap-3">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-xl ${plan.highlight ? "bg-[image:var(--gradient-primary)] text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{plan.priceLabel}</span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">
                      {plan.period === "/mois" ? "FCFA/mois" : plan.period}
                    </span>
                  )}
                </div>

                <Link to="/billing" className="block mt-6">
                  <Button className="w-full" variant={plan.highlight ? "default" : "outline"}>
                    {plan.cta} <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>

                <ul className="mt-8 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li
                      key={f.label}
                      className={`flex items-start gap-2 ${f.ok ? "" : "text-muted-foreground/60"}`}
                    >
                      <Check
                        className={`h-4 w-4 mt-0.5 shrink-0 ${f.ok ? "text-success" : "text-muted-foreground/40"}`}
                      />
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          Tous les plans incluent les mises à jour, la sécurité de niveau bancaire et l'hébergement.
          <br />
          Engagement mensuel sans frais cachés. Annulation à tout moment.
        </p>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ML2 GROUP — ML2 EduManager
        </div>
      </footer>
    </div>
  );
}
