-- ============================================================
-- Mot de passe par defaut des comptes crees par le directeur.
-- (Mot de passe d'onboarding, a changer par l'utilisateur apres
--  sa premiere connexion via Parametres.)
-- Idempotent.
-- ============================================================

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS default_member_password text;
