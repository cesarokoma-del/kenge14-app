-- ============================================================================
-- Migration : Épargne enfants — 2 comptes de réserve (Benaiah, Bryan)
-- Date      : 2026-10-03
-- Branche   : main
-- Contexte  : Bloc M — Épargne enfants, étape M-1 (schéma)
-- Auteur    : Cesar Okoma
-- ============================================================================
--
-- OBJECTIF
-- ----------------------------------------------------------------------------
-- Deux comptes d'épargne FIXES, un par enfant, alimentés depuis le Solde net.
-- Ce sont de VRAIS comptes bancaires séparés : un dépôt fait sortir l'argent
-- de la banque principale (le Solde brut baisse), le solde du compte monte.
--
-- MOUVEMENTS (table mouvements_epargne.type)
-- ----------------------------------------------------------------------------
--   depot            : banque principale  → compte enfant
--   retrait_retour   : compte enfant      → banque principale
--   retrait_depense  : compte enfant      → sortie du système (dépense réelle).
--                      Le code applicatif crée aussi une ligne dans `depenses`
--                      avec compte_epargne_id renseigné, pour que les rapports
--                      de dépenses restent complets. calculerSoldeBancaire()
--                      ne déduit PAS ces dépenses de la banque principale
--                      (l'argent en est déjà sorti au moment du dépôt).
--
-- RÈGLES
-- ----------------------------------------------------------------------------
--   - Devise : USD uniquement.
--   - Bailleur seul (lecture + écriture). Le gérant ne voit rien.
--   - Pas de DELETE : la traçabilité prime. Une erreur se corrige par un
--     mouvement inverse.
--   - Fermeture : statut = 'ferme' + date_fermeture, uniquement à solde 0
--     (contrôle applicatif ; conservé en base pour l'historique).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Table comptes_epargne
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comptes_epargne (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT        NOT NULL UNIQUE,
  description     TEXT,
  statut          TEXT        NOT NULL DEFAULT 'ouvert'
                              CHECK (statut IN ('ouvert', 'ferme')),
  date_ouverture  DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_fermeture  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.comptes_epargne IS
  'Épargne enfants : 2 comptes fixes (Benaiah, Bryan). Vrais comptes séparés, USD.';


-- ----------------------------------------------------------------------------
-- 2. Table mouvements_epargne
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mouvements_epargne (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_id       UUID        NOT NULL REFERENCES public.comptes_epargne(id),
  type            TEXT        NOT NULL
                              CHECK (type IN ('depot', 'retrait_retour', 'retrait_depense')),
  montant         NUMERIC(12,2) NOT NULL CHECK (montant > 0),
  date_mouvement  DATE        NOT NULL DEFAULT CURRENT_DATE,
  motif           TEXT,
  enregistre_par  UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mouvements_epargne_compte_date
  ON public.mouvements_epargne (compte_id, date_mouvement DESC);

COMMENT ON TABLE public.mouvements_epargne IS
  'Mouvements des comptes épargne enfants. Jamais supprimés (traçabilité).';


-- ----------------------------------------------------------------------------
-- 3. Lien depenses → compte épargne (pour les retraits de type dépense)
-- ----------------------------------------------------------------------------
-- NULL = dépense payée depuis la banque principale (comportement actuel).
-- Renseigné = dépense payée depuis un compte enfant : à EXCLURE du calcul du
-- Solde brut dans calculerSoldeBancaire().
ALTER TABLE public.depenses
  ADD COLUMN IF NOT EXISTS compte_epargne_id UUID
  REFERENCES public.comptes_epargne(id);

COMMENT ON COLUMN public.depenses.compte_epargne_id IS
  'Si renseigné, la dépense a été payée depuis ce compte épargne (ne pas déduire de la banque principale).';


-- ----------------------------------------------------------------------------
-- 4. Les 2 comptes fixes
-- ----------------------------------------------------------------------------
INSERT INTO public.comptes_epargne (nom, description)
VALUES
  ('Benaiah', 'Épargne pour Benaiah — disponible à tout moment'),
  ('Bryan',   'Épargne pour Bryan — disponible à tout moment')
ON CONFLICT (nom) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 5. RLS — bailleur seul
-- ----------------------------------------------------------------------------
ALTER TABLE public.comptes_epargne   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_epargne ENABLE ROW LEVEL SECURITY;

-- comptes_epargne : lecture + mise à jour (fermeture / description). Pas d'insert
-- (les 2 comptes sont fixes), pas de delete.
CREATE POLICY "Bailleur lit les comptes epargne"
ON public.comptes_epargne FOR SELECT TO authenticated
USING (public.get_my_role() = 'bailleur');

CREATE POLICY "Bailleur modifie les comptes epargne"
ON public.comptes_epargne FOR UPDATE TO authenticated
USING (public.get_my_role() = 'bailleur')
WITH CHECK (public.get_my_role() = 'bailleur');

-- mouvements_epargne : lecture + insertion. Pas d'update, pas de delete.
CREATE POLICY "Bailleur lit les mouvements epargne"
ON public.mouvements_epargne FOR SELECT TO authenticated
USING (public.get_my_role() = 'bailleur');

CREATE POLICY "Bailleur enregistre des mouvements epargne"
ON public.mouvements_epargne FOR INSERT TO authenticated
WITH CHECK (public.get_my_role() = 'bailleur');


-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================
-- En tant que bailleur :
--
--   SELECT nom, statut, date_ouverture FROM comptes_epargne ORDER BY nom;
--   → 2 lignes : Benaiah, Bryan, statut 'ouvert'
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'depenses' AND column_name = 'compte_epargne_id';
--   → 1 ligne
--
-- Rollback :
--
--   DROP POLICY "Bailleur enregistre des mouvements epargne" ON public.mouvements_epargne;
--   DROP POLICY "Bailleur lit les mouvements epargne"        ON public.mouvements_epargne;
--   DROP POLICY "Bailleur modifie les comptes epargne"       ON public.comptes_epargne;
--   DROP POLICY "Bailleur lit les comptes epargne"           ON public.comptes_epargne;
--   ALTER TABLE public.depenses DROP COLUMN compte_epargne_id;
--   DROP TABLE public.mouvements_epargne;
--   DROP TABLE public.comptes_epargne;
-- ============================================================================
