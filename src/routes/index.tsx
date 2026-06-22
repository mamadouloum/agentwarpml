import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Users,
  ClipboardCheck,
  Wallet,
  CalendarDays,
  MessageSquare,
  ShieldCheck,
  Building2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ML2 EduManager — Plateforme SaaS de gestion scolaire" },
      {
        name: "description",
        content:
          "Gérez toutes vos écoles depuis une seule plateforme : élèves, notes, présences, paiements, planning et messagerie. Une solution ML2 GROUP.",
      },
    ],
  }),
  component: Landing,
});

const modules = [
  {
    icon: Users,
    title: "Élèves & inscriptions",
    desc: "Fiches complètes, classes, parents, suivi de scolarité.",
  },
  {
    icon: GraduationCap,
    title: "Notes & bulletins",
    desc: "Saisie des évaluations, moyennes pondérées, périodes.",
  },
  {
    icon: ClipboardCheck,
    title: "Présences",
    desc: "Appel quotidien, justificatifs, statistiques d'absentéisme.",
  },
  {
    icon: Wallet,
    title: "Paiements scolarité",
    desc: "Factures, encaissements, suivi des impayés par parent.",
  },
  {
    icon: CalendarDays,
    title: "Emploi du temps",
    desc: "Planning par classe, professeur et salle.",
  },
  {
    icon: MessageSquare,
    title: "Messagerie",
    desc: "Communication directe administration / professeurs / parents.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
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
            <a href="#modules" className="hover:text-foreground">
              Modules
            </a>
            <a href="#avantages" className="hover:text-foreground">
              Avantages
            </a>
            <a href="#tarifs" className="hover:text-foreground">
              Tarifs
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Connexion</Link>
            </Button>
            <Button asChild>
              <Link to="/register">
                Commencer <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] pointer-events-none" />
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-primary-glow" />
              Solution SaaS éditée par ML2 GROUP
            </div>
            <h1 className="mt-6 font-display text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              La plateforme qui pilote
              <span className="block bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
                toutes vos écoles.
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Gérez plusieurs établissements depuis un seul tableau de bord. Élèves, notes,
              présences, paiements et communication parents — tout est centralisé, sécurisé et
              accessible où que vous soyez.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-[var(--shadow-elegant)]">
                <Link to="/register">
                  Démarrer gratuitement <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#modules">Découvrir les modules</a>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { k: "+120", v: "écoles" },
                { k: "50K", v: "élèves gérés" },
                { k: "99.9%", v: "disponibilité" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="font-display text-2xl font-bold text-primary">{s.k}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-24 bg-gradient-to-b from-background to-secondary/40">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary-glow uppercase tracking-wider">
              Modules
            </p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-bold">
              Une suite complète pour vos établissements
            </h2>
            <p className="mt-4 text-muted-foreground">
              Chaque module est pensé pour les réalités du terrain : équipes administratives,
              enseignants et familles.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <div
                key={m.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary group-hover:bg-[image:var(--gradient-primary)] group-hover:text-primary-foreground transition">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section id="avantages" className="py-24">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary-glow uppercase tracking-wider">
              Pourquoi ML2
            </p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-bold">
              Multi-école, multi-rôle, sécurisé par conception.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Conçu pour les groupes scolaires : isolement strict des données entre établissements,
              rôles granulaires (administration, professeurs, parents) et hébergement conforme.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Tableau de bord consolidé pour le groupe",
                "Authentification sécurisée et rôles",
                "Sauvegardes automatiques",
                "Support technique ML2 GROUP",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-glow" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-elegant)]">
            <div className="aspect-[4/3] rounded-xl bg-[image:var(--gradient-primary)] p-8 text-primary-foreground">
              <div className="text-xs uppercase tracking-wider opacity-80">Tableau de bord</div>
              <div className="mt-2 font-display text-2xl font-bold">Vue d'ensemble</div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { k: "Élèves", v: "1 248" },
                  { k: "Classes", v: "42" },
                  { k: "Présence", v: "96%" },
                  { k: "Recouvrement", v: "87%" },
                ].map((c) => (
                  <div key={c.k} className="rounded-lg bg-white/10 p-4 backdrop-blur">
                    <div className="text-xs opacity-80">{c.k}</div>
                    <div className="mt-1 font-display text-xl font-bold">{c.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="tarifs" className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Prêt à digitaliser la gestion de vos écoles ?
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
            Démarrez en quelques minutes. Notre équipe ML2 GROUP vous accompagne pour la mise en
            place et la formation de vos équipes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">Créer mon compte</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <div className="container mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} ML2 GROUP. Tous droits réservés.</div>
          <div>ML2 EduManager — Plateforme SaaS de gestion scolaire</div>
        </div>
      </footer>
    </div>
  );
}
