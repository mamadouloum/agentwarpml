
CREATE TABLE public.seating_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rows INT NOT NULL DEFAULT 5 CHECK (rows BETWEEN 1 AND 20),
  cols INT NOT NULL DEFAULT 6 CHECK (cols BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_plans TO authenticated;
GRANT ALL ON public.seating_plans TO service_role;
ALTER TABLE public.seating_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seating_plans_select" ON public.seating_plans FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "seating_plans_write" ON public.seating_plans FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER seating_plans_updated_at BEFORE UPDATE ON public.seating_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.seating_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.seating_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  row INT NOT NULL,
  col INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, row, col),
  UNIQUE (plan_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_assignments TO authenticated;
GRANT ALL ON public.seating_assignments TO service_role;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seating_assignments_select" ON public.seating_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seating_plans p WHERE p.id = plan_id AND public.is_school_member(p.school_id)));
CREATE POLICY "seating_assignments_write" ON public.seating_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seating_plans p WHERE p.id = plan_id AND public.is_school_admin(p.school_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seating_plans p WHERE p.id = plan_id AND public.is_school_admin(p.school_id)));

CREATE INDEX idx_seating_plans_class ON public.seating_plans(class_id);
CREATE INDEX idx_seating_assignments_plan ON public.seating_assignments(plan_id);
