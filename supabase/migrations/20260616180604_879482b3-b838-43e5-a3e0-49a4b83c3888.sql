
-- 1) Add staff role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2) role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role_id uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_role_id, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- School admins manage permissions for roles in their school; super admin can do anything; users can read their own
CREATE POLICY "school admin manages role_permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.id = role_permissions.user_role_id
      AND (public.is_school_admin(ur.school_id) OR public.has_role(auth.uid(), 'super_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.id = role_permissions.user_role_id
      AND (public.is_school_admin(ur.school_id) OR public.has_role(auth.uid(), 'super_admin'))
  )
);

CREATE POLICY "users view own role_permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.id = role_permissions.user_role_id
      AND ur.user_id = auth.uid()
  )
);

CREATE TRIGGER tg_role_permissions_updated
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Helper function
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _school_id uuid, _module text, _need_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.user_role_id = ur.id
    WHERE ur.user_id = _user_id
      AND (ur.school_id = _school_id OR ur.role = 'super_admin')
      AND rp.module = _module
      AND (rp.can_read OR (_need_write AND rp.can_write))
      AND (NOT _need_write OR rp.can_write)
  ) OR public.is_school_admin(_school_id);
$$;

-- 4) Realtime publication
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools','school_subscriptions','subscription_invoices','profiles','user_roles',
    'role_permissions','classes','students','teacher_assignments','payments','invoices',
    'attendances','grades','homework','announcements','messages'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 5) Ensure REPLICA IDENTITY FULL for the main tables to get full row on updates
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools','school_subscriptions','user_roles','role_permissions','profiles'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
