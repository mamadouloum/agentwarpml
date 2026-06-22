
CREATE TABLE public.school_branding (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  primary_color TEXT NOT NULL DEFAULT '221 83% 53%',
  secondary_color TEXT NOT NULL DEFAULT '210 40% 96%',
  accent_color TEXT NOT NULL DEFAULT '142 71% 45%',
  button_color TEXT,
  logo_url TEXT,
  motto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_branding TO authenticated;
GRANT ALL ON public.school_branding TO service_role;

ALTER TABLE public.school_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read branding of their school"
ON public.school_branding FOR SELECT TO authenticated
USING (public.is_school_member(school_id));

CREATE POLICY "School admins manage their branding"
ON public.school_branding FOR ALL TO authenticated
USING (public.is_school_admin(school_id))
WITH CHECK (public.is_school_admin(school_id));

CREATE TRIGGER trg_school_branding_updated
BEFORE UPDATE ON public.school_branding
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage policies for the school-logos bucket (bucket created via tool)
CREATE POLICY "Public read school logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'school-logos');

CREATE POLICY "School admins upload their logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-logos'
  AND public.is_school_admin((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "School admins update their logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-logos'
  AND public.is_school_admin((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "School admins delete their logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-logos'
  AND public.is_school_admin((storage.foldername(name))[1]::uuid)
);
