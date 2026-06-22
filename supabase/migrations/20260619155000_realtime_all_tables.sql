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
