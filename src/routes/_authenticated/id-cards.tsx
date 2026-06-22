import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { IdCard, FileDown, Loader2, Upload, User, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { useSchoolBranding, toHsl } from "@/lib/branding";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/id-cards")({
  component: IdCardsPage,
});

type TemplateOpts = {
  orientation: "landscape" | "portrait";
  primaryHex: string;
  showMatricule: boolean;
  showClass: boolean;
  showBirth: boolean;
  showMotto: boolean;
  footerText: string;
  year: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  if (m.length !== 6) return [30, 64, 175];
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function signedPhoto(path?: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("student-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function IdCardsPage() {
  const schoolId = useCurrentSchool();
  const { data: branding } = useSchoolBranding();
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [singleId, setSingleId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [batchClassIds, setBatchClassIds] = useState<Set<string>>(new Set());
  const [batchSearch, setBatchSearch] = useState("");
  const [batchFormat, setBatchFormat] = useState<"pdf" | "zip">("pdf");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const [opts, setOpts] = useState<TemplateOpts>({
    orientation: "landscape",
    primaryHex: "#1e3a8a",
    showMatricule: true,
    showClass: true,
    showBirth: true,
    showMotto: true,
    footerText: "",
    year: String(new Date().getFullYear()),
  });

  useEffect(() => {
    if (branding?.primary_color?.startsWith("#")) {
      setOpts((o) => ({ ...o, primaryHex: branding.primary_color }));
    }
  }, [branding?.primary_color]);

  const { data: school } = useQuery({
    queryKey: ["school-info", schoolId],
    enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schools").select("name,address").eq("id", schoolId!).maybeSingle()).data,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-id-cards", classId],
    queryFn: async () => {
      let req = supabase.from("students").select("id,first_name,last_name,matricule,birth_date,photo_url,classes(name)").order("last_name");
      if (classId !== "all") req = req.eq("class_id", classId);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["students-id-cards-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,first_name,last_name,matricule,birth_date,photo_url,class_id,classes(name)")
        .order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const batchFiltered = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    return allStudents.filter((s: any) => {
      if (batchClassIds.size > 0 && !batchClassIds.has(s.class_id)) return false;
      if (!q) return true;
      return `${s.first_name} ${s.last_name} ${s.matricule}`.toLowerCase().includes(q);
    });
  }, [allStudents, batchClassIds, batchSearch]);

  const single = useMemo(
    () => students.find((s: any) => s.id === singleId) ?? students[0] ?? null,
    [students, singleId],
  );

  const { data: singlePhotoUrl } = useQuery({
    queryKey: ["single-photo", single?.id, single?.photo_url],
    enabled: !!single?.photo_url,
    queryFn: () => signedPhoto(single?.photo_url),
  });

  async function importCsv(file: File) {
    try {
      const text = await file.text();
      // Accept comma, semicolon or newline-separated; first column = matricule
      const tokens = text
        .split(/\r?\n/)
        .flatMap((line) => line.split(/[,;\t]/))
        .map((t) => t.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
      const lower = new Set(tokens.map((t) => t.toLowerCase()));
      // Skip header row if it contains common labels
      ["matricule", "matriculé", "id"].forEach((h) => lower.delete(h));
      const matched = allStudents.filter((s: any) =>
        lower.has(String(s.matricule ?? "").toLowerCase()),
      );
      if (!matched.length) { toast.error("Aucun matricule reconnu dans le fichier."); return; }
      setSelected(new Set(matched.map((s: any) => s.id)));
      setBatchClassIds(new Set());
      setBatchSearch("");
      toast.success(`${matched.length} élève(s) sélectionné(s) depuis le CSV.`);
    } catch (e: any) {
      toast.error(e?.message ?? "CSV invalide.");
    }
  }

  async function uploadPhoto(file: File) {
    if (!single || !schoolId) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${schoolId}/${single.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("student-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    const { error: dbErr } = await supabase.from("students").update({ photo_url: path }).eq("id", single.id);
    if (dbErr) { toast.error(dbErr.message); return; }
    toast.success("Photo mise à jour");
    qc.invalidateQueries({ queryKey: ["students-id-cards"] });
    qc.invalidateQueries({ queryKey: ["single-photo"] });
  }

  function toggle(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allSelected = students.length > 0 && students.every((s: any) => selected.has(s.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(students.map((s: any) => s.id)));
  }

  async function drawCard(
    doc: jsPDF, st: any, x: number, y: number, w: number, h: number,
    logoData: string | null, photoData: string | null,
  ) {
    const [pr, pg, pb] = hexToRgb(opts.primaryHex);
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 3, 3, "FD");

    // Header band
    doc.setFillColor(pr, pg, pb);
    doc.roundedRect(x, y, w, 12, 3, 3, "F");
    doc.rect(x, y + 6, w, 6, "F");

    if (logoData) {
      try { doc.addImage(logoData, "PNG", x + 2, y + 1.5, 9, 9); } catch { /* ignore */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text((school?.name ?? "École").slice(0, 38), x + (logoData ? 13 : 3), y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`CARTE SCOLAIRE ${opts.year}`, x + (logoData ? 13 : 3), y + 10);

    // Photo
    const phX = x + 4, phY = y + 16, phW = 22, phH = 28;
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(209, 213, 219);
    doc.rect(phX, phY, phW, phH, "FD");
    if (photoData) {
      try { doc.addImage(photoData, "JPEG", phX, phY, phW, phH); } catch { /* ignore */ }
    } else {
      const initials = `${(st.first_name?.[0] ?? "").toUpperCase()}${(st.last_name?.[0] ?? "").toUpperCase()}`;
      doc.setTextColor(156, 163, 175);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(initials, phX + phW / 2, phY + phH / 2 + 2, { align: "center" });
    }

    // Info
    const ix = x + 30; let iy = y + 19;
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`${st.last_name} ${st.first_name}`.slice(0, 28), ix, iy);
    iy += 5;
    const line = (label: string, val: string) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
      doc.text(label, ix, iy);
      doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold");
      doc.text(val, ix + 16, iy);
      iy += 4.5;
    };
    if (opts.showMatricule) line("Matricule", String(st.matricule ?? "—"));
    if (opts.showClass) line("Classe", String(st.classes?.name ?? "—"));
    if (opts.showBirth && st.birth_date) line("Né(e) le", new Date(st.birth_date).toLocaleDateString("fr-FR"));

    doc.setDrawColor(230, 230, 230);
    doc.line(x + 3, y + h - 7, x + w - 3, y + h - 7);
    doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(130, 130, 130);
    const foot = opts.footerText || (opts.showMotto ? (branding?.motto ?? school?.address ?? "") : "");
    doc.text(foot, x + 3, y + h - 3);
    doc.text(`Valide ${opts.year}`, x + w - 3, y + h - 3, { align: "right" });
  }

  async function downloadSingle() {
    if (!single) { toast.error("Sélectionnez un élève."); return; }
    setGenerating(true);
    try {
      const logo = branding?.logo_url ? await urlToDataUrl(branding.logo_url) : null;
      const photo = singlePhotoUrl ? await urlToDataUrl(singlePhotoUrl) : null;
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: opts.orientation });
      const w = 85, h = 55;
      const pageW = opts.orientation === "landscape" ? 297 : 210;
      const x = (pageW - w) / 2, y = 30;
      await drawCard(doc, single, x, y, w, h, logo, photo);
      doc.save(`carte_${single.matricule || single.id}.pdf`);
      toast.success("Carte générée");
    } finally { setGenerating(false); }
  }

  async function downloadBatch() {
    const targets = batchFiltered.filter((s: any) => selected.has(s.id));
    if (!targets.length) { toast.error("Sélectionnez au moins un élève."); return; }
    setGenerating(true);
    setProgress({ done: 0, total: targets.length });
    try {
      const logo = branding?.logo_url ? await urlToDataUrl(branding.logo_url) : null;
      const w = 85, h = 55;

      if (batchFormat === "pdf") {
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const mx = (210 - w * 2 - 10) / 2, my = 15, gx = 10, gy = 8, per = 8;
        for (let i = 0; i < targets.length; i++) {
          const st = targets[i];
          const idx = i % per;
          if (i > 0 && idx === 0) doc.addPage();
          const col = idx % 2, row = Math.floor(idx / 2);
          const x = mx + col * (w + gx), y = my + row * (h + gy);
          const photoUrl = st.photo_url ? await signedPhoto(st.photo_url) : null;
          const photo = photoUrl ? await urlToDataUrl(photoUrl) : null;
          await drawCard(doc, st, x, y, w, h, logo, photo);
          setProgress({ done: i + 1, total: targets.length });
        }
        doc.save(`cartes_scolaires_${opts.year}.pdf`);
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (let i = 0; i < targets.length; i++) {
          const st = targets[i];
          const doc = new jsPDF({ unit: "mm", format: "a4", orientation: opts.orientation });
          const pageW = opts.orientation === "landscape" ? 297 : 210;
          const photoUrl = st.photo_url ? await signedPhoto(st.photo_url) : null;
          const photo = photoUrl ? await urlToDataUrl(photoUrl) : null;
          await drawCard(doc, st, (pageW - w) / 2, 30, w, h, logo, photo);
          const safe = `${st.matricule || st.id}_${st.last_name}_${st.first_name}`.replace(/[^a-z0-9_-]/gi, "_");
          zip.file(`${safe}.pdf`, doc.output("blob"));
          setProgress({ done: i + 1, total: targets.length });
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `cartes_scolaires_${opts.year}.zip`; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`${targets.length} carte(s) générée(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la génération.");
    } finally { setGenerating(false); setProgress(null); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartes scolaires"
        description="Générez la carte d'un élève ou un lot complet, avec photo et modèle personnalisable."
      />

      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList>
          <TabsTrigger value="single"><User className="h-4 w-4 mr-2" />Un élève</TabsTrigger>
          <TabsTrigger value="batch"><IdCard className="h-4 w-4 mr-2" />Lot</TabsTrigger>
        </TabsList>

        {/* Shared customization */}
        <Card className="shadow-[var(--shadow-card)] border-border mt-4">
          <CardHeader><CardTitle className="font-display text-base">Modèle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <Input type="color" value={opts.primaryHex} onChange={(e) => setOpts({ ...opts, primaryHex: e.target.value })} className="h-10 p-1" />
            </div>
            <div className="space-y-1.5">
              <Label>Année</Label>
              <Input value={opts.year} onChange={(e) => setOpts({ ...opts, year: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Texte de pied</Label>
              <Input value={opts.footerText} onChange={(e) => setOpts({ ...opts, footerText: e.target.value })} placeholder={branding?.motto ?? "Devise / adresse"} />
            </div>
            <div className="flex items-center justify-between gap-2"><Label>Matricule</Label><Switch checked={opts.showMatricule} onCheckedChange={(v) => setOpts({ ...opts, showMatricule: v })} /></div>
            <div className="flex items-center justify-between gap-2"><Label>Classe</Label><Switch checked={opts.showClass} onCheckedChange={(v) => setOpts({ ...opts, showClass: v })} /></div>
            <div className="flex items-center justify-between gap-2"><Label>Date naiss.</Label><Switch checked={opts.showBirth} onCheckedChange={(v) => setOpts({ ...opts, showBirth: v })} /></div>
            <div className="flex items-center justify-between gap-2"><Label>Devise</Label><Switch checked={opts.showMotto} onCheckedChange={(v) => setOpts({ ...opts, showMotto: v })} /></div>
          </CardContent>
        </Card>

        <TabsContent value="single" className="space-y-4">
          <Card className="shadow-[var(--shadow-card)] border-border">
            <CardHeader>
              <CardTitle className="font-display text-base">Élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Classe (filtre)</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Élève</Label>
                  <Select value={single?.id ?? ""} onValueChange={setSingleId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {students.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name} — {s.matricule}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {single && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Live preview */}
                  <div
                    className="rounded-lg border bg-white text-slate-900 overflow-hidden shadow-md"
                    style={{ aspectRatio: "85/55" }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: opts.primaryHex }}>
                      {branding?.logo_url ? <img src={branding.logo_url} alt="" className="h-7 w-7 rounded object-cover bg-white/20" /> : <div className="h-7 w-7 rounded bg-white/20" />}
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{school?.name ?? "École"}</div>
                        <div className="text-[10px] opacity-90">CARTE SCOLAIRE {opts.year}</div>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3">
                      <div className="w-20 h-28 rounded bg-slate-100 border grid place-items-center overflow-hidden shrink-0">
                        {singlePhotoUrl ? <img src={singlePhotoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-400 font-bold text-xl">{(single.first_name?.[0] ?? "")+(single.last_name?.[0] ?? "")}</span>}
                      </div>
                      <div className="text-xs space-y-1 min-w-0">
                        <div className="font-bold text-sm truncate">{single.last_name} {single.first_name}</div>
                        {opts.showMatricule && <div><span className="text-slate-500">Matricule </span><b>{single.matricule}</b></div>}
                        {opts.showClass && <div><span className="text-slate-500">Classe </span><b>{single.classes?.name ?? "—"}</b></div>}
                        {opts.showBirth && single.birth_date && <div><span className="text-slate-500">Né(e) </span><b>{new Date(single.birth_date).toLocaleDateString("fr-FR")}</b></div>}
                      </div>
                    </div>
                    <div className="px-3 pb-2 text-[10px] italic text-slate-500 flex justify-between border-t pt-1 mx-3">
                      <span className="truncate">{opts.footerText || (opts.showMotto ? (branding?.motto ?? school?.address ?? "") : "")}</span>
                      <span>Valide {opts.year}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1.5 block">Photo de l'élève</Label>
                      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
                      <Button variant="outline" onClick={() => uploadRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> {single.photo_url ? "Remplacer la photo" : "Téléverser une photo"}
                      </Button>
                    </div>
                    <Button onClick={downloadSingle} disabled={generating} className="w-full">
                      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                      Télécharger la carte
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <Card className="shadow-[var(--shadow-card)] border-border">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Recherche (nom, matricule)</Label>
                  <Input value={batchSearch} onChange={(e) => setBatchSearch(e.target.value)} placeholder="Rechercher..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Format</Label>
                  <Select value={batchFormat} onValueChange={(v) => setBatchFormat(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF unique (8 cartes / page)</SelectItem>
                      <SelectItem value="zip">ZIP (1 PDF par élève)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Classes ({batchClassIds.size === 0 ? "toutes" : batchClassIds.size})</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setBatchClassIds(new Set()); setSelected(new Set()); }}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${batchClassIds.size === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                  >Toutes</button>
                  {classes.map((c: any) => {
                    const on = batchClassIds.has(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => {
                          setBatchClassIds((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
                          setSelected(new Set());
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                      >{c.name}</button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  {batchFiltered.length} élève(s) — {selected.size} sélectionné(s)
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ""; }} />
                  <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
                    <FileUp className="h-4 w-4 mr-2" /> Importer CSV
                  </Button>
                  <Button variant="outline" size="sm"
                    onClick={() => {
                      const all = batchFiltered.every((s: any) => selected.has(s.id));
                      setSelected(all ? new Set() : new Set(batchFiltered.map((s: any) => s.id)));
                    }}
                    disabled={batchFiltered.length === 0}>
                    {batchFiltered.length > 0 && batchFiltered.every((s: any) => selected.has(s.id)) ? "Tout désélectionner" : "Tout sélectionner"}
                  </Button>
                  <Button onClick={downloadBatch} disabled={generating || selected.size === 0}>
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                    Télécharger ({selected.size})
                  </Button>
                </div>
              </div>

              {progress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Génération en cours...</span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)] border-border">
            <CardContent className="p-4">
              {batchFiltered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun élève.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[480px] overflow-auto">
                  {batchFiltered.map((s: any) => {
                    const isOn = selected.has(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggle(s.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${isOn ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"}`}>
                        <Checkbox checked={isOn} onCheckedChange={() => toggle(s.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{s.last_name} {s.first_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.matricule} {s.classes?.name ? `• ${s.classes.name}` : ""}
                          </div>
                        </div>
                        {s.photo_url && <Badge variant="outline" className="shrink-0">📷</Badge>}
                        {isOn && <Badge variant="secondary" className="shrink-0">OK</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
