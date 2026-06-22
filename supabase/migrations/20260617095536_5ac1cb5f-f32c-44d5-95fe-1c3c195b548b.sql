
-- Allow school admins (directeurs) to create new schools in their group
CREATE POLICY "school admin can insert schools"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'school_admin') OR has_role(auth.uid(), 'super_admin')
);

-- Allow school admins to manage user_roles within their school
CREATE POLICY "school admin manages user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
  is_school_admin(school_id) OR has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  is_school_admin(school_id) OR has_role(auth.uid(), 'super_admin')
);

-- Auto-grant school_admin role on a newly created school to its creator
CREATE OR REPLACE FUNCTION public.auto_grant_school_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role, school_id)
    VALUES (auth.uid(), 'school_admin', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_auto_grant_school_admin ON public.schools;
CREATE TRIGGER tg_auto_grant_school_admin
AFTER INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_school_admin();
