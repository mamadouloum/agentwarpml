
-- Status column on schools
DO $$ BEGIN
  CREATE TYPE public.school_status AS ENUM ('active','suspended','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS status public.school_status NOT NULL DEFAULT 'active';

-- Audit logs
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.platform_audit_logs TO authenticated;
GRANT ALL ON public.platform_audit_logs TO service_role;

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin read audit" ON public.platform_audit_logs;
CREATE POLICY "super_admin read audit" ON public.platform_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "auth insert audit" ON public.platform_audit_logs;
CREATE POLICY "auth insert audit" ON public.platform_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.platform_audit_logs (created_at DESC);

-- Super admin RLS on schools (so they can manage all)
DROP POLICY IF EXISTS "super_admin manage schools" ON public.schools;
CREATE POLICY "super_admin manage schools" ON public.schools
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin manage subscriptions" ON public.school_subscriptions;
CREATE POLICY "super_admin manage subscriptions" ON public.school_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin manage user_roles" ON public.user_roles;
CREATE POLICY "super_admin manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
