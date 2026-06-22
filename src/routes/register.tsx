import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2, CheckCircle2, Phone } from "lucide-react";
import { SUPPORT_PHONE } from "@/lib/support";

export const Route = createFileRoute("/register")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: firstName,
          last_name: lastName,
          school_name: schoolName,
          school_code: schoolCode.trim(),
          phone,
          address,
        },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // Email confirmation is disabled on this project: sign in to get a session.
    await supabase.auth.signInWithPassword({ email, password }).catch(() => {});
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border shadow-[var(--shadow-elegant)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <CardTitle className="font-display text-2xl">Demande envoyée</CardTitle>
            <CardDescription>Votre inscription est en attente de validation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Votre demande pour <strong>{schoolName || "votre établissement"}</strong> a été
              transmise à l'administration ML2. Vous recevrez l'accès à votre espace dès qu'elle
              sera approuvée.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-foreground">
              <Phone className="h-4 w-4 text-primary" />
              <span>
                Besoin de nous contacter ?{" "}
                <a className="font-semibold underline" href={`tel:${SUPPORT_PHONE}`}>
                  {SUPPORT_PHONE}
                </a>
              </span>
            </div>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Aller à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg border-border shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-2 font-display text-lg font-bold mb-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            ML2 EduManager
          </div>
          <CardTitle className="font-display text-2xl">Inscrire mon établissement</CardTitle>
          <CardDescription>
            Créez votre compte directeur et déclarez votre école. Un administrateur ML2 validera
            votre demande.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Directeur
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Prénom"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  placeholder="Nom"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <Input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Mot de passe (min. 8)"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Établissement
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Nom de l'école"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
                <Input
                  placeholder="Code (ex. ML2-001)"
                  required
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  className="font-mono"
                />
              </div>
              <Input
                placeholder="Téléphone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                placeholder="Adresse"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer ma demande
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Déjà un compte ? Se connecter
            </Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              Accueil
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
