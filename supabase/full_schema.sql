-- ============================================================
-- ML2 EduManager - SCHEMA COMPLET (toutes les migrations)
-- A coller dans le SQL Editor de TON nouveau projet Supabase, puis Run.
-- Genere le 2026-06-19 16:11
-- ============================================================

-- ============================================================
-- >>> 20260616150729_47b87a27-caa3-4772-97c9-0f0231f05937.sql
-- ============================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'school_admin', 'teacher', 'parent', 'student');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE public.gender AS ENUM ('M', 'F');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ SCHOOLS ============
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, school_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_school_member(_school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND school_id = _school_id)
  OR public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(_school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('school_admin','super_admin')
    AND (school_id = _school_id OR role = 'super_admin')
  );
$$;

-- Schools RLS
CREATE POLICY "members view their school" ON public.schools FOR SELECT TO authenticated
  USING (public.is_school_member(id));
CREATE POLICY "super admin manages schools" ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school admin updates own school" ON public.schools FOR UPDATE TO authenticated
  USING (public.is_school_admin(id)) WITH CHECK (public.is_school_admin(id));

-- Profiles RLS
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_school_member(school_id));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "school admin manages school profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- User_roles RLS
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_school_admin(school_id));

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CLASSES ============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  academic_year TEXT NOT NULL,
  main_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "school members view classes" ON public.classes FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school admin manages classes" ON public.classes FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ============ SUBJECTS ============
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  coefficient NUMERIC(4,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school members view subjects" ON public.subjects FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school admin manages subjects" ON public.subjects FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  matricule TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender gender,
  birth_date DATE,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_name TEXT,
  parent_phone TEXT,
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, matricule)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "school members view students" ON public.students FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school admin manages students" ON public.students FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ============ GRADES ============
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 20,
  term TEXT NOT NULL,
  evaluation_type TEXT,
  comment TEXT,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school members view grades" ON public.grades FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "teachers and admins record grades" ON public.grades FOR INSERT TO authenticated WITH CHECK (public.is_school_member(school_id));
CREATE POLICY "teachers and admins update grades" ON public.grades FOR UPDATE TO authenticated USING (public.is_school_member(school_id)) WITH CHECK (public.is_school_member(school_id));
CREATE POLICY "school admin deletes grades" ON public.grades FOR DELETE TO authenticated USING (public.is_school_admin(school_id));

-- ============ ATTENDANCES ============
CREATE TABLE public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL,
  reason TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT ALL ON public.attendances TO service_role;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school members view attendances" ON public.attendances FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school members record attendances" ON public.attendances FOR INSERT TO authenticated WITH CHECK (public.is_school_member(school_id));
CREATE POLICY "school members update attendances" ON public.attendances FOR UPDATE TO authenticated USING (public.is_school_member(school_id)) WITH CHECK (public.is_school_member(school_id));

-- ============ INVOICES / PAYMENTS ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "school members view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school admin manages invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school members view payments" ON public.payments FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school admin manages payments" ON public.payments FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ============ SCHEDULES ============
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school members view schedules" ON public.schedules FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "school admin manages schedules" ON public.schedules FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view their messages" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_school_admin(school_id));
CREATE POLICY "users send messages in their school" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_school_member(school_id));
CREATE POLICY "users update their messages" ON public.messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR sender_id = auth.uid());


-- ============================================================
-- >>> 20260616152843_cb8ca660-b7c2-4e8f-b18d-0d1c32546afd.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616153615_378f8f13-54f4-40cc-914b-ea033b7d9222.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616155752_60d48130-912a-4489-89bf-e5a162a0ba09.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616160734_8bb958b8-734d-4c3b-8aac-c377724c66b4.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616161649_79421be1-5a71-42f3-969a-1f4cd53ffa88.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616162217_1f8a61d0-0bc2-4e74-9a3c-2d990131095c.sql
-- ============================================================
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_email text;

-- ============================================================
-- >>> 20260616162520_fe9eada0-1958-4cd9-8a69-2bd7addd2a63.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616162535_80fcf13d-f7ef-4a66-a3b3-6db93cacb929.sql
-- ============================================================

-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke public execute on SECURITY DEFINER helpers; grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_school_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_school_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated;


-- ============================================================
-- >>> 20260616162732_c1024cd5-2a1c-49a6-9a85-43a2fe64c948.sql
-- ============================================================

CREATE TABLE public.homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  attachment_url text,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT ALL ON public.homework TO service_role;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homework_select_members" ON public.homework
  FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "homework_write_admins" ON public.homework
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

CREATE TRIGGER set_homework_updated BEFORE UPDATE ON public.homework
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_homework_class_due ON public.homework(class_id, due_date DESC);


-- ============================================================
-- >>> 20260616163018_bfd62125-41dd-48a2-8263-5f13d78e111d.sql
-- ============================================================
-- Announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select_members" ON public.announcements FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER tg_announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_announcements_school_published ON public.announcements(school_id, published_at DESC);

-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_members" ON public.events FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "events_admin_write" ON public.events FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER tg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_events_school_starts ON public.events(school_id, starts_at DESC);

-- ============================================================
-- >>> 20260616164053_0481fc80-2bf4-4363-9a94-456c8ec1759c.sql
-- ============================================================

CREATE TABLE public.seating_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rows INT NOT NULL DEFAULT 5 CHECK (rows BETWEEN 1 AND 20),
  cols INT NOT NULL DEFAULT 6 CHECK (cols BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_plans TO authenticated;
GRANT ALL ON public.seating_plans TO service_role;
ALTER TABLE public.seating_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seating_plans_select" ON public.seating_plans FOR SELECT TO authenticated USING (public.is_school_member(school_id));
CREATE POLICY "seating_plans_write" ON public.seating_plans FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE TRIGGER seating_plans_updated_at BEFORE UPDATE ON public.seating_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.seating_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.seating_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  row INT NOT NULL,
  col INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, row, col),
  UNIQUE (plan_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_assignments TO authenticated;
GRANT ALL ON public.seating_assignments TO service_role;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seating_assignments_select" ON public.seating_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seating_plans p WHERE p.id = plan_id AND public.is_school_member(p.school_id)));
CREATE POLICY "seating_assignments_write" ON public.seating_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seating_plans p WHERE p.id = plan_id AND public.is_school_admin(p.school_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seating_plans p WHERE p.id = plan_id AND public.is_school_admin(p.school_id)));

CREATE INDEX idx_seating_plans_class ON public.seating_plans(class_id);
CREATE INDEX idx_seating_assignments_plan ON public.seating_assignments(plan_id);


-- ============================================================
-- >>> 20260616164737_6fd6fa67-5f6b-4271-bcae-1f69574294d6.sql
-- ============================================================
ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='announcements') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements';
  END IF;
END $$;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;

-- ============================================================
-- >>> 20260616164922_11f051d2-1022-4167-93ef-92d12faca1ed.sql
-- ============================================================

CREATE TABLE public.student_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, parent_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_parents TO authenticated;
GRANT ALL ON public.student_parents TO service_role;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own links" ON public.student_parents FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid() OR public.is_school_admin(school_id));
CREATE POLICY "Admins manage links" ON public.student_parents FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE INDEX idx_student_parents_parent ON public.student_parents(parent_user_id);
CREATE INDEX idx_student_parents_student ON public.student_parents(student_id);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_students_user ON public.students(student_user_id);

-- Helper: is the current user a parent of this student?
CREATE OR REPLACE FUNCTION public.is_student_parent(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.student_parents WHERE student_id = _student_id AND parent_user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_student_parent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_parent(uuid) TO authenticated;

-- Allow parents/students to read their own student record
CREATE POLICY "Parent/student read own" ON public.students FOR SELECT TO authenticated
  USING (student_user_id = auth.uid() OR public.is_student_parent(id));

-- Same for grades, attendances, invoices
CREATE POLICY "Parent/student read grades" ON public.grades FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id
    AND (s.student_user_id = auth.uid() OR public.is_student_parent(s.id))));

CREATE POLICY "Parent/student read attendance" ON public.attendances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendances.student_id
    AND (s.student_user_id = auth.uid() OR public.is_student_parent(s.id))));

CREATE POLICY "Parent/student read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = invoices.student_id
    AND (s.student_user_id = auth.uid() OR public.is_student_parent(s.id))));


-- ============================================================
-- >>> 20260616165313_d1644462-4632-4027-8574-a7b3828220e3.sql
-- ============================================================

CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view years" ON public.academic_years FOR SELECT TO authenticated
  USING (public.is_school_member(school_id));
CREATE POLICY "Admins manage years" ON public.academic_years FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE INDEX idx_academic_years_school ON public.academic_years(school_id);
CREATE UNIQUE INDEX uniq_active_year_per_school ON public.academic_years(school_id) WHERE is_active;

CREATE TRIGGER trg_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Optional year tagging on grades and invoices
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_grades_year ON public.grades(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_invoices_year ON public.invoices(academic_year_id);


-- ============================================================
-- >>> 20260616165501_a24fe3df-ab5d-47f1-aec9-8d2558741471.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616172130_439bae86-5f86-4607-9b20-6c71fec0d80c.sql
-- ============================================================
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url text;

-- ============================================================
-- >>> 20260616172153_3f280f07-7492-488d-831b-a03913505cfa.sql
-- ============================================================

CREATE POLICY "school members read student photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'student-photos');

CREATE POLICY "school members upload student photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-photos');

CREATE POLICY "school members update student photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'student-photos');

CREATE POLICY "school members delete student photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'student-photos');


-- ============================================================
-- >>> 20260616180604_879482b3-b838-43e5-a3e0-49a4b83c3888.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260616180830_28a7758d-bf74-4317-aad8-d58d8c50273a.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only school admins or super admins may resolve a user id by email
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'school_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(_email) LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;


-- ============================================================
-- >>> 20260617095536_5ac1cb5f-f32c-44d5-95fe-1c3c195b548b.sql
-- ============================================================

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


-- ============================================================
-- >>> 20260617120000_harden_user_roles_rls.sql
-- ============================================================
-- ============================================================================
-- SECURITY HARDENING: user_roles privilege-escalation fix
-- ----------------------------------------------------------------------------
-- The previous policy "school admin manages user_roles" was FOR ALL with
--   USING/WITH CHECK = is_school_admin(school_id) OR has_role(uid,'super_admin')
-- This let a school_admin INSERT a row { user_id: self, role: 'super_admin',
-- school_id: <their own school> }: the WITH CHECK passed because
-- is_school_admin(<their school>) is true. Since has_role(uid,'super_admin')
-- is NOT scoped by school, that single row granted GLOBAL super_admin â€” a
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


-- ============================================================
-- >>> 20260619155000_realtime_all_tables.sql
-- ============================================================
-- ============================================================
-- Realtime : s'assurer que TOUTES les tables applicatives
-- emettent les changements Postgres (publication supabase_realtime)
-- et exposent la ligne complete sur UPDATE/DELETE (REPLICA IDENTITY FULL).
-- Idempotent : peut etre rejoue sans risque.
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'schools','school_subscriptions','subscription_invoices','school_branding',
    'profiles','user_roles','role_permissions',
    'classes','subjects','students','teacher_assignments','schedules',
    'grades','attendances','homework','announcements',
    'payments','invoices','messages','platform_audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Ajout a la publication (ignore si deja membre)
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    -- Image complete de la ligne pour les events update/delete
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- Verification (optionnel) : lister les tables realtime
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;


-- ============================================================
-- >>> 20260620010000_bulletins_report_cards.sql
-- ============================================================
-- Bulletins (report cards) : matieres par classe, meta bulletin,
-- lieu de naissance eleve, site web ecole, cachet direction.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.school_branding ADD COLUMN IF NOT EXISTS stamp_url text;

CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  coefficient numeric(4,2),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "class_subjects_select_members" ON public.class_subjects;
CREATE POLICY "class_subjects_select_members" ON public.class_subjects
  FOR SELECT TO authenticated USING (public.is_school_member(school_id));
DROP POLICY IF EXISTS "class_subjects_write_admins" ON public.class_subjects;
CREATE POLICY "class_subjects_write_admins" ON public.class_subjects
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));
DROP TRIGGER IF EXISTS set_class_subjects_updated ON public.class_subjects;
CREATE TRIGGER set_class_subjects_updated BEFORE UPDATE ON public.class_subjects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON public.class_subjects(class_id);

CREATE TABLE IF NOT EXISTS public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term text NOT NULL,
  decision text,
  principal_appreciation text,
  absences_justified numeric(6,2) NOT NULL DEFAULT 0,
  absences_unjustified numeric(6,2) NOT NULL DEFAULT 0,
  late_justified numeric(6,2) NOT NULL DEFAULT 0,
  late_unjustified numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_cards TO authenticated;
GRANT ALL ON public.report_cards TO service_role;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report_cards_select_members" ON public.report_cards;
CREATE POLICY "report_cards_select_members" ON public.report_cards
  FOR SELECT TO authenticated USING (public.is_school_member(school_id));
DROP POLICY IF EXISTS "report_cards_write_members" ON public.report_cards;
CREATE POLICY "report_cards_write_members" ON public.report_cards
  FOR ALL TO authenticated
  USING (public.is_school_member(school_id))
  WITH CHECK (public.is_school_member(school_id));
DROP TRIGGER IF EXISTS set_report_cards_updated ON public.report_cards;
CREATE TRIGGER set_report_cards_updated BEFORE UPDATE ON public.report_cards
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_report_cards_student ON public.report_cards(student_id);


-- ============================================================
-- >>> 20260621180000_school_registration.sql
-- ============================================================
-- Inscription directeur + validation super admin.

CREATE TABLE IF NOT EXISTS public.school_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name text NOT NULL,
  school_code text NOT NULL,
  director_first_name text,
  director_last_name text,
  email text,
  phone text,
  address text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_registration_requests TO authenticated;
GRANT ALL ON public.school_registration_requests TO service_role;
ALTER TABLE public.school_registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "srr_insert_own" ON public.school_registration_requests;
CREATE POLICY "srr_insert_own" ON public.school_registration_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
DROP POLICY IF EXISTS "srr_select_own_or_admin" ON public.school_registration_requests;
CREATE POLICY "srr_select_own_or_admin" ON public.school_registration_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "srr_admin_manage" ON public.school_registration_requests;
CREATE POLICY "srr_admin_manage" ON public.school_registration_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX IF NOT EXISTS idx_srr_status ON public.school_registration_requests(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb;
BEGIN
  m := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, COALESCE(m->>'first_name', ''), COALESCE(m->>'last_name', ''));
  IF (m ? 'school_name') AND (m ? 'school_code')
     AND length(trim(COALESCE(m->>'school_name', ''))) > 0
     AND length(trim(COALESCE(m->>'school_code', ''))) > 0 THEN
    INSERT INTO public.school_registration_requests
      (requester_id, school_name, school_code, director_first_name, director_last_name, email, phone, address)
    VALUES (NEW.id, m->>'school_name', m->>'school_code', m->>'first_name', m->>'last_name', NEW.email, m->>'phone', m->>'address');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_school_registration(_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.school_registration_requests; new_school_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acces refuse : super admin requis';
  END IF;
  SELECT * INTO r FROM public.school_registration_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF r.status = 'approved' THEN RAISE EXCEPTION 'Demande deja approuvee'; END IF;
  IF EXISTS (SELECT 1 FROM public.schools WHERE code = r.school_code) THEN
    RAISE EXCEPTION 'Le code ecole "%" est deja utilise', r.school_code;
  END IF;
  INSERT INTO public.schools (name, code, email, phone, address, status)
  VALUES (r.school_name, r.school_code, r.email, r.phone, r.address, 'active')
  RETURNING id INTO new_school_id;
  INSERT INTO public.user_roles (user_id, role, school_id)
  VALUES (r.requester_id, 'school_admin', new_school_id)
  ON CONFLICT (user_id, role, school_id) DO NOTHING;
  UPDATE public.profiles SET school_id = new_school_id
  WHERE id = r.requester_id AND school_id IS NULL;
  UPDATE public.school_registration_requests
  SET status = 'approved', school_id = new_school_id, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;
  RETURN new_school_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.approve_school_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_school_registration(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_school_registration(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acces refuse : super admin requis';
  END IF;
  UPDATE public.school_registration_requests
  SET status = 'rejected', rejection_reason = _reason, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reject_school_registration(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_school_registration(uuid, text) TO authenticated;


-- ============================================================
-- >>> 20260621210000_school_portal_rpc.sql
-- ============================================================
-- Portail public par ecole (/e/{code}) : lecture minimale sans auth.
CREATE OR REPLACE FUNCTION public.get_school_portal(_code text)
RETURNS TABLE (
  id uuid, name text, code text, logo_url text,
  primary_color text, accent_color text, secondary_color text, motto text, brand_logo_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.code, s.logo_url,
         b.primary_color, b.accent_color, b.secondary_color, b.motto, b.logo_url
  FROM public.schools s
  LEFT JOIN public.school_branding b ON b.school_id = s.id
  WHERE lower(trim(s.code)) = lower(trim(_code))
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_school_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_portal(text) TO anon, authenticated;


-- ============================================================
-- >>> 20260621220000_default_member_password.sql
-- ============================================================
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS default_member_password text;

