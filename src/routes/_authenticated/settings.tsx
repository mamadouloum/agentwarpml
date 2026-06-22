import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { ...data, email: u.user.email };
    },
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", u.user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password"));
    if (pw.length < 6) return toast.error("Mot de passe trop court (min. 6 caractères)");
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe modifié");
    (e.target as HTMLFormElement).reset();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Paramètres" description="Gérez votre compte et vos informations personnelles." />

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground"><User className="h-5 w-5" /></div>
            <div>
              <CardTitle className="font-display">Mon profil</CardTitle>
              <CardDescription>{profile?.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground"><KeyRound className="h-5 w-5" /></div>
            <div>
              <CardTitle className="font-display">Mot de passe</CardTitle>
              <CardDescription>Modifiez votre mot de passe d'accès.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-1.5"><Label>Nouveau mot de passe</Label><Input name="password" type="password" required minLength={6} /></div>
            <Button type="submit" variant="secondary" disabled={pwSaving}>
              {pwSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Mettre à jour
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)] border-destructive/30">
        <CardHeader>
          <CardTitle className="font-display text-destructive">Déconnexion</CardTitle>
          <CardDescription>Vous serez redirigé vers la page de connexion.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Se déconnecter</Button>
        </CardContent>
      </Card>
    </div>
  );
}
