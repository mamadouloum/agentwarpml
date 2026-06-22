
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
