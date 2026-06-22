-- ============================================================
-- Bulletins (report cards) : matieres par classe, meta bulletin,
-- lieu de naissance eleve, site web ecole, cachet direction.
-- Idempotent : peut etre rejoue sans risque.
-- ============================================================

-- 1) Lieu de naissance de l'eleve (formulaire eleve)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_place text;

-- 2) Site web de l'ecole (pied de page du bulletin)
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS website text;

-- 3) Cachet / signature de la direction (branding)
ALTER TABLE public.school_branding ADD COLUMN IF NOT EXISTS stamp_url text;

-- 4) Matieres d'une classe : liste, coefficient par classe, professeur affiche, ordre
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  coefficient numeric(4,2),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "class_subjects_select_members" ON public.class_subjects;
CREATE POLICY "class_subjects_select_members" ON public.class_subjects
  FOR SELECT TO authenticated USING (public.is_school_member(school_id));
DROP POLICY IF EXISTS "class_subjects_write_admins" ON public.class_subjects;
CREATE POLICY "class_subjects_write_admins" ON public.class_subjects
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));
DROP TRIGGER IF EXISTS set_class_subjects_updated ON public.class_subjects;
CREATE TRIGGER set_class_subjects_updated BEFORE UPDATE ON public.class_subjects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON public.class_subjects(class_id);

-- 5) Meta bulletin par eleve et par periode (semestre)
CREATE TABLE IF NOT EXISTS public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term text NOT NULL,
  decision text,
  principal_appreciation text,
  absences_justified numeric(6,2) NOT NULL DEFAULT 0,
  absences_unjustified numeric(6,2) NOT NULL DEFAULT 0,
  late_justified numeric(6,2) NOT NULL DEFAULT 0,
  late_unjustified numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_cards TO authenticated;
GRANT ALL ON public.report_cards TO service_role;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report_cards_select_members" ON public.report_cards;
CREATE POLICY "report_cards_select_members" ON public.report_cards
  FOR SELECT TO authenticated USING (public.is_school_member(school_id));
DROP POLICY IF EXISTS "report_cards_write_members" ON public.report_cards;
CREATE POLICY "report_cards_write_members" ON public.report_cards
  FOR ALL TO authenticated
  USING (public.is_school_member(school_id))
  WITH CHECK (public.is_school_member(school_id));
DROP TRIGGER IF EXISTS set_report_cards_updated ON public.report_cards;
CREATE TRIGGER set_report_cards_updated BEFORE UPDATE ON public.report_cards
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_report_cards_student ON public.report_cards(student_id);

-- 6) Realtime pour les nouvelles tables (idempotent)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['class_subjects','report_cards'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
