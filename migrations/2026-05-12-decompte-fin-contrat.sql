-- ============================================================
-- KENGE 14 — Mission "Décompte Fin de Contrat"
-- Date : 12/05/2026
-- Auteur : Cesar Okoma
--
-- Ajoute les champs nécessaires pour le décompte de fin
-- de contrat : calcul du reliquat de garantie + PDF officiel.
--
-- Logique métier (DRC) :
--   reliquat = garantie - loyers_impayes - degats + surplus_credit
--
--   - loyers_impayes : calculé auto depuis paiements, avec prorata du
--     mois en cours (loyer ÷ 30 × jours consommés, jour de fin exclu)
--   - degats : saisi manuellement dans la modale Terminer
--   - surplus_credit : si locataire a payé d avance, crédité au reliquat
--
--   Résultat : positif = bailleur restitue, négatif = locataire doit
-- ============================================================

ALTER TABLE public.contrats
  ADD COLUMN IF NOT EXISTS degats_constates        NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyers_impayes_calcule  NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surplus_credit_calcule  NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliquat_garantie       NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS notes_fin               TEXT,
  ADD COLUMN IF NOT EXISTS decompte_genere_le      TIMESTAMPTZ;

-- Commentaires pour documentation (lisible dans Supabase Studio)
COMMENT ON COLUMN public.contrats.degats_constates       IS 'Montant USD des dégâts constatés à l état des lieux de sortie';
COMMENT ON COLUMN public.contrats.loyers_impayes_calcule IS 'Snapshot USD des loyers impayés au moment de la clôture (avec prorata)';
COMMENT ON COLUMN public.contrats.surplus_credit_calcule IS 'Snapshot USD du surplus payé par le locataire (paiements au-delà de la fin)';
COMMENT ON COLUMN public.contrats.reliquat_garantie      IS 'Résultat final USD : positif = à restituer, négatif = à recouvrer';
COMMENT ON COLUMN public.contrats.notes_fin              IS 'Notes libres du bailleur sur la fin de contrat';
COMMENT ON COLUMN public.contrats.decompte_genere_le     IS 'Timestamp de génération du PDF officiel (NULL = pas encore généré)';