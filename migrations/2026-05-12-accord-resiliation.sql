-- Migration: Ajouter les colonnes pour l'accord de résiliation amiable
-- Date: 2026-05-12
-- Description: Workflow signatures électroniques pour l'accord de résiliation amiable
--              Bailleur signe d'abord (depuis paramètres) → lien WhatsApp → locataire signe → PDF final signé
-- Exécutée en BDD: 2026-05-12 via Supabase SQL Editor

-- =====================================================================
-- ARTICLE 4 : État des lieux de sortie (date + heure du RDV)
-- =====================================================================

-- 1. Date du rendez-vous d'état des lieux de sortie
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS date_etat_lieux_sortie DATE;

-- 2. Heure du rendez-vous (format HH:MM, ex: '10:00')
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS heure_etat_lieux_sortie VARCHAR(5);

-- =====================================================================
-- WORKFLOW SIGNATURES DE L'ACCORD DE RÉSILIATION
-- =====================================================================

-- 3. Signature locataire pour l'accord de résiliation (PNG base64)
--    NB: Pas de colonne signature_resiliation_bailleur car on réutilise
--    celle des paramètres (parametres.valeur où cle='signature_bailleur')
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS signature_resiliation_locataire TEXT;

-- 4. Date de signature bailleur de l'accord (timestamp avec timezone)
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS date_signature_resiliation_bailleur TIMESTAMPTZ;

-- 5. Date de signature locataire de l'accord (timestamp avec timezone)
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS date_signature_resiliation_locataire TIMESTAMPTZ;

-- 6. Token/lien unique pour la page publique de signature locataire
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS lien_signature_resiliation TEXT UNIQUE;

-- 7. Statut du workflow de signature de l'accord
--    Valeurs possibles :
--      NULL                -> accord pas encore initié
--      'brouillon'         -> bailleur en train de préparer
--      'signe_bailleur'    -> bailleur a signé, lien généré, en attente locataire
--      'signe_complet'     -> les 2 parties ont signé
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS statut_signature_resiliation VARCHAR(30);

-- =====================================================================
-- Vérification: les 7 colonnes doivent apparaître
-- =====================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contrats'
  AND (column_name LIKE '%resiliation%' 
       OR column_name LIKE '%etat_lieux%')
ORDER BY column_name;