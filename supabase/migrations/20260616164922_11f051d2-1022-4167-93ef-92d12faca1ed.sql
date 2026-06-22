
CREATE TABLE public.student_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, parent_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_parents TO authenticated;
GRANT ALL ON public.student_parents TO service_role;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own links" ON public.student_parents FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid() OR public.is_school_admin(school_id));
CREATE POLICY "Admins manage links" ON public.student_parents FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE INDEX idx_student_parents_parent ON public.student_parents(parent_user_id);
CREATE INDEX idx_student_parents_student ON public.student_parents(student_id);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_students_user ON public.students(student_user_id);

-- Helper: is the current user a parent of this student?
CREATE OR REPLACE FUNCTION public.is_student_parent(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.student_parents WHERE student_id = _student_id AND parent_user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_student_parent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_parent(uuid) TO authenticated;

-- Allow parents/students to read their own student record
CREATE POLICY "Parent/student read own" ON public.students FOR SELECT TO authenticated
  USING (student_user_id = auth.uid() OR public.is_student_parent(id));

-- Same for grades, attendances, invoices
CREATE POLICY "Parent/student read grades" ON public.grades FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id
    AND (s.student_user_id = auth.uid() OR public.is_student_parent(s.id))));

CREATE POLICY "Parent/student read attendance" ON public.attendances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendances.student_id
    AND (s.student_user_id = auth.uid() OR public.is_student_parent(s.id))));

CREATE POLICY "Parent/student read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = invoices.student_id
    AND (s.student_user_id = auth.uid() OR public.is_student_parent(s.id))));
