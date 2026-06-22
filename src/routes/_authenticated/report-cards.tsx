import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { useSchoolBranding } from "@/lib/branding";
import { useReportCardAccess } from "@/hooks/use-report-card-access";
import {
  SEMESTERS,
  SEMESTER_TITLE,
  DECISIONS,
  APPRECIATION_LEGEND,
  buildClassReports,
  classAverage,
  fr,
  type StudentReport,
} from "@/lib/report-card";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/report-cards")({
  component: ReportCardsPage,
});

// ---- helpers ---------------------------------------------------------------

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

async function signedPhoto(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("student-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  if (m.length !== 6) return [30, 64, 175];
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function primaryRgb(value?: string | null): [number, number, number] {
  if (!value) return [21, 128, 61];
  if (value.startsWith("#")) return hexToRgb(value);
  const parts = value.split(" ");
  if (parts.length === 3)
    return hslToRgb(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
  return [21, 128, 61];
}

const n2 = (x: number | null) => (x == null ? "" : x.toFixed(2));
function teacherLabel(first?: string | null, last?: string | null): string {
  const l = (last ?? "").trim();
  const f = (first ?? "").trim();
  if (!l && !f) return "";
  return f ? `${f[0].toUpperCase()}. ${l}` : l;
}
function frDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

type MetaRow = {
  decision: string;
  appreciation: string;
  aj: string;
  anj: string;
  rj: string;
  rnj: string;
};
const emptyMeta = (): MetaRow => ({
  decision: "",
  appreciation: "",
  aj: "0",
  anj: "0",
  rj: "0",
  rnj: "0",
});

// ---- component -------------------------------------------------------------

function ReportCardsPage() {
  const schoolId = useCurrentSchool();
  const qc = useQueryClient();
  const { data: branding } = useSchoolBranding();
  const { data: access } = useReportCardAccess();
  const canView = access?.canView ?? false;
  const canDownload = access?.canDownload ?? false;

  const [classId, setClassId] = useState("");
  const [term, setTerm] = useState<string>(SEMESTERS[0]);
  const [previewId, setPreviewId] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-rc"],
    enabled: canView,
    queryFn: async () =>
      (await supabase.from("classes").select("id,name,level,academic_year").order("name")).data ??
      [],
  });
  const klass = useMemo(
    () => (classes as any[]).find((c) => c.id === classId) ?? null,
    [classes, classId],
  );

  const { data: school } = useQuery({
    queryKey: ["school-rc", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("schools")
          .select("name,address,phone,website")
          .eq("id", schoolId!)
          .maybeSingle()
      ).data,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-rc", classId],
    enabled: !!classId && canView,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("students")
          .select("id,first_name,last_name,matricule,birth_date,birth_place,photo_url")
          .eq("class_id", classId)
          .order("last_name")
      ).data ?? [],
  });
  const studentIds = useMemo(() => (students as any[]).map((s) => s.id), [students]);

  const { data: classSubjectRows = [] } = useQuery({
    queryKey: ["class-subjects-rc", classId],
    enabled: !!classId && canView,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("class_subjects")
          .select("*")
          .eq("class_id", classId)
          .order("position")
      ).data ?? [],
  });
  const { data: subjectList = [] } = useQuery({
    queryKey: ["subjects-rc", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => (await supabase.from("subjects").select("id,name,coefficient")).data ?? [],
  });
  const { data: teacherProfiles = [] } = useQuery({
    queryKey: ["teacher-profiles-rc", classSubjectRows],
    enabled: (classSubjectRows as any[]).length > 0,
    queryFn: async () => {
      const ids = Array.from(
        new Set((classSubjectRows as any[]).map((r) => r.teacher_id).filter(Boolean)),
      );
      if (!ids.length) return [];
      return (
        (await supabase.from("profiles").select("id,first_name,last_name").in("id", ids)).data ?? []
      );
    },
  });

  const classSubjects = useMemo(() => {
    const subjById = new Map((subjectList as any[]).map((s) => [s.id, s]));
    const profById = new Map((teacherProfiles as any[]).map((p) => [p.id, p]));
    return (classSubjectRows as any[]).map((cs) => {
      const subj = subjById.get(cs.subject_id);
      const prof = cs.teacher_id ? profById.get(cs.teacher_id) : null;
      const coef = cs.coefficient != null ? Number(cs.coefficient) : Number(subj?.coefficient ?? 1);
      return {
        subjectId: cs.subject_id,
        name: subj?.name ?? "Matière",
        coef,
        teacher: prof ? teacherLabel(prof.first_name, prof.last_name) : "",
      };
    });
  }, [classSubjectRows, subjectList, teacherProfiles]);

  const { data: grades = [] } = useQuery({
    queryKey: ["grades-rc", classId, term, studentIds],
    enabled: !!classId && studentIds.length > 0 && canView,
    queryFn: async () =>
      (
        await supabase
          .from("grades")
          .select("student_id,subject_id,score,max_score,evaluation_type")
          .eq("term", term)
          .in("student_id", studentIds)
      ).data ?? [],
  });

  const { data: metaRows = [] } = useQuery({
    queryKey: ["report-cards-meta", classId, term, studentIds],
    enabled: !!classId && studentIds.length > 0 && canView,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("report_cards")
          .select("*")
          .eq("term", term)
          .in("student_id", studentIds)
      ).data ?? [],
  });

  const { data: attendanceAgg = {} } = useQuery({
    queryKey: ["attendance-agg-rc", classId, studentIds],
    enabled: !!classId && studentIds.length > 0 && canView,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendances")
        .select("student_id,status")
        .in("student_id", studentIds);
      const agg: Record<string, { absent: number; excused: number; late: number }> = {};
      for (const a of (data ?? []) as any[]) {
        agg[a.student_id] ||= { absent: 0, excused: 0, late: 0 };
        if (a.status === "absent") agg[a.student_id].absent++;
        else if (a.status === "excused") agg[a.student_id].excused++;
        else if (a.status === "late") agg[a.student_id].late++;
      }
      return agg;
    },
  });

  const reports = useMemo(
    () => buildClassReports(students as any[], classSubjects, grades as any[]),
    [students, classSubjects, grades],
  );
  const classAvg = useMemo(() => classAverage(reports), [reports]);

  // editable meta keyed by student
  const [meta, setMeta] = useState<Record<string, MetaRow>>({});
  useEffect(() => {
    const byStudent = new Map((metaRows as any[]).map((m) => [m.student_id, m]));
    const next: Record<string, MetaRow> = {};
    for (const st of students as any[]) {
      const m = byStudent.get(st.id);
      if (m) {
        next[st.id] = {
          decision: m.decision ?? "",
          appreciation: m.principal_appreciation ?? "",
          aj: String(m.absences_justified ?? 0),
          anj: String(m.absences_unjustified ?? 0),
          rj: String(m.late_justified ?? 0),
          rnj: String(m.late_unjustified ?? 0),
        };
      } else {
        const agg = (attendanceAgg as any)[st.id];
        next[st.id] = {
          ...emptyMeta(),
          anj: String(agg?.absent ?? 0),
          aj: String(agg?.excused ?? 0),
          rnj: String(agg?.late ?? 0),
        };
      }
    }
    setMeta(next);
  }, [metaRows, attendanceAgg, students]);

  useEffect(() => {
    if (!previewId && (students as any[]).length) setPreviewId((students as any[])[0].id);
  }, [students, previewId]);

  const previewStudent = useMemo(
    () => (students as any[]).find((s) => s.id === previewId) ?? null,
    [students, previewId],
  );
  const previewReport: StudentReport | null = previewId ? (reports[previewId] ?? null) : null;
  const previewMeta = meta[previewId] ?? emptyMeta();

  function setPreviewMeta(patch: Partial<MetaRow>) {
    setPreviewId((id) => id);
    setMeta((p) => ({ ...p, [previewId]: { ...(p[previewId] ?? emptyMeta()), ...patch } }));
  }

  async function saveMeta() {
    if (!schoolId || !previewId) return;
    const m = meta[previewId] ?? emptyMeta();
    const { error } = await (supabase as any).from("report_cards").upsert(
      {
        school_id: schoolId,
        student_id: previewId,
        term,
        decision: m.decision || null,
        principal_appreciation: m.appreciation || null,
        absences_justified: Number(m.aj || 0),
        absences_unjustified: Number(m.anj || 0),
        late_justified: Number(m.rj || 0),
        late_unjustified: Number(m.rnj || 0),
      },
      { onConflict: "student_id,term" },
    );
    if (error) return toast.error(error.message);
    toast.success("Bulletin enregistré");
    qc.invalidateQueries({ queryKey: ["report-cards-meta", classId, term, studentIds] });
  }

  // ---- PDF ----------------------------------------------------------------

  async function drawBulletin(
    doc: jsPDF,
    st: any,
    rep: StudentReport | null,
    m: MetaRow,
    logo: string | null,
    stamp: string | null,
    photo: string | null,
  ) {
    const [pr, pg, pb] = primaryRgb(branding?.primary_color);
    const M = 10,
      W = 190;

    // Header
    if (logo) {
      try {
        doc.addImage(logo, "PNG", M, 8, 22, 22);
      } catch {
        /* ignore */
      }
    }
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text((school?.name ?? "École").toUpperCase(), 35, 16);
    if (branding?.motto) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(branding.motto, 35, 21);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const coords = [school?.address, school?.phone ? `TEL. ${school.phone}` : ""]
      .filter(Boolean)
      .join("  ");
    if (coords) doc.text(coords, M, 38);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`ANNEE SCOLAIRE: ${klass?.academic_year ?? ""}`, 135, 12);
    doc.text(`CLASSE: ${klass?.name ?? ""}`, 135, 17);
    doc.text(`EFFECTIF: ${(students as any[]).length} ELEVES`, 135, 22);

    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.5);
    doc.line(M, 42, M + W, 42);

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(SEMESTER_TITLE[term] ?? "BULLETIN", 105, 49, { align: "center" });

    // Student box + photo
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(M, 53, 158, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`NOM: `, M + 2, 60);
    doc.setFont("helvetica", "bold");
    doc.text(`${st.last_name ?? ""}`, M + 14, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`PRENOM: `, M + 70, 60);
    doc.setFont("helvetica", "bold");
    doc.text(`${st.first_name ?? ""}`, M + 88, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`DATE & LIEU DE NAISSANCE: `, M + 2, 67);
    doc.setFont("helvetica", "bold");
    doc.text(`${frDate(st.birth_date)}${st.birth_place ? " - " + st.birth_place : ""}`, M + 52, 67);
    doc.setFont("helvetica", "normal");
    doc.text(`MATRICULE: `, M + 110, 67);
    doc.setFont("helvetica", "bold");
    doc.text(`${st.matricule ?? ""}`, M + 130, 67);

    doc.setDrawColor(180, 180, 180);
    doc.rect(172, 50, 28, 30);
    if (photo) {
      try {
        doc.addImage(photo, "JPEG", 172, 50, 28, 30);
      } catch {
        /* ignore */
      }
    } else {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text("PHOTO", 186, 66, { align: "center" });
      doc.setTextColor(20, 20, 20);
    }

    // Grades table
    const lines = rep?.lines ?? [];
    autoTable(doc, {
      startY: 84,
      head: [
        [
          "Disciplines",
          "Coef.",
          "C.C",
          "Comp.",
          "Moy.S",
          "CC×Coef",
          "MS×Coef",
          "Appréciations des professeurs",
        ],
      ],
      body: lines.map((l) => [
        l.name,
        n2(l.coef),
        n2(l.cc),
        n2(l.compo),
        n2(l.moyS),
        n2(l.ccCoef),
        n2(l.msCoef),
        `${l.appreciation}${l.teacher ? "   " + l.teacher : ""}`,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [pr, pg, pb],
        textColor: 255,
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 7.5, cellPadding: 1.4, textColor: [20, 20, 20] },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 11, halign: "center" },
        2: { cellWidth: 13, halign: "center" },
        3: { cellWidth: 13, halign: "center" },
        4: { cellWidth: 15, halign: "center" },
        5: { cellWidth: 17, halign: "center" },
        6: { cellWidth: 17, halign: "center" },
        7: { cellWidth: 60 },
      },
      margin: { left: M, right: M },
    });

    let y = (doc as any).lastAutoTable?.finalY ?? 150;

    // Summary band
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.rect(M, y, W, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    doc.text(`MOY. SEMESTRE: ${fr(rep?.average ?? null)}/20`, M + 2, y + 5);
    doc.text(`MOY. CLASSE: ${fr(classAvg)}/20`, M + 60, y + 5);
    doc.text(`TOTAL: ${fr(rep?.totalMsCoef ?? null)}`, M + 118, y + 5);
    doc.text(`RANG: ${rep?.rank ? rep.rank : "—"}`, M + 160, y + 5);
    [58, 116, 158].forEach((dx) => doc.line(M + dx, y, M + dx, y + 8));

    // Absences
    y += 11;
    doc.rect(M, y, W, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Bilan des absences et retards", M + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(`ABSENCES JUSTIFIEES : ${m.aj} h     RETARDS JUSTIFIES : ${m.rj} h`, M + 2, y + 9.5);
    doc.text(
      `ABSENCES NON JUSTIFIEES : ${m.anj} h     RETARDS NON JUSTIFIES : ${m.rnj} h`,
      M + 2,
      y + 13.5,
    );

    // Decision row
    y += 18;
    const cw = W / 4;
    DECISIONS.forEach((d, i) => {
      const x = M + i * cw;
      const sel = m.decision === d;
      if (sel) {
        doc.setFillColor(pr, pg, pb);
        doc.rect(x, y, cw, 8, "F");
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setDrawColor(pr, pg, pb);
        doc.rect(x, y, cw, 8);
        doc.setTextColor(40, 40, 40);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(d.toUpperCase(), x + cw / 2, y + 5, { align: "center" });
    });
    doc.setTextColor(20, 20, 20);

    // Bottom three columns
    y += 12;
    const colH = 32;
    // legend
    doc.setDrawColor(180, 180, 180);
    doc.rect(M, y, 58, colH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    APPRECIATION_LEGEND.forEach((t, i) => doc.text(t, M + 2, y + 6 + i * 5));
    // direction + stamp
    doc.rect(M + 62, y, 60, colH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("LA DIRECTION", M + 92, y + 5, { align: "center" });
    if (stamp) {
      try {
        doc.addImage(stamp, "PNG", M + 78, y + 8, 28, 20);
      } catch {
        /* ignore */
      }
    }
    // principal appreciation
    doc.rect(M + 126, y, 64, colH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("APPRECIATION DU PROFESSEUR PRINCIPAL", M + 128, y + 5, { maxWidth: 60 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const appr = doc.splitTextToSize(m.appreciation || "", 60);
    doc.text(appr, M + 128, y + 13);

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(pr, pg, pb);
    const footer = [school?.name, school?.website].filter(Boolean).join(" © - ");
    if (footer) doc.text(footer, 105, 290, { align: "center" });
    doc.setTextColor(20, 20, 20);
  }

  async function loadImages(forStudent?: any) {
    const logo = branding?.logo_url ? await urlToDataUrl(branding.logo_url) : null;
    const stamp = branding?.stamp_url ? await urlToDataUrl(branding.stamp_url) : null;
    let photo: string | null = null;
    if (forStudent?.photo_url) {
      const signed = await signedPhoto(forStudent.photo_url);
      photo = signed ? await urlToDataUrl(signed) : null;
    }
    return { logo, stamp, photo };
  }

  async function downloadOne() {
    if (!previewStudent) {
      toast.error("Sélectionnez un élève.");
      return;
    }
    setGenerating(true);
    try {
      const { logo, stamp, photo } = await loadImages(previewStudent);
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      await drawBulletin(doc, previewStudent, previewReport, previewMeta, logo, stamp, photo);
      doc.save(
        `bulletin_${previewStudent.matricule || previewStudent.id}_${term.replace(/\s+/g, "")}.pdf`,
      );
    } finally {
      setGenerating(false);
    }
  }

  async function downloadAll() {
    const list = students as any[];
    if (!list.length) {
      toast.error("Aucun élève.");
      return;
    }
    setGenerating(true);
    try {
      const logo = branding?.logo_url ? await urlToDataUrl(branding.logo_url) : null;
      const stamp = branding?.stamp_url ? await urlToDataUrl(branding.stamp_url) : null;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      for (let i = 0; i < list.length; i++) {
        const st = list[i];
        if (i > 0) doc.addPage();
        const signed = st.photo_url ? await signedPhoto(st.photo_url) : null;
        const photo = signed ? await urlToDataUrl(signed) : null;
        await drawBulletin(
          doc,
          st,
          reports[st.id] ?? null,
          meta[st.id] ?? emptyMeta(),
          logo,
          stamp,
          photo,
        );
      }
      doc.save(`bulletins_${klass?.name ?? "classe"}_${term.replace(/\s+/g, "")}.pdf`);
      toast.success(`${list.length} bulletin(s) généré(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la génération.");
    } finally {
      setGenerating(false);
    }
  }

  if (access && !canView) {
    return (
      <div className="grid place-items-center p-16">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-2xl font-bold">Accès restreint</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Seuls l'administration et les utilisateurs autorisés (permission « Bulletins ») peuvent
            consulter les bulletins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulletins de notes"
        description="Génération automatique du bulletin semestriel (modèle Maison de la Sagesse)."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadOne}
              disabled={!canDownload || generating || !previewStudent}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}{" "}
              Élève
            </Button>
            <Button
              onClick={downloadAll}
              disabled={!canDownload || generating || (students as any[]).length === 0}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}{" "}
              Toute la classe
            </Button>
          </div>
        }
      />

      {!canDownload && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Vous pouvez consulter les bulletins mais pas les télécharger. Demandez la permission «
          Bulletins » (Écriture) à l'administration.
        </div>
      )}

      <Card className="shadow-[var(--shadow-card)] border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Sélection</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Classe</Label>
            <Select
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setPreviewId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une classe" />
              </SelectTrigger>
              <SelectContent>
                {(classes as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semestre</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Élève (aperçu)</Label>
            <Select value={previewId} onValueChange={setPreviewId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un élève" />
              </SelectTrigger>
              <SelectContent>
                {(students as any[]).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.last_name} {s.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {classId && classSubjects.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Cette classe n'a pas encore de matières. Ajoutez-les dans <b>Classes → Matières</b> pour
          générer le bulletin.
        </div>
      )}

      {previewStudent && (
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardHeader>
            <CardTitle className="font-display text-base">
              Décision & appréciation (saisie manuelle)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Décision</Label>
                <Select
                  value={previewMeta.decision}
                  onValueChange={(v) => setPreviewMeta({ decision: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {DECISIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Abs. just. (h)</Label>
                  <Input
                    type="number"
                    value={previewMeta.aj}
                    onChange={(e) => setPreviewMeta({ aj: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Abs. non just.</Label>
                  <Input
                    type="number"
                    value={previewMeta.anj}
                    onChange={(e) => setPreviewMeta({ anj: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Retards just.</Label>
                  <Input
                    type="number"
                    value={previewMeta.rj}
                    onChange={(e) => setPreviewMeta({ rj: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Retards n.j.</Label>
                  <Input
                    type="number"
                    value={previewMeta.rnj}
                    onChange={(e) => setPreviewMeta({ rnj: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Appréciation du professeur principal</Label>
              <textarea
                className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={previewMeta.appreciation}
                onChange={(e) => setPreviewMeta({ appreciation: e.target.value })}
                placeholder="Commentaire général sur le travail de l'élève…"
              />
            </div>
            <Button variant="secondary" onClick={saveMeta}>
              <Save className="h-4 w-4 mr-2" /> Enregistrer
            </Button>
          </CardContent>
        </Card>
      )}

      {previewStudent && (
        <Card className="shadow-[var(--shadow-card)] border-border">
          <CardHeader>
            <CardTitle className="font-display text-base">Aperçu du bulletin</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletinPreview
              school={school}
              klass={klass}
              motto={branding?.motto}
              logoUrl={branding?.logo_url}
              effectif={(students as any[]).length}
              term={term}
              student={previewStudent}
              report={previewReport}
              meta={previewMeta}
              classAvg={classAvg}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- on-screen preview -----------------------------------------------------

function BulletinPreview({
  school,
  klass,
  motto,
  logoUrl,
  effectif,
  term,
  student,
  report,
  meta,
  classAvg,
}: any) {
  const lines = report?.lines ?? [];
  return (
    <div className="mx-auto max-w-[800px] rounded-lg border bg-white p-6 text-slate-900 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded bg-slate-100" />
          )}
          <div>
            <div className="font-bold text-base">{school?.name ?? "École"}</div>
            {motto && <div className="italic text-xs text-slate-500">{motto}</div>}
            <div className="text-[11px] text-slate-500">
              {[school?.address, school?.phone && `TEL. ${school.phone}`]
                .filter(Boolean)
                .join("  ")}
            </div>
          </div>
        </div>
        <div className="text-right text-xs font-semibold">
          <div>ANNÉE: {klass?.academic_year}</div>
          <div>CLASSE: {klass?.name}</div>
          <div>EFFECTIF: {effectif} ÉLÈVES</div>
        </div>
      </div>
      <div className="my-3 text-center font-bold uppercase">{SEMESTER_TITLE[term]}</div>
      <div className="rounded border p-2 flex items-start justify-between">
        <div className="space-y-0.5">
          <div>
            <span className="text-slate-500">NOM:</span> <b>{student.last_name}</b> &nbsp;{" "}
            <span className="text-slate-500">PRÉNOM:</span> <b>{student.first_name}</b>
          </div>
          <div>
            <span className="text-slate-500">NÉ(E) LE:</span>{" "}
            <b>
              {frDate(student.birth_date)}
              {student.birth_place ? ` - ${student.birth_place}` : ""}
            </b>
          </div>
          <div>
            <span className="text-slate-500">MATRICULE:</span> <b>{student.matricule}</b>
          </div>
        </div>
        <div className="h-20 w-16 grid place-items-center rounded border bg-slate-50 text-[10px] text-slate-400">
          PHOTO
        </div>
      </div>
      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            {[
              "Disciplines",
              "Coef.",
              "C.C",
              "Comp.",
              "Moy.S",
              "CC×Coef",
              "MS×Coef",
              "Appréciations",
            ].map((h) => (
              <th key={h} className="border px-1 py-1 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="border px-2 py-3 text-center text-slate-400">
                Aucune note saisie pour ce semestre.
              </td>
            </tr>
          ) : (
            lines.map((l: any) => (
              <tr key={l.subjectId}>
                <td className="border px-1 py-0.5">{l.name}</td>
                <td className="border px-1 py-0.5 text-center">{n2(l.coef)}</td>
                <td className="border px-1 py-0.5 text-center">{n2(l.cc)}</td>
                <td className="border px-1 py-0.5 text-center">{n2(l.compo)}</td>
                <td className="border px-1 py-0.5 text-center font-semibold">{n2(l.moyS)}</td>
                <td className="border px-1 py-0.5 text-center">{n2(l.ccCoef)}</td>
                <td className="border px-1 py-0.5 text-center">{n2(l.msCoef)}</td>
                <td className="border px-1 py-0.5">
                  {l.appreciation}
                  {l.teacher ? ` · ${l.teacher}` : ""}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] font-semibold">
        <div className="rounded border px-2 py-1">
          Moy. semestre: {fr(report?.average ?? null)}/20
        </div>
        <div className="rounded border px-2 py-1">Moy. classe: {fr(classAvg)}/20</div>
        <div className="rounded border px-2 py-1">Total: {fr(report?.totalMsCoef ?? null)}</div>
        <div className="rounded border px-2 py-1">Rang: {report?.rank || "—"}</div>
      </div>
      <div className="mt-2 rounded border px-2 py-1 text-[11px]">
        <b>Absences & retards</b> — Abs. just.: {meta.aj} h · Abs. non just.: {meta.anj} h · Retards
        just.: {meta.rj} h · Retards n.j.: {meta.rnj} h
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] font-semibold">
        {DECISIONS.map((d) => (
          <div
            key={d}
            className={`rounded border px-2 py-1 text-center ${meta.decision === d ? "bg-primary text-primary-foreground" : ""}`}
          >
            {d.toUpperCase()}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded border p-2">
          {APPRECIATION_LEGEND.map((t) => (
            <div key={t}>{t}</div>
          ))}
        </div>
        <div className="rounded border p-2 grid place-items-center font-semibold">LA DIRECTION</div>
        <div className="rounded border p-2">
          <div className="font-semibold">APPRÉCIATION DU PROFESSEUR PRINCIPAL</div>
          <div className="mt-1 text-slate-600">{meta.appreciation || "—"}</div>
        </div>
      </div>
      <div className="mt-3 text-center text-[10px] italic text-slate-500">
        {[school?.name, school?.website].filter(Boolean).join(" © - ")}
      </div>
    </div>
  );
}
