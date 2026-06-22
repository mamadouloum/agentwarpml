// Domain helpers for the school report card (bulletin) — Maison de la Sagesse template.

export const EVAL_CC = "CC";
export const EVAL_COMPO = "Composition";

export const SEMESTERS = ["Semestre 1", "Semestre 2"] as const;
export type Semester = (typeof SEMESTERS)[number];

export const SEMESTER_TITLE: Record<string, string> = {
  "Semestre 1": "BULLETIN DE NOTE DU PREMIER SEMESTRE",
  "Semestre 2": "BULLETIN DE NOTE DU DEUXIEME SEMESTRE",
};

export const DECISIONS = [
  "Félicitations",
  "Encouragements",
  "Tableau d'honneur",
  "Avertissement",
] as const;
export type Decision = (typeof DECISIONS)[number];

// Left-hand legend printed on the bulletin (informational scale).
export const APPRECIATION_LEGEND = [
  "EXCELLENT",
  "SATISFAISANT",
  "DOIT PERSEVERER",
  "DOIT SE METTRE AU TRAVAIL",
  "RISQUE DE REDOUBLER",
];

/** Per-subject appreciation derived from the subject average /20. */
export function subjectAppreciation(moy: number | null): string {
  if (moy == null || Number.isNaN(moy)) return "";
  if (moy >= 16) return "TRES BIEN";
  if (moy >= 14) return "BIEN";
  if (moy >= 12) return "ASSEZ BIEN";
  if (moy >= 10) return "PASSABLE";
  if (moy >= 8) return "INSUFFISANT";
  if (moy >= 5) return "FAIBLE";
  return "TRES FAIBLE";
}

/** Normalise a raw grade to a /20 scale. */
export function toOver20(score: number, maxScore: number): number {
  if (!maxScore) return 0;
  return (Number(score) / Number(maxScore)) * 20;
}

/** Average of a list, or null when empty. */
export function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function round2(n: number | null): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

/** French-formatted number with comma decimals (e.g. 9,31). */
export function fr(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export type SubjectLine = {
  subjectId: string;
  name: string;
  coef: number;
  teacher: string;
  cc: number | null;
  compo: number | null;
  moyS: number | null;
  ccCoef: number | null;
  msCoef: number | null;
  appreciation: string;
};

export type StudentReport = {
  studentId: string;
  lines: SubjectLine[];
  totalCoef: number;
  totalMsCoef: number; // "TOTAL GENERAL"
  average: number | null; // moyenne du semestre
  rank: number;
};

/**
 * Build per-student subject lines + totals for a class/term.
 * grades: rows with student_id, subject_id, score, max_score, evaluation_type.
 * classSubjects: ordered [{ subjectId, name, coef, teacher }].
 */
export function buildClassReports(
  students: { id: string }[],
  classSubjects: { subjectId: string; name: string; coef: number; teacher: string }[],
  grades: {
    student_id: string;
    subject_id: string;
    score: number;
    max_score: number;
    evaluation_type: string | null;
  }[],
): Record<string, StudentReport> {
  // index grades by student+subject+type
  const byKey: Record<string, { cc: number[]; compo: number[] }> = {};
  for (const g of grades) {
    const key = `${g.student_id}|${g.subject_id}`;
    byKey[key] ||= { cc: [], compo: [] };
    const v = toOver20(g.score, g.max_score);
    if ((g.evaluation_type ?? "") === EVAL_COMPO) byKey[key].compo.push(v);
    else byKey[key].cc.push(v); // default unknown types to continuous control
  }

  const reports: Record<string, StudentReport> = {};
  for (const st of students) {
    const lines: SubjectLine[] = classSubjects.map((cs) => {
      const k = byKey[`${st.id}|${cs.subjectId}`];
      const cc = k ? avg(k.cc) : null;
      const compo = k ? avg(k.compo) : null;
      const parts = [cc, compo].filter((x): x is number => x != null);
      const moyS = parts.length ? avg(parts) : null;
      return {
        subjectId: cs.subjectId,
        name: cs.name,
        coef: cs.coef,
        teacher: cs.teacher,
        cc: round2(cc),
        compo: round2(compo),
        moyS: round2(moyS),
        ccCoef: cc != null ? round2(cc * cs.coef) : null,
        msCoef: moyS != null ? round2(moyS * cs.coef) : null,
        appreciation: subjectAppreciation(moyS),
      };
    });
    const totalCoef = lines.reduce((a, l) => (l.moyS != null ? a + l.coef : a), 0);
    const totalMsCoef = lines.reduce((a, l) => a + (l.msCoef ?? 0), 0);
    const average = totalCoef ? round2(totalMsCoef / totalCoef) : null;
    reports[st.id] = {
      studentId: st.id,
      lines,
      totalCoef,
      totalMsCoef: round2(totalMsCoef) ?? 0,
      average,
      rank: 0,
    };
  }

  // ranking by average desc
  const ranked = Object.values(reports)
    .filter((r) => r.average != null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  ranked.forEach((r, i) => (reports[r.studentId].rank = i + 1));

  return reports;
}

/** Class average = mean of student averages (only students with an average). */
export function classAverage(reports: Record<string, StudentReport>): number | null {
  const avgs = Object.values(reports)
    .map((r) => r.average)
    .filter((x): x is number => x != null);
  return avg(avgs);
}
