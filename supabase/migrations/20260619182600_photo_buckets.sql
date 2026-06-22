-- ============================================================
-- Buckets de stockage + politiques (idempotent)
--   school-logos   : PUBLIC  (logos d'ecole)
--   student-photos : PRIVE   (photos eleves, URLs signees)
--   staff-photos   : PRIVE   (photos personnel, URLs signees)
-- Chemin attendu des fichiers : {school_id}/{...}
-- ============================================================

-- 1) Creation des buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('school-logos',   'school-logos',   true),
  ('student-photos', 'student-photos', false),
  ('staff-photos',   'staff-photos',   false)
ON CONFLICT (id) DO NOTHING;

-- 2) Politiques student-photos  (lecture: membres de l'ecole ; ecriture: directeur)
DROP POLICY IF EXISTS "student_photos_read" ON storage.objects;
CREATE POLICY "student_photos_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'student-photos' AND public.is_school_member((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "student_photos_insert" ON storage.objects;
CREATE POLICY "student_photos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-photos' AND public.is_school_admin((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "student_photos_update" ON storage.objects;
CREATE POLICY "student_photos_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'student-photos' AND public.is_school_admin((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "student_photos_delete" ON storage.objects;
CREATE POLICY "student_photos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'student-photos' AND public.is_school_admin((storage.foldername(name))[1]::uuid));

-- 3) Politiques staff-photos  (lecture: membres de l'ecole ; ecriture: directeur)
DROP POLICY IF EXISTS "staff_photos_read" ON storage.objects;
CREATE POLICY "staff_photos_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'staff-photos' AND public.is_school_member((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "staff_photos_insert" ON storage.objects;
CREATE POLICY "staff_photos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'staff-photos' AND public.is_school_admin((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "staff_photos_update" ON storage.objects;
CREATE POLICY "staff_photos_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'staff-photos' AND public.is_school_admin((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "staff_photos_delete" ON storage.objects;
CREATE POLICY "staff_photos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'staff-photos' AND public.is_school_admin((storage.foldername(name))[1]::uuid));
