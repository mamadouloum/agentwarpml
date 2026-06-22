import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Building2,
  Plus,
  Check,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const MODULES: { key: string; label: string }[] = [
  { key: "students", label: "Élèves" },
  { key: "classes", label: "Classes" },
  { key: "attendance", label: "Présence" },
  { key: "grades", label: "Notes" },
  { key: "report_cards", label: "Bulletins" },
  { key: "homework", label: "Devoirs" },
  { key: "payments", label: "Paiements" },
  { key: "library", label: "Bibliothèque" },
  { key: "transport", label: "Transport" },
  { key: "cantine", label: "Cantine" },
  { key: "schedule", label: "Emploi du temps" },
  { key: "messages", label: "Messages" },
  { key: "announcements", label: "Annonces" },
  { key: "events", label: "Événements" },
];

type RoleKey = "school_admin" | "teacher" | "staff" | "parent" | "student";
type Invite = {
  email: string;
  role: RoleKey;
  perms: Record<string, { read: boolean; write: boolean }>;
};

const ROLE_PRESETS: Record<RoleKey, Record<string, { read: boolean; write: boolean }>> = {
  school_admin: Object.fromEntries(MODULES.map((m) => [m.key, { read: true, write: true }])),
  teacher: Object.fromEntries(
    MODULES.map((m) => [
      m.key,
      {
        read: true,
        write: ["attendance", "grades", "homework", "messages"].includes(m.key),
      },
    ]),
  ),
  staff: Object.fromEntries(
    MODULES.map((m) => [
      m.key,
      {
        read: true,
        write: ["payments", "library", "transport", "cantine"].includes(m.key),
      },
    ]),
  ),
  parent: Object.fromEntries(
    MODULES.map((m) => [
      m.key,
      {
        read: [
          "grades",
          "attendance",
          "homework",
          "payments",
          "messages",
          "announcements",
          "events",
        ].includes(m.key),
        write: false,
      },
    ]),
  ),
  student: Object.fromEntries(
    MODULES.map((m) => [
      m.key,
      {
        read: ["grades", "homework", "schedule", "announcements", "events"].includes(m.key),
        write: false,
      },
    ]),
  ),
};

const ROLE_LABEL: Record<RoleKey, string> = {
  school_admin: "Directeur",
  teacher: "Enseignant",
  staff: "Personnel",
  parent: "Parent",
  student: "Élève",
};
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/school")({
  component: SchoolPage,
});

function SchoolPage() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: mySchools = [], isLoading } = useQuery({
    queryKey: ["my-schools", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("school_id")
        .eq("user_id", profile!.id)
        .in("role", ["school_admin", "super_admin"]);
      const ids = Array.from(
        new Set((roles ?? []).map((r) => r.school_id).filter(Boolean)),
      ) as string[];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("schools").select("*").in("id", ids).order("name");
      return data ?? [];
    },
  });

  // Edit form for active school
  const active = mySchools.find((s) => s.id === profile?.school_id) ?? null;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (active) {
      setName(active.name ?? "");
      setCode(active.code ?? "");
      setPhone(active.phone ?? "");
      setAddress(active.address ?? "");
      setEmail(active.email ?? "");
      setWebsite((active as any).website ?? "");
    } else {
      setName("");
      setCode("");
      setPhone("");
      setAddress("");
      setEmail("");
      setWebsite("");
    }
  }, [active?.id]);

  // Create-new form
  const [step, setStep] = useState<1 | 2>(1);
  const [nName, setNName] = useState("");
  const [nCode, setNCode] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nAddress, setNAddress] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nWebsite, setNWebsite] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);

  function addInvite() {
    setInvites((arr) => [
      ...arr,
      { email: "", role: "teacher", perms: { ...ROLE_PRESETS.teacher } },
    ]);
  }
  function updateInvite(idx: number, patch: Partial<Invite>) {
    setInvites((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function setInviteRole(idx: number, role: RoleKey) {
    updateInvite(idx, { role, perms: structuredClone(ROLE_PRESETS[role]) });
  }
  function togglePerm(idx: number, mod: string, kind: "read" | "write") {
    setInvites((arr) =>
      arr.map((it, i) => {
        if (i !== idx) return it;
        const cur = it.perms[mod] ?? { read: false, write: false };
        const next = { ...cur, [kind]: !cur[kind] };
        if (kind === "write" && next.write) next.read = true;
        if (kind === "read" && !next.read) next.write = false;
        return { ...it, perms: { ...it.perms, [mod]: next } };
      }),
    );
  }
  function removeInvite(idx: number) {
    setInvites((arr) => arr.filter((_, i) => i !== idx));
  }
  function resetWizard() {
    setStep(1);
    setNName("");
    setNCode("");
    setNPhone("");
    setNAddress("");
    setNEmail("");
    setNWebsite("");
    setInvites([]);
  }

  async function saveActive(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("schools")
      .update({ name, code, phone, address, email, website } as any)
      .eq("id", active.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("École mise à jour");
    qc.invalidateQueries({ queryKey: ["my-schools"] });
    qc.invalidateQueries({ queryKey: ["current-school"] });
  }

  async function createSchool() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setSaving(true);
    const { data: school, error } = await supabase
      .from("schools")
      .insert({
        name: nName,
        code: nCode,
        phone: nPhone,
        address: nAddress,
        email: nEmail,
        website: nWebsite,
      } as any)
      .select()
      .single();
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    // The trigger auto-grants school_admin to creator. Ensure profile points there if no active school.
    if (!profile?.school_id) {
      await supabase.from("profiles").update({ school_id: school.id }).eq("id", u.user.id);
    }

    // Process invites
    let added = 0,
      skipped = 0;
    for (const inv of invites) {
      const email = inv.email.trim().toLowerCase();
      if (!email) continue;
      const { data: found, error: ferr } = await supabase.rpc("find_user_by_email", {
        _email: email,
      });
      if (ferr || !found || found.length === 0) {
        skipped++;
        continue;
      }
      const uid = found[0].id;
      const { data: roleRow, error: rerr } = await supabase
        .from("user_roles")
        .insert({ user_id: uid, role: inv.role, school_id: school.id })
        .select()
        .single();
      if (rerr || !roleRow) {
        skipped++;
        continue;
      }
      const rows = MODULES.map((m) => ({ module: m.key, ...inv.perms[m.key] }))
        .filter((r) => r.read || r.write)
        .map((r) => ({
          user_role_id: roleRow.id,
          module: r.module,
          can_read: r.read,
          can_write: r.write,
        }));
      if (rows.length) await supabase.from("role_permissions").insert(rows);
      added++;
    }

    setSaving(false);
    toast.success(
      `Établissement créé. ${added} utilisateur(s) ajouté(s)${skipped ? `, ${skipped} ignoré(s)` : ""}.`,
    );
    resetWizard();
    setShowCreate(false);
    qc.invalidateQueries({ queryKey: ["my-schools"] });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["current-school"] });
    qc.invalidateQueries({ queryKey: ["user-roles"] });
  }

  async function switchTo(schoolId: string) {
    if (!profile?.id) return;
    setSwitching(schoolId);
    const { error } = await supabase
      .from("profiles")
      .update({ school_id: schoolId })
      .eq("id", profile.id);
    setSwitching(null);
    if (error) return toast.error(error.message);
    toast.success("Établissement actif changé");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["current-school"] });
    qc.invalidateQueries();
  }

  const hasAny = mySchools.length > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Mes établissements"
        description="Gérez vos écoles, basculez entre établissements et créez de nouveaux sites pour votre groupe."
      />

      {/* List of schools in the group */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="font-display">Établissements du groupe</CardTitle>
            <CardDescription>
              {hasAny
                ? `${mySchools.length} établissement(s).`
                : "Aucun établissement pour le moment."}
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowCreate((v) => !v)}
            variant={showCreate ? "outline" : "default"}
          >
            <Plus className="h-4 w-4 mr-1" /> {showCreate ? "Annuler" : "Nouvel établissement"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (
            mySchools.map((s) => {
              const isActive = s.id === profile?.school_id;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.name} {isActive && <Badge className="ml-2">Actif</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{s.code}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/school/$code" params={{ code: s.code }} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-1" /> Portail
                      </Link>
                    </Button>
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={switching === s.id}
                        onClick={() => switchTo(s.id)}
                      >
                        {switching === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" /> Activer
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create wizard */}
      {(showCreate || !hasAny) && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display">
                  {step === 1
                    ? "Étape 1 — Informations de l'établissement"
                    : "Étape 2 — Rôles & permissions"}
                </CardTitle>
                <CardDescription>
                  {step === 1
                    ? "Renseignez les coordonnées. Vous en serez automatiquement le directeur."
                    : "Invitez des utilisateurs existants et attribuez-leur leurs droits par module."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span
                  className={`h-2 w-8 rounded-full ${step === 1 ? "bg-primary" : "bg-primary/30"}`}
                />
                <span
                  className={`h-2 w-8 rounded-full ${step === 2 ? "bg-primary" : "bg-muted"}`}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(2);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input value={nName} onChange={(e) => setNName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input
                      value={nCode}
                      onChange={(e) => setNCode(e.target.value)}
                      required
                      placeholder="ML2-002"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input value={nPhone} onChange={(e) => setNPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={nEmail}
                      onChange={(e) => setNEmail(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Adresse</Label>
                    <Input value={nAddress} onChange={(e) => setNAddress(e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Site web (bulletins)</Label>
                    <Input
                      value={nWebsite}
                      onChange={(e) => setNWebsite(e.target.value)}
                      placeholder="www.monecole.sn"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">
                    Suivant : rôles & permissions <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <span className="font-medium">{nName || "(Sans nom)"}</span>
                  <span className="font-mono text-muted-foreground"> · {nCode}</span>
                </div>

                {invites.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aucun utilisateur invité. Vous pouvez créer l'établissement seul et ajouter les
                    rôles plus tard.
                  </div>
                )}

                {invites.map((inv, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6 space-y-1.5">
                        <Label className="text-xs">Email de l'utilisateur</Label>
                        <Input
                          type="email"
                          placeholder="prenom.nom@example.com"
                          value={inv.email}
                          onChange={(e) => updateInvite(idx, { email: e.target.value })}
                        />
                      </div>
                      <div className="col-span-5 space-y-1.5">
                        <Label className="text-xs">Rôle</Label>
                        <Select
                          value={inv.role}
                          onValueChange={(v) => setInviteRole(idx, v as RoleKey)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROLE_LABEL) as RoleKey[]).map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInvite(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="rounded border bg-muted/20 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium border-b bg-muted/40">
                        <div className="col-span-8">Module</div>
                        <div className="col-span-2 text-center">Lecture</div>
                        <div className="col-span-2 text-center">Écriture</div>
                      </div>
                      <div className="divide-y">
                        {MODULES.map((m) => {
                          const p = inv.perms[m.key] ?? { read: false, write: false };
                          return (
                            <div
                              key={m.key}
                              className="grid grid-cols-12 gap-2 px-3 py-1.5 items-center text-sm"
                            >
                              <div className="col-span-8">{m.label}</div>
                              <div className="col-span-2 flex justify-center">
                                <Checkbox
                                  checked={p.read}
                                  onCheckedChange={() => togglePerm(idx, m.key, "read")}
                                />
                              </div>
                              <div className="col-span-2 flex justify-center">
                                <Checkbox
                                  checked={p.write}
                                  onCheckedChange={() => togglePerm(idx, m.key, "write")}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addInvite}>
                  <UserPlus className="h-4 w-4 mr-1" /> Ajouter un utilisateur
                </Button>

                <div className="flex justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Retour
                  </Button>
                  <Button type="button" onClick={createSchool} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Créer l'établissement
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Astuce : seuls les utilisateurs ayant déjà un compte seront ajoutés. Les autres
                  pourront être invités depuis l'écran « Équipe ».
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit active school */}
      {active && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-display">Informations de l'école active</CardTitle>
                <CardDescription>Modifiez les informations de {active.name}.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveActive} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Adresse</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Site web (bulletins)</Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="www.monecole.sn"
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
