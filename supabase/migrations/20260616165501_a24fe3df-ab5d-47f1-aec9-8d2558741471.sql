
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_user_id, class_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT ALL ON public.teacher_assignments TO service_role;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own assignments" ON public.teacher_assignments FOR SELECT TO authenticated
  USING (teacher_user_id = auth.uid() OR public.is_school_admin(school_id));
CREATE POLICY "Admins manage assignments" ON public.teacher_assignments FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_user_id);
CREATE INDEX idx_teacher_assignments_class ON public.teacher_assignments(class_id);

CREATE OR REPLACE FUNCTION public.teaches_class(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teacher_assignments WHERE class_id = _class_id AND teacher_user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.teaches_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teaches_class(uuid) TO authenticated;

-- Teachers can manage grades for students in classes they teach
CREATE POLICY "Teachers manage class grades" ON public.grades FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id AND public.teaches_class(s.class_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id AND public.teaches_class(s.class_id)));

-- Teachers can manage attendance for students in classes they teach
CREATE POLICY "Teachers manage class attendance" ON public.attendances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendances.student_id AND public.teaches_class(s.class_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendances.student_id AND public.teaches_class(s.class_id)));
