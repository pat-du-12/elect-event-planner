-- Dossier privé des pièces jointes et visuels d'IRD
INSERT INTO storage.buckets (id, name, public)
VALUES ('ird-attachments', 'ird-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "IRD admins gerent fichiers" ON storage.objects;
CREATE POLICY "IRD admins gerent fichiers" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ird-attachments' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'ird-attachments' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "IRD connectes lisent fichiers" ON storage.objects;
CREATE POLICY "IRD connectes lisent fichiers" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ird-attachments');
