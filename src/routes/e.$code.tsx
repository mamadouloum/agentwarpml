import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toHsl } from "@/lib/branding";
import {
  Building2,
  GraduationCap,
  Users,
  Heart,
  Briefcase,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

function contrastFg(v?: string | null): string {
  if (!v || !v.startsWith("#") || v.length < 7) return "0 0% 100%";
  const r = parseInt(v.slice(1, 3), 16);
  const g = parseInt(v.slice(3, 5), 16);
  const b = parseInt(v.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "240 10% 10%" : "0 0% 100%";
}

export const Route = createFileRoute("/e/$code")({
  ssr: false,
  loader: async ({ params }) => {
    // Public read via SECURITY DEFINER RPC (schools RLS blocks anonymous reads).
    const { data, error } = await (supabase as any).rpc("get_school_portal", {
      _code: params.code,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw notFound();
    let logoUrl = (row.logo_url as string | null) ?? null;
    if (row.brand_logo_url) {
      const { data: pub } = supabase.storage.from("school-logos").getPublicUrl(row.brand_logo_url);
      logoUrl = pub?.publicUrl ?? logoUrl;
    }
    return {
      school: { id: row.id as string, name: row.name as string, code: row.code as string },
      branding: {
        primary_color: row.primary_color as string | null,
        accent_color: row.accent_color as string | null,
        secondary_color: row.secondary_color as string | null,
        motto: row.motto as string | null,
      },
      logoUrl,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.school ? `${loaderData.school.name} — Connexion` : "École" },
      {
        name: "description",
        content: "Accédez à votre espace : direction, enseignants, élèves, parents, personnel.",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-bold">École introuvable</h1>
        <p className="text-muted-foreground mt-2">Vérifiez le code de votre établissement.</p>
        <Button asChild className="mt-4">
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
  component: SchoolPortal,
});

const roles = [
  {
    key: "school_admin",
    label: "Directeur",
    desc: "Pilotage de l'établissement",
    icon: ShieldCheck,
  },
  {
    key: "teacher",
    label: "Enseignants",
    desc: "Notes, présences, cahier de textes",
    icon: GraduationCap,
  },
  { key: "student", label: "Élèves", desc: "Notes, devoirs, emploi du temps", icon: Users },
  { key: "parent", label: "Parents", desc: "Suivi de scolarité et paiements", icon: Heart },
  { key: "staff", label: "Personnel", desc: "Administration & support", icon: Briefcase },
];

function SchoolPortal() {
  const { school, branding, logoUrl } = Route.useLoaderData();

  // Apply this school's brand colors locally (white-label), scoped to this page.
  const style: Record<string, string> = {};
  if (branding?.primary_color) {
    const h = toHsl(branding.primary_color);
    style["--primary"] = h;
    style["--primary-foreground"] = contrastFg(branding.primary_color);
    style["--ring"] = h;
    style["--gradient-primary"] = `linear-gradient(135deg, hsl(${h}), hsl(${h} / 0.75))`;
  }
  if (branding?.accent_color) style["--accent"] = toHsl(branding.accent_color);
  if (branding?.secondary_color) style["--secondary"] = toHsl(branding.secondary_color);

  return (
    <div className="min-h-screen bg-background" style={style as any}>
      {/* Bandeau aux couleurs de l'école */}
      <header className="relative overflow-hidden bg-[image:var(--gradient-primary)] text-primary-foreground">
        <div className="container mx-auto max-w-5xl px-4 py-14 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={school.name}
                className="h-full w-full bg-white object-contain"
              />
            ) : (
              <Building2 className="h-9 w-9" />
            )}
          </div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{school.name}</h1>
          {branding?.motto && (
            <p className="mt-2 italic text-primary-foreground/85">{branding.motto}</p>
          )}
          <p className="mt-4 text-primary-foreground/80">
            Bienvenue sur l'espace en ligne de l'établissement.
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Choisissez votre espace</h2>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Accueil ML2
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <Link
              key={r.key}
              to="/auth"
              search={{ school: school.code, role: r.key } as any}
              className="group"
            >
              <Card className="h-full transition hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5">
                <CardContent className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary mb-4">
                    <r.icon className="h-5 w-5" />
                  </div>
                  <div className="font-display text-lg font-semibold">{r.label}</div>
                  <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                  <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                    Se connecter{" "}
                    <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        {school.name} — Espace en ligne · propulsé par ML2 EduManager
      </footer>
    </div>
  );
}
