-- ============================================================================
-- Migration : Multi-devises USD/CDF pour les dépenses
-- Date      : 2026-05-15
-- Mission   : Inventaire Dépôt — Bloc G (multi-devises)
-- ============================================================================
--
-- Contexte :
--   Le gérant Prefina reçoit l'approvisionnement en USD, mais dépense parfois
--   en CDF (Francs Congolais) - notamment pour les transports.
--   Approche choisie : conserver `montant` en USD partout (cohérence rapports),
--   et stocker la devise d'origine + taux figé à la transaction pour la
--   traçabilité comptable.
--
-- Architecture :
--   - devise              : USD ou CDF (default USD)
--   - montant_devise_origine : montant saisi par l'utilisateur en CDF
--     (NULL si devise=USD)
--   - taux_change         : CDF par 1 USD au moment de la saisie
--     (NULL si devise=USD)
--   - montant (existant)  : reste toujours en USD - calculé si CDF
--
-- Choix : taux saisi à chaque transaction (champ libre), pas de paramètre
-- global pour rester flexible face aux fluctuations marché vs taux officiel.
-- ============================================================================

ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS devise TEXT NOT NULL DEFAULT 'USD'
    CHECK (devise IN ('USD', 'CDF')),
  ADD COLUMN IF NOT EXISTS montant_devise_origine NUMERIC,
  ADD COLUMN IF NOT EXISTS taux_change NUMERIC;