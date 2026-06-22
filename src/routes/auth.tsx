import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  ShieldCheck,
  GraduationCap,
  Users,
  Heart,
  Briefcase,
} from "lucide-react";

const ROLE_META: Record<string, { label: string; space: string; icon: any }> = {
  school_admin: { label: "Directeur", space: "Espace Direction", icon: ShieldCheck },
  teacher: { label: "Enseignants", space: "Espace Enseignants", icon: GraduationCap },
  student: { label: "Élèves", space: "Espace Élèves", icon: Users },
  parent: { label: "Parents", space: "Espace Parents", icon: Heart },
  staff: { label: "Personnel", space: "Espace Personnel", icon: Briefcase },
};

type AuthSearch = { school?: string; role?: keyof typeof ROLE_META };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    school: typeof s.school === "string" ? s.school : undefined,
    role:
      typeof s.role === "string" && s.role in ROLE_META
        ? (s.role as keyof typeof ROLE_META)
        : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { school: schoolCode, role } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolCode) {
      setSchoolName(null);
      return;
    }
    (supabase as any).rpc("get_school_portal", { _code: schoolCode }).then(({ data }: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      setSchoolName(row?.name ?? null);
    });
  }, [schoolCode]);

  const roleMeta = role ? ROLE_META[role] : null;
  const RoleIcon = roleMeta?.icon ?? Building2;

  // Sign in
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // Sign up
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPw,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPw,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte créé. Vous pouvez vous connecter.");
  }

  // Connexion generale (sans contexte ecole/role) : super admin, directeur, etc.
  if (!schoolCode || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <div className="flex items-center gap-2 font-display text-lg font-bold mb-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              ML2 EduManager
            </div>
            <CardTitle className="font-display text-2xl">Connexion</CardTitle>
            <CardDescription>Connectez-vous à votre espace, ou créez un compte.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="gle">Email</Label>
                    <Input
                      id="gle"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="glp">Mot de passe</Label>
                    <Input
                      id="glp"
                      type="password"
                      required
                      value={loginPw}
                      onChange={(e) => setLoginPw(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="gfn">Prénom</Label>
                      <Input
                        id="gfn"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gln">Nom</Label>
                      <Input
                        id="gln"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gse">Email</Label>
                    <Input
                      id="gse"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gsp">Mot de passe</Label>
                    <Input
                      id="gsp"
                      type="password"
                      required
                      minLength={8}
                      value={signupPw}
                      onChange={(e) => setSignupPw(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="mt-4 text-center space-y-1">
              <Link
                to="/register"
                className="block text-sm font-medium text-primary hover:underline"
              >
                Vous dirigez une école ? Inscrivez votre établissement
              </Link>
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                Retour à l'accueil
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Branding */}
      <div className="hidden lg:flex relative overflow-hidden bg-primary text-primary-foreground p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-40" />
        <div className="relative flex items-center gap-2 font-display text-lg font-bold">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
            <Building2 className="h-5 w-5" />
          </div>
          ML2 EduManager
        </div>
        <div className="relative">
          {roleMeta ? (
            <>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium mb-4">
                <RoleIcon className="h-3.5 w-3.5" /> {roleMeta.label}
              </div>
              <h2 className="font-display text-4xl font-bold leading-tight">
                {roleMeta.space}
                {schoolName && (
                  <span className="block text-2xl font-semibold mt-2 text-primary-foreground/90">
                    — {schoolName}
                  </span>
                )}
              </h2>
              <p className="mt-4 text-primary-foreground/80 max-w-md">
                Connectez-vous pour accéder à votre espace dédié.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-4xl font-bold leading-tight">
                La plateforme qui pilote toutes vos écoles.
              </h2>
              <p className="mt-4 text-primary-foreground/80 max-w-md">
                Connectez-vous à votre espace d'administration et reprenez la main sur la gestion
                quotidienne de vos établissements.
              </p>
            </>
          )}
        </div>
        <div className="relative text-xs text-primary-foreground/60">© ML2 GROUP</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <Card className="w-full max-w-md border-border shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {roleMeta ? roleMeta.space : "Espace administration"}
              {roleMeta && schoolName && (
                <span className="block text-base font-normal text-muted-foreground mt-1">
                  École {schoolName}
                </span>
              )}
            </CardTitle>
            <CardDescription>Connectez-vous ou créez un compte pour démarrer.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="le">Email</Label>
                    <Input
                      id="le"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lp">Mot de passe</Label>
                    <Input
                      id="lp"
                      type="password"
                      required
                      value={loginPw}
                      onChange={(e) => setLoginPw(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="fn">Prénom</Label>
                      <Input
                        id="fn"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ln">Nom</Label>
                      <Input
                        id="ln"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="se">Email</Label>
                    <Input
                      id="se"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sp">Mot de passe</Label>
                    <Input
                      id="sp"
                      type="password"
                      required
                      minLength={8}
                      value={signupPw}
                      onChange={(e) => setSignupPw(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
