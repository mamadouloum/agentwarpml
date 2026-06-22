import { supabase } from "@/integrations/supabase/client";

/**
 * Génère un matricule unique pour un élève au format
 *   {CODE_ECOLE}-{ANNEE}-{NNNN}
 * Le compteur est basé sur le nombre d'élèves déjà inscrits dans l'école
 * pour l'année civile en cours, +1, et zéro-paddé sur 4 chiffres.
 */
export async function generateStudentMatricule(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data: school } = await supabase
    .from("schools")
    .select("code")
    .eq("id", schoolId)
    .maybeSingle();
  const prefix =
    (school?.code ?? "ECO")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "ECO";

  // Find the highest existing number for this prefix+year and increment.
  const pattern = `${prefix}-${year}-%`;
  const { data: existing } = await supabase
    .from("students")
    .select("matricule")
    .eq("school_id", schoolId)
    .like("matricule", pattern)
    .order("matricule", { ascending: false })
    .limit(1);

  let next = 1;
  const last = existing?.[0]?.matricule;
  if (last) {
    const tail = last.split("-").pop() ?? "";
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}
