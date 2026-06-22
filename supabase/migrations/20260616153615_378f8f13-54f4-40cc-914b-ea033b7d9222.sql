
CREATE TYPE public.subscription_plan AS ENUM ('starter','pro','enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled');

CREATE TABLE public.school_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'starter',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_subscriptions TO authenticated;
GRANT ALL ON public.school_subscriptions TO service_role;
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read subscription" ON public.school_subscriptions FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "admins write subscription" ON public.school_subscriptions FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER tg_sub_updated BEFORE UPDATE ON public.school_subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.school_subscriptions(id) ON DELETE SET NULL,
  plan public.subscription_plan NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  status text NOT NULL DEFAULT 'paid',
  method text,
  reference text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read sub invoices" ON public.subscription_invoices FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "admins write sub invoices" ON public.subscription_invoices FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE INDEX idx_sub_inv_school_date ON public.subscription_invoices(school_id, paid_at DESC);
