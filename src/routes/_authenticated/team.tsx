import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { useRealtimeSync } from "@/lib/use-realtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { createSchoolUser } from "@/lib/api/users.functions";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

type AppRole = "teacher" | "staff" | "parent" | "student" | "school_admin";

const ASSIGNABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: "teacher", label: "Enseignant" },
  { value: "staff", label: "Personnel" },
  { value: "parent", label: "Parent" },
  { value: "student", label: "Élève" },
];

const MODULES = [
  { key: "students", label: "Élèves" },
  { key: "classes", label: "Classes" },
  { key: "grades", label: "Notes" },
  { key: "report_cards", label: "Bulletins" },
  { key: "attendance", label: "Présences" },
  { key: "homework", label: "Devoirs" },
  { key: "schedule", label: "Planning" },
  { key: "payments", label: "Paiements" },
  { key: "accounting", label: "Comptabilité" },
  { key: "library", label: "Bibliothèque" },
  { key: "cantine", label: "Cantine" },
  { key: "transport", label: "Transport" },
  { key: "messages", label: "Messagerie" },
  { key: "events", label: "Annonces" },
];

function TeamPage() {
  const qc = useQueryClient();

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
  const schoolId = profile?.school_id ?? null;

  const { data: isAdmin } = useQuery({
    queryKey: ["is-school-admin", profile?.id, schoolId],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile!.id)
        .in("role", ["school_admin", "super_admin"]);
      return (data ?? []).length > 0;
    },
  });

  useRealtimeSync(
    ["user_roles", "role_permissions", "profiles"],
    [["team-members", schoolId ?? undefined], ["my-profile"]],
  );

  const { data: members = [] } = useQuery({
    queryKey: ["team-members", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      // All profiles linked to this school + everyone holding a role on this school
      const { data: roles } = await supabase
        .from("user_roles")
        .select("id,user_id,role,school_id")
        .eq("school_id", schoolId!);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,phone,avatar_url,school_id")
        .eq("school_id", schoolId!);
      const ids = new Set<string>([
        ...(profiles ?? []).map((p) => p.id),
        ...(roles ?? []).map((r) => r.user_id),
      ]);
      const idArr = Array.from(ids);
      let extra: any[] = [];
      if (idArr.length > 0) {
        const { data: ep } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,phone,avatar_url,school_id")
          .in("id", idArr);
        extra = ep ?? [];
      }
      const merged = new Map<string, any>();
      extra.forEach((p) => merged.set(p.id, { ...p, roles: [] as any[] }));
      (roles ?? []).forEach((r) => {
        const entry = merged.get(r.user_id) ?? {
          id: r.user_id,
          first_name: "",
          last_name: "",
          roles: [],
        };
        entry.roles.push(r);
        merged.set(r.user_id, entry);
      });
      const userRoleIds = (roles ?? []).map((r) => r.id);
      let perms: any[] = [];
      if (userRoleIds.length > 0) {
        const { data: rp } = await supabase
          .from("role_permissions")
          .select("*")
          .in("user_role_id", userRoleIds);
        perms = rp ?? [];
      }
      return Array.from(merged.values()).map((m) => ({
        ...m,
        permissions: perms.filter((p) => m.roles.some((r: any) => r.id === p.user_role_id)),
      }));
    },
  });

  const [openAdd, setOpenAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("teacher");
  const [openCreate, setOpenCreate] = useState(false);
  const [cEmail, setCEmail] = useState("");
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cRole, setCRole] = useState<AppRole>("teacher");
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);
  const [defPw, setDefPw] = useState("");
  const [savingDef, setSavingDef] = useState(false);

  const { data: schoolCfg } = useQuery({
    queryKey: ["school-default-pw", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("schools")
          .select("default_member_password")
          .eq("id", schoolId!)
          .maybeSingle()
      ).data,
  });
  useEffect(() => {
    setDefPw(((schoolCfg as any)?.default_member_password as string) ?? "");
  }, [schoolCfg]);

  async function findUserIdByEmail(em: string): Promise<string | null> {
    // Look up via profiles join — auth.users not exposed. Try to find a profile by matching email
    // (We use the auth.users table indirectly via a server RPC; fallback to none)
    const { data } = await supabase
      .rpc("find_user_by_email" as any, { _email: em } as any)
      .maybeSingle?.();
    return (data as any)?.id ?? null;
  }

  async function addMember() {
    if (!schoolId) return;
    if (!email.trim()) return toast.error("Email requis");
    const uid = await findUserIdByEmail(email.trim()).catch(() => null);
    if (!uid) {
      toast.error("Utilisateur introuvable. Demandez-lui de créer un compte d'abord.");
      return;
    }
    // Attach role
    const { error: rErr } = await supabase
      .from("user_roles")
      .insert({ user_id: uid, role: newRole, school_id: schoolId });
    if (rErr) return toast.error(rErr.message);
    // Set their active school if not already
    await supabase
      .from("profiles")
      .update({ school_id: schoolId })
      .eq("id", uid)
      .is("school_id", null);
    toast.success("Membre ajouté");
    setOpenAdd(false);
    setEmail("");
    qc.invalidateQueries({ queryKey: ["team-members", schoolId] });
  }

  async function removeRole(roleId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) return toast.error(error.message);
    toast.success("Rôle retiré");
  }

  async function togglePerm(
    userRoleId: string,
    module: string,
    field: "can_read" | "can_write",
    value: boolean,
    existing?: any,
  ) {
    if (existing) {
      const payload: any = { [field]: value };
      if (field === "can_write" && value) payload.can_read = true;
      if (field === "can_read" && !value) payload.can_write = false;
      const { error } = await supabase
        .from("role_permissions")
        .update(payload)
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const payload: any = { user_role_id: userRoleId, module, can_read: false, can_write: false };
      payload[field] = value;
      if (field === "can_write" && value) payload.can_read = true;
      const { error } = await supabase.from("role_permissions").insert(payload);
      if (error) return toast.error(error.message);
    }
  }

  async function createUser() {
    if (!cEmail.trim()) return toast.error("Email requis");
    setCreating(true);
    try {
      const res = await createSchoolUser({
        data: {
          email: cEmail.trim(),
          firstName: cFirst,
          lastName: cLast,
          role: cRole as "teacher" | "staff" | "parent" | "student",
        },
      });
      setCreatedInfo({ email: (res as any).email, password: (res as any).password });
      setCEmail("");
      setCFirst("");
      setCLast("");
      toast.success("Compte créé");
      qc.invalidateQueries({ queryKey: ["team-members", schoolId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Création impossible");
    } finally {
      setCreating(false);
    }
  }

  async function saveDefaultPassword() {
    if (!schoolId) return;
    if (defPw && defPw.length < 6) return toast.error("Au moins 6 caractères");
    setSavingDef(true);
    const { error } = await supabase
      .from("schools")
      .update({ default_member_password: defPw || null } as any)
      .eq("id", schoolId);
    setSavingDef(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe par défaut enregistré");
  }

  if (!schoolId) {
    return (
      <div className="p-6 text-muted-foreground">
        Sélectionnez une école active dans « Mon école ».
      </div>
    );
  }
  if (isAdmin === false) {
    return (
      <div className="grid place-items-center p-16">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-2xl font-bold">Accès directeur uniquement</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Seul un directeur d'établissement peut gérer les rôles et permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe & permissions"
        description="Attribuez des rôles et des permissions par module aux membres de votre école — synchronisé en temps réel."
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="font-display">Comptes & accès</CardTitle>
            <CardDescription>
              Créez des comptes pour vos enseignants, parents et personnel.
            </CardDescription>
          </div>
          <Dialog
            open={openCreate}
            onOpenChange={(o) => {
              setOpenCreate(o);
              if (!o) setCreatedInfo(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-1" /> Créer un compte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un compte</DialogTitle>
              </DialogHeader>
              {createdInfo ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Compte créé. Communiquez ces identifiants à l'utilisateur (il pourra changer son
                    mot de passe dans Paramètres) :
                  </p>
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Email :</span>{" "}
                      <b>{createdInfo.email}</b>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mot de passe :</span>{" "}
                      <b className="font-mono">{createdInfo.password}</b>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setCreatedInfo(null)}>
                    Créer un autre
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Prénom"
                      value={cFirst}
                      onChange={(e) => setCFirst(e.target.value)}
                    />
                    <Input
                      placeholder="Nom"
                      value={cLast}
                      onChange={(e) => setCLast(e.target.value)}
                    />
                  </div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                  />
                  <Select value={cRole} onValueChange={(v) => setCRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Mot de passe initial : celui défini ci-dessous (ou généré si vide).
                  </p>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpenCreate(false)}>
                      Annuler
                    </Button>
                    <Button onClick={createUser} disabled={creating}>
                      Créer
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Label className="text-sm">Mot de passe par défaut des nouveaux comptes</Label>
          <div className="mt-1.5 flex gap-2 max-w-md">
            <Input
              value={defPw}
              onChange={(e) => setDefPw(e.target.value)}
              placeholder="ex. Bienvenue2026"
            />
            <Button variant="outline" onClick={saveDefaultPassword} disabled={savingDef}>
              Enregistrer
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Utilisé comme mot de passe initial des comptes créés ; chaque utilisateur peut le
            changer dans Paramètres.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Membres</CardTitle>
            <CardDescription>{members.length} personne(s) liée(s) à l'école.</CardDescription>
          </div>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-1" /> Ajouter un membre
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un membre</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Email du compte existant"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La personne doit déjà avoir un compte sur la plateforme.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenAdd(false)}>
                  Annuler
                </Button>
                <Button onClick={addMember}>Ajouter</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personne</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onRemoveRole={removeRole}
                    onTogglePerm={togglePerm}
                  />
                ))}
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Aucun membre.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({ member, onRemoveRole, onTogglePerm }: any) {
  const [openId, setOpenId] = useState<string | null>(null);
  const name =
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id.slice(0, 8);
  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          {name}
          <div className="text-xs text-muted-foreground font-mono">{member.id.slice(0, 8)}</div>
        </TableCell>
        <TableCell>
          <div className="flex gap-1 flex-wrap">
            {member.roles.length === 0 && (
              <span className="text-muted-foreground text-xs">Aucun</span>
            )}
            {member.roles.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
                className="inline-flex"
              >
                <Badge variant={openId === r.id ? "default" : "outline"} className="cursor-pointer">
                  {r.role}
                </Badge>
              </button>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {member.roles.map((r: any) => (
            <Button
              key={r.id}
              size="sm"
              variant="ghost"
              onClick={() => onRemoveRole(r.id)}
              title={`Retirer ${r.role}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          ))}
        </TableCell>
      </TableRow>
      {openId && (
        <TableRow>
          <TableCell colSpan={3} className="bg-muted/30">
            <PermissionMatrix
              userRoleId={openId}
              permissions={member.permissions.filter((p: any) => p.user_role_id === openId)}
              onToggle={onTogglePerm}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PermissionMatrix({ userRoleId, permissions, onToggle }: any) {
  const byMod = useMemo(() => {
    const m: Record<string, any> = {};
    permissions.forEach((p: any) => (m[p.module] = p));
    return m;
  }, [permissions]);
  return (
    <div className="py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Permissions par module
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {MODULES.map((mod) => {
          const p = byMod[mod.key];
          return (
            <div
              key={mod.key}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
            >
              <div className="text-sm font-medium">{mod.label}</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={!!p?.can_read}
                    onCheckedChange={(v) => onToggle(userRoleId, mod.key, "can_read", !!v, p)}
                  />
                  Lire
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={!!p?.can_write}
                    onCheckedChange={(v) => onToggle(userRoleId, mod.key, "can_write", !!v, p)}
                  />
                  Écrire
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
