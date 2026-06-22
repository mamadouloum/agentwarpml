
-- Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3b6fa0',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read categories" ON public.expense_categories FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "admins write categories" ON public.expense_categories FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  spent_at date NOT NULL DEFAULT current_date,
  method text,
  supplier text,
  note text,
  receipt_url text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "admins write expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE TRIGGER tg_expenses_updated BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_expenses_school_date ON public.expenses(school_id, spent_at DESC);
CREATE INDEX idx_expense_cat_school ON public.expense_categories(school_id);
