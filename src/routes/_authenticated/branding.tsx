import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { useSchoolBranding, SchoolLogo, toHsl } from "@/lib/branding";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Upload,
  Palette,
  Trash2,
  Eye,
  RotateCcw,
  Save,
  Sparkles,
  Stamp,
} from "lucide-react";
import { toast } from "sonner";

// Same contrast logic as BrandingProvider so the live preview matches saved output.
function hexLightness(hex: string): number {
  const m = hex.startsWith("#") ? hex.slice(1) : hex;
  if (m.length < 6) return 128;
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}
function contrastFg(value?: string | null): string {
  if (!value || !value.startsWith("#")) return "0 0% 100%";
  return hexLightness(value) > 150 ? "240 10% 10%" : "0 0% 100%";
}
const PRESETS: { label: string; primary: string; secondary: string; accent: string }[] = [
  { label: "Bleu institutionnel", primary: "#1e40af", secondary: "#f1f5f9", accent: "#16a34a" },
  { label: "Vert académique", primary: "#15803d", secondary: "#f0fdf4", accent: "#ca8a04" },
  { label: "Bordeaux classique", primary: "#9f1239", secondary: "#fff1f2", accent: "#1e3a8a" },
  { label: "Indigo moderne", primary: "#4f46e5", secondary: "#eef2ff", accent: "#f59e0b" },
  { label: "Sable & ocre", primary: "#92400e", secondary: "#fefce8", accent: "#0f766e" },
];

export const Route = createFileRoute("/_authenticated/branding")({
  component: BrandingPage,
});

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = value.startsWith("#") ? value : "#3b82f6";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3b82f6 ou 221 83% 53%"
        />
        <div
          className="h-10 w-10 rounded-md border border-border"
          style={{ backgroundColor: `hsl(${toHsl(value)})` }}
        />
      </div>
    </div>
  );
}

function BrandingPage() {
  const schoolId = useCurrentSchool();
  const qc = useQueryClient();
  const { data: branding } = useSchoolBranding();
  const [primary, setPrimary] = useState("#1e40af");
  const [secondary, setSecondary] = useState("#f1f5f9");
  const [accent, setAccent] = useState("#16a34a");
  const [motto, setMotto] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  useEffect(() => {
    if (branding) {
      setPrimary(branding.primary_color ?? "#1e40af");
      setSecondary(branding.secondary_color ?? "#f1f5f9");
      setAccent(branding.accent_color ?? "#16a34a");
      setMotto(branding.motto ?? "");
    }
  }, [branding?.school_id]);

  // Live preview: temporarily override the global CSS variables until the
  // user saves or disables the toggle. On unmount we always restore so a
  // navigation away doesn't leave the app themed with an unsaved draft.
  useEffect(() => {
    if (!livePreview) return;
    const root = document.documentElement;
    const keys = [
      "--primary",
      "--accent",
      "--secondary",
      "--sidebar-primary",
      "--sidebar-accent",
      "--ring",
      "--primary-foreground",
      "--sidebar-primary-foreground",
      "--accent-foreground",
      "--gradient-primary",
    ];
    const snapshot = Object.fromEntries(keys.map((k) => [k, root.style.getPropertyValue(k)]));

    const set = (k: string, v: string) => root.style.setProperty(k, v);
    set("--primary", toHsl(primary));
    set("--accent", toHsl(accent));
    set("--secondary", toHsl(secondary));
    set("--sidebar-primary", toHsl(primary));
    set("--sidebar-accent", toHsl(accent));
    set("--ring", toHsl(primary));
    set("--primary-foreground", contrastFg(primary));
    set("--sidebar-primary-foreground", contrastFg(primary));
    set("--accent-foreground", contrastFg(accent));
    const h = toHsl(primary);
    set("--gradient-primary", `linear-gradient(135deg, hsl(${h}), hsl(${h} / 0.75))`);

    return () => {
      for (const [k, v] of Object.entries(snapshot)) {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      }
    };
  }, [livePreview, primary, secondary, accent]);

  function resetToSaved() {
    setPrimary(branding?.primary_color ?? "#1e40af");
    setSecondary(branding?.secondary_color ?? "#f1f5f9");
    setAccent(branding?.accent_color ?? "#16a34a");
    setMotto(branding?.motto ?? "");
    toast.success("Aperçu réinitialisé");
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setPrimary(p.primary);
    setSecondary(p.secondary);
    setAccent(p.accent);
  }

  const dirty =
    primary !== (branding?.primary_color ?? "#1e40af") ||
    secondary !== (branding?.secondary_color ?? "#f1f5f9") ||
    accent !== (branding?.accent_color ?? "#16a34a") ||
    motto !== (branding?.motto ?? "");

  async function save() {
    if (!schoolId) return;
    setSaving(true);
    const { error } = await supabase.from("school_branding").upsert({
      school_id: schoolId,
      primary_color: primary,
      secondary_color: secondary,
      accent_color: accent,
      motto: motto || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Identité visuelle enregistrée");
    qc.invalidateQueries({ queryKey: ["school-branding"] });
  }

  async function uploadLogo(file: File) {
    if (!schoolId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${schoolId}/logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("school-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("school_branding").upsert({
      school_id: schoolId,
      primary_color: primary,
      secondary_color: secondary,
      accent_color: accent,
      logo_url: path,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Logo téléversé");
    qc.invalidateQueries({ queryKey: ["school-branding"] });
  }

  async function removeLogo() {
    if (!schoolId || !branding) return;
    const { data } = await supabase
      .from("school_branding")
      .select("logo_url")
      .eq("school_id", schoolId)
      .maybeSingle();
    if (data?.logo_url) await supabase.storage.from("school-logos").remove([data.logo_url]);
    await supabase.from("school_branding").update({ logo_url: null }).eq("school_id", schoolId);
    qc.invalidateQueries({ queryKey: ["school-branding"] });
    toast.success("Logo supprimé");
  }

  async function uploadStamp(file: File) {
    if (!schoolId) return;
    setUploadingStamp(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${schoolId}/stamp.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("school-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingStamp(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("school_branding").upsert({
      school_id: schoolId,
      primary_color: primary,
      secondary_color: secondary,
      accent_color: accent,
      stamp_url: path,
    } as any);
    setUploadingStamp(false);
    if (error) return toast.error(error.message);
    toast.success("Cachet téléversé");
    qc.invalidateQueries({ queryKey: ["school-branding"] });
  }

  async function removeStamp() {
    if (!schoolId || !branding) return;
    const { data } = await supabase
      .from("school_branding")
      .select("*")
      .eq("school_id", schoolId)
      .maybeSingle();
    const path = (data as any)?.stamp_url as string | null;
    if (path) await supabase.storage.from("school-logos").remove([path]);
    await supabase
      .from("school_branding")
      .update({ stamp_url: null } as any)
      .eq("school_id", schoolId);
    qc.invalidateQueries({ queryKey: ["school-branding"] });
    toast.success("Cachet supprimé");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Identité visuelle"
        description="Personnalisez les couleurs et le logo de votre école. Les changements s'appliquent partout (sidebar, bulletins, factures)."
      />

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5" /> Logo de l'école
          </CardTitle>
          <CardDescription>Format PNG ou JPG carré recommandé, minimum 256×256 px.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <SchoolLogo className="h-24 w-24" />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}{" "}
              Choisir un fichier
            </Button>
            {branding?.logo_url && (
              <Button variant="outline" onClick={removeLogo}>
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Stamp className="h-5 w-5" /> Cachet / signature de la direction
          </CardTitle>
          <CardDescription>
            Apparaît sur les bulletins (zone « La Direction »). PNG à fond transparent recommandé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="h-24 w-32 grid place-items-center rounded-lg border border-border bg-muted/30 overflow-hidden">
            {branding?.stamp_url ? (
              <img src={branding.stamp_url} alt="Cachet" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Aucun cachet</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={stampRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadStamp(e.target.files[0])}
            />
            <Button onClick={() => stampRef.current?.click()} disabled={uploadingStamp}>
              {uploadingStamp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}{" "}
              Choisir un fichier
            </Button>
            {branding?.stamp_url && (
              <Button variant="outline" onClick={removeStamp}>
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display flex items-center gap-2">
                <Palette className="h-5 w-5" /> Couleurs & aperçu
              </CardTitle>
              <CardDescription>
                Choisissez vos couleurs, prévisualisez en direct dans toute l'application, puis
                enregistrez.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="live-preview" className="cursor-pointer text-sm">
                Aperçu en direct
              </Label>
              <Switch id="live-preview" checked={livePreview} onCheckedChange={setLivePreview} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Presets rapides */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Préréglages
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:shadow-sm"
                >
                  <span className="flex -space-x-1">
                    <span
                      className="h-4 w-4 rounded-full border border-card"
                      style={{ background: p.primary }}
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-card"
                      style={{ background: p.accent }}
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-card"
                      style={{ background: p.secondary }}
                    />
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <ColorField
            label="Couleur primaire (boutons, liens)"
            value={primary}
            onChange={setPrimary}
          />
          <ColorField
            label="Couleur secondaire (fonds)"
            value={secondary}
            onChange={setSecondary}
          />
          <ColorField
            label="Couleur d'accent (badges, succès)"
            value={accent}
            onChange={setAccent}
          />
          <div className="space-y-1.5">
            <Label>Devise / slogan (optionnel)</Label>
            <Input
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              placeholder="Excellence et discipline"
            />
          </div>

          {/* Aperçu mini-application */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Aperçu de l'interface
            </Label>
            <div
              className="overflow-hidden rounded-xl border border-border"
              style={{ background: `hsl(${toHsl(secondary)})` }}
            >
              <div className="grid grid-cols-[140px_1fr]">
                {/* Mini sidebar */}
                <div
                  className="flex flex-col gap-1 p-3 text-xs"
                  style={{
                    background: `hsl(${toHsl(primary)})`,
                    color: `hsl(${contrastFg(primary)})`,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-white/15">
                      É
                    </span>
                    <span className="truncate">Mon École</span>
                  </div>
                  <div className="rounded-md bg-white/15 px-2 py-1 font-medium">
                    Tableau de bord
                  </div>
                  <div className="px-2 py-1 opacity-80">Élèves</div>
                  <div className="px-2 py-1 opacity-80">Classes</div>
                  <div className="px-2 py-1 opacity-80">Paiements</div>
                </div>
                {/* Mini content */}
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Bonjour 👋</p>
                      {motto && <p className="text-xs text-muted-foreground italic">« {motto} »</p>}
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `hsl(${toHsl(accent)})`,
                        color: `hsl(${contrastFg(accent)})`,
                      }}
                    >
                      ACTIF
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-md px-3 py-1.5 text-xs font-medium shadow-sm"
                      style={{
                        background: `hsl(${toHsl(primary)})`,
                        color: `hsl(${contrastFg(primary)})`,
                      }}
                    >
                      Action principale
                    </button>
                    <button
                      className="rounded-md border px-3 py-1.5 text-xs font-medium"
                      style={{
                        borderColor: `hsl(${toHsl(primary)})`,
                        color: `hsl(${toHsl(primary)})`,
                      }}
                    >
                      Secondaire
                    </button>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: `hsl(${toHsl(accent)})`,
                        color: `hsl(${toHsl(accent)})`,
                      }}
                    >
                      Badge
                    </Badge>
                  </div>
                  <div className="rounded-md border border-border bg-card p-2.5 text-xs text-muted-foreground">
                    Carte d'exemple — texte courant, liens et tableaux héritent de vos couleurs.
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {livePreview
                ? "Aperçu en direct activé : la sidebar et les boutons de l'application utilisent vos couleurs en cours d'édition."
                : "Activez « Aperçu en direct » pour voir vos couleurs s'appliquer à toute l'application avant d'enregistrer."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={resetToSaved} disabled={!dirty}>
              <RotateCcw className="h-4 w-4 mr-2" /> Annuler les changements
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
