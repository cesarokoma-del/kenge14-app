-- ============================================================================
-- Migration : Storage policies pour bucket inventaire-photos
-- Date      : 2026-05-14
-- Mission   : Inventaire Dépôt — Bloc D (storage setup)
-- ============================================================================
--
-- Contexte :
--   Le bucket `inventaire-photos` est créé public (lecture libre via URL).
--   Les opérations d'écriture (upload/modif/suppression) sont réservées
--   au bailleur uniquement, conformément au modèle d'accès :
--     - Bailleur : crée items + entrées + photos
--     - Gérant   : enregistre uniquement des sorties (motif + appt), pas de photo
--
-- À exécuter APRÈS création du bucket dans le Dashboard
-- (Storage → New bucket : inventaire-photos, public, 5 MB, image/*)
-- ============================================================================

-- Policy INSERT — seul le bailleur peut uploader
CREATE POLICY "inventaire_photos_insert_bailleur"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inventaire-photos'
  AND EXISTS (
    SELECT 1 FROM public.profils
    WHERE id = auth.uid()
      AND role = 'bailleur'
      AND actif = true
  )
);

-- Policy UPDATE — seul le bailleur peut modifier
CREATE POLICY "inventaire_photos_update_bailleur"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inventaire-photos'
  AND EXISTS (
    SELECT 1 FROM public.profils
    WHERE id = auth.uid()
      AND role = 'bailleur'
      AND actif = true
  )
);

-- Policy DELETE — seul le bailleur peut supprimer
CREATE POLICY "inventaire_photos_delete_bailleur"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'inventaire-photos'
  AND EXISTS (
    SELECT 1 FROM public.profils
    WHERE id = auth.uid()
      AND role = 'bailleur'
      AND actif = true
  )
);

-- ============================================================================
-- Vérification (doit retourner 3 lignes)
-- ============================================================================
-- SELECT policyname FROM pg_policies
-- WHERE policyname LIKE 'inventaire_photos%'
-- ORDER BY policyname;