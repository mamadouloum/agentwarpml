
-- CANTINE
CREATE TABLE public.cantine_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  formula text NOT NULL,
  monthly_amount numeric(12,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cantine_subscriptions TO authenticated;
GRANT ALL ON public.cantine_subscriptions TO service_role;
ALTER TABLE public.cantine_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cantine_select" ON public.cantine_subscriptions FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "cantine_write" ON public.cantine_subscriptions FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER set_cantine_updated BEFORE UPDATE ON public.cantine_subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- TRANSPORT ROUTES
CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  capacity int NOT NULL DEFAULT 0,
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated;
GRANT ALL ON public.transport_routes TO service_role;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "troutes_select" ON public.transport_routes FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "troutes_write" ON public.transport_routes FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER set_troutes_updated BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- TRANSPORT SUBSCRIPTIONS
CREATE TABLE public.transport_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  monthly_amount numeric(12,2) NOT NULL DEFAULT 0,
  pickup_point text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_subscriptions TO authenticated;
GRANT ALL ON public.transport_subscriptions TO service_role;
ALTER TABLE public.transport_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tsub_select" ON public.transport_subscriptions FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "tsub_write" ON public.transport_subscriptions FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER set_tsub_updated BEFORE UPDATE ON public.transport_subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- LIBRARY BOOKS
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  total_qty int NOT NULL DEFAULT 1,
  available_qty int NOT NULL DEFAULT 1,
  shelf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_select" ON public.library_books FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "books_write" ON public.library_books FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER set_books_updated BEFORE UPDATE ON public.library_books FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- LIBRARY LOANS
CREATE TABLE public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  loan_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  return_date date,
  status text NOT NULL DEFAULT 'borrowed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_loans TO authenticated;
GRANT ALL ON public.library_loans TO service_role;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_select" ON public.library_loans FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "loans_write" ON public.library_loans FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER set_loans_updated BEFORE UPDATE ON public.library_loans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
