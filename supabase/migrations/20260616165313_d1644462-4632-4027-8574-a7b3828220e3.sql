
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view years" ON public.academic_years FOR SELECT TO authenticated
  USING (public.is_school_member(school_id));
CREATE POLICY "Admins manage years" ON public.academic_years FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE INDEX idx_academic_years_school ON public.academic_years(school_id);
CREATE UNIQUE INDEX uniq_active_year_per_school ON public.academic_years(school_id) WHERE is_active;

CREATE TRIGGER trg_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Optional year tagging on grades and invoices
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_grades_year ON public.grades(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_invoices_year ON public.invoices(academic_year_id);
