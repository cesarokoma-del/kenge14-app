-- ============================================================
-- Migration 2026-05-13 : Policies RLS pour le Storage des photos
--                       d'états des lieux
--
-- Bucket concerné : etats-lieux-photos (public)
--   - Lecture : publique (flag "Public" du bucket suffit)
--   - Écriture : bailleur OU gérant actif uniquement
--
-- À exécuter dans Supabase SQL Editor (les buckets et leurs policies
-- vivent dans le schéma storage qui n'est pas modifiable depuis migra-
-- tions Postgres standard).
-- ============================================================

-- INSERT : tout utilisateur authentifié bailleur ou gérant actif
CREATE POLICY "etats_lieux_photos_insert_bailleur_gerant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'etats-lieux-photos'
    AND EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- UPDATE : idem (au cas où on remplace une photo)
CREATE POLICY "etats_lieux_photos_update_bailleur_gerant"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'etats-lieux-photos'
    AND EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- DELETE : bailleur OU gérant actif (suppression possible en brouillon)
CREATE POLICY "etats_lieux_photos_delete_bailleur_gerant"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'etats-lieux-photos'
    AND EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- ============================================================
-- Vérification post-installation
-- ============================================================
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'objects'
--   AND schemaname = 'storage'
--   AND policyname LIKE 'etats_lieux_photos%';