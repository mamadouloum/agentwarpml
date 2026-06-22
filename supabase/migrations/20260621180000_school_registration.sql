-- ============================================================
-- Inscription directeur + validation super admin
-- Idempotent : peut etre rejoue sans risque.
-- ============================================================

-- 1) Demandes d'inscription d'ecole
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

-- 2) A l'inscription : creer le profil ET, si l'utilisateur a declare une ecole,
--    creer automatiquement une demande d'inscription (fonctionne meme si la
--    confirmation email est active, car c'est un trigger SECURITY DEFINER).
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

-- 3) Approbation (super admin uniquement) : cree l'ecole, nomme le directeur,
--    rattache son profil, marque la demande approuvee.
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

-- 4) Refus (super admin uniquement)
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
