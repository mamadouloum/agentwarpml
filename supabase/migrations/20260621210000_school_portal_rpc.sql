-- ============================================================
-- Portail public par ecole (/e/{code}) : lecture minimale sans auth.
-- schools est protege par RLS (aucune lecture anon) -> le portail public
-- ne pouvait pas trouver l'ecole. Cette fonction expose uniquement les
-- champs publics necessaires a la page de connexion par etablissement.
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_school_portal(_code text)
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  logo_url text,
  primary_color text,
  accent_color text,
  secondary_color text,
  motto text,
  brand_logo_url text
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
