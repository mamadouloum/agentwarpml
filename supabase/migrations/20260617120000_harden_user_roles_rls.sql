-- ============================================================================
-- SECURITY HARDENING: user_roles privilege-escalation fix
-- ----------------------------------------------------------------------------
-- The previous policy "school admin manages user_roles" was FOR ALL with
--   USING/WITH CHECK = is_school_admin(school_id) OR has_role(uid,'super_admin')
-- This let a school_admin INSERT a row { user_id: self, role: 'super_admin',
-- school_id: <their own school> }: the WITH CHECK passed because
-- is_school_admin(<their school>) is true. Since has_role(uid,'super_admin')
-- is NOT scoped by school, that single row granted GLOBAL super_admin — a
-- critical privilege escalation.
--
-- Fix: split management into two policies.
--   * super_admin  -> may manage every role.
--   * school_admin -> may manage ONLY non-privileged roles, and ONLY within
--                     their own school. They can never create/modify
--                     'super_admin' or 'school_admin' rows.
-- ============================================================================

-- Drop the dangerous combined policy.
DROP POLICY IF EXISTS "school admin manages user_roles" ON public.user_roles;

-- Super admins: unrestricted management of all role assignments.
DROP POLICY IF EXISTS "super_admin manages all user_roles" ON public.user_roles;
CREATE POLICY "super_admin manages all user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- School admins: manage ONLY non-privileged roles, ONLY in their own school.
-- 'super_admin' and 'school_admin' can never be granted/edited here, so a
-- school_admin can no longer elevate anyone (including themselves).
DROP POLICY IF EXISTS "school_admin manages basic user_roles" ON public.user_roles;
CREATE POLICY "school_admin manages basic user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
  public.is_school_admin(school_id)
  AND role NOT IN ('super_admin', 'school_admin')
)
WITH CHECK (
  public.is_school_admin(school_id)
  AND school_id IS NOT NULL
  AND role NOT IN ('super_admin', 'school_admin')
);
