
-- expenses
DROP POLICY IF EXISTS "members read expenses" ON public.expenses;
CREATE POLICY "admins read expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_school_admin(school_id));

-- expense_categories
DROP POLICY IF EXISTS "members read categories" ON public.expense_categories;
CREATE POLICY "admins read categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (public.is_school_admin(school_id));

-- school_subscriptions
DROP POLICY IF EXISTS "members read subscription" ON public.school_subscriptions;
CREATE POLICY "admins read subscription" ON public.school_subscriptions
  FOR SELECT TO authenticated USING (public.is_school_admin(school_id));

-- subscription_invoices
DROP POLICY IF EXISTS "members read sub invoices" ON public.subscription_invoices;
CREATE POLICY "admins read sub invoices" ON public.subscription_invoices
  FOR SELECT TO authenticated USING (public.is_school_admin(school_id));

-- profiles: only owner + admins (super admin already covered via has_role)
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "owners and admins read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_school_admin(school_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );
