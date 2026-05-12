-- Migration: Ajouter les colonnes signatures pour le décompte de fin de contrat
-- Date: 2026-05-12
-- Description: Workflow signatures électroniques pour le décompte de fin de contrat
--              Bailleur signe d'abord → token unique → lien WhatsApp → locataire signe → PDF final signé
-- Exécutée en BDD: 2026-05-12 via Supabase SQL Editor

-- 1. Signature bailleur (PNG base64 produit par canvas.toDataURL('image/png'))
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS signature_decompte_bailleur TEXT;

-- 2. Signature locataire (PNG base64 produit par canvas.toDataURL('image/png'))
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS signature_decompte_locataire TEXT;

-- 3. Date de signature bailleur (timestamp avec timezone)
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS date_signature_decompte_bailleur TIMESTAMPTZ;

-- 4. Date de signature locataire (timestamp avec timezone)
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS date_signature_decompte_locataire TIMESTAMPTZ;

-- 5. Token/lien unique pour la page publique de signature locataire
--    Convention: UUID v4 généré côté client, identique à lien_signature_initial pour le bail
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS lien_signature_decompte TEXT UNIQUE;

-- 6. Statut du workflow de signature du décompte
--    Valeurs possibles :
--      NULL              -> décompte pas encore initié
--      'brouillon'       -> calcul fait, modale ouverte, mais pas encore signée
--      'signe_bailleur'  -> bailleur a signé, lien généré, en attente locataire
--      'signe_complet'   -> les 2 parties ont signé
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS statut_signature_decompte VARCHAR(30);

-- =====================================================================
-- Vérification: les 6 colonnes doivent apparaître
-- =====================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contrats'
  AND (column_name LIKE '%signature_decompte%' 
       OR column_name = 'lien_signature_decompte' 
       OR column_name = 'statut_signature_decompte')
ORDER BY column_name;