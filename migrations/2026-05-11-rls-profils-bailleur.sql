-- ============================================================================
-- Migration : RLS profils — Bailleurs peuvent lire tous les profils
-- Date      : 2026-05-11
-- Branche   : feat/role-gerant
-- Contexte  : Mission "Espace Gérant" — Session B (debug filtre dépenses)
-- Auteur    : Cesar Okoma
-- ============================================================================
--
-- PROBLÈME RÉSOLU
-- ----------------------------------------------------------------------------
-- Sur la page /depenses (vue bailleur), la requête suivante retournait []
-- (tableau vide) à cause de la RLS par défaut sur la table `profils` :
--
--   SELECT id FROM profils WHERE role = 'gerant'
--
-- Conséquence : `idsGerants = []` → le filtre dans pages/depenses.js
--   .filter(d => !idsGerants.includes(d.enregistre_par))
-- laissait passer TOUTES les dépenses (y compris celles enregistrées par les
-- gérants), affichant 62 USD au lieu des 52 USD attendus côté bailleur.
--
-- SOLUTION
-- ----------------------------------------------------------------------------
-- 1. Créer une fonction `public.get_my_role()` en SECURITY DEFINER
--    (contourne la RLS sans créer de récursion).
-- 2. Ajouter une policy SELECT sur `profils` qui autorise tout utilisateur
--    authentifié dont le rôle est 'bailleur' à lire l'ensemble de la table.
--
-- ARCHITECTURE COMPTE GÉRANT — pourquoi cette policy est nécessaire
-- ----------------------------------------------------------------------------
-- Le bailleur doit pouvoir :
--   - Lister les gérants pour exclure leurs dépenses de la vue /depenses
--   - Calculer le solde du compte gérant (Σ approvisionnements − Σ dépenses)
--   - Visualiser quel gérant a enregistré quel mouvement
--
-- Le gérant, lui, conserve l'accès à son propre profil via les policies
-- existantes (auth.uid() = id), ce qui permet à RouteGuard de fonctionner
-- normalement côté /gerant/*.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Fonction helper SECURITY DEFINER
-- ----------------------------------------------------------------------------
-- Retourne le rôle de l'utilisateur authentifié courant.
-- SECURITY DEFINER : exécutée avec les droits du propriétaire de la fonction
-- (typiquement postgres), donc IGNORE la RLS de la table profils.
-- STABLE         : pas d'écriture, résultat cohérent dans une même requête.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.profils
  WHERE id = auth.uid()
    AND actif = true;
$$;


-- ----------------------------------------------------------------------------
-- 2. Policy : Bailleurs peuvent lire tous les profils
-- ----------------------------------------------------------------------------
-- Cible : table public.profils
-- Action : SELECT uniquement
-- Cible roles : authenticated (utilisateurs Supabase Auth connectés)
-- Condition USING : l'utilisateur courant doit avoir le rôle 'bailleur'
--                   ET être actif (vérifié dans get_my_role()).
--
-- Note : ne PAS ajouter de policy équivalente INSERT/UPDATE/DELETE ici.
--        La création/modification de profils reste réservée aux opérations
--        admin via Supabase Dashboard ou service_role.
-- ----------------------------------------------------------------------------

CREATE POLICY "Bailleurs lisent tous les profils"
ON public.profils
FOR SELECT
TO authenticated
USING (
  public.get_my_role() = 'bailleur'
);


-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================
-- Pour vérifier que tout fonctionne, exécuter en tant que bailleur :
--
--   SELECT id, role FROM profils WHERE role = 'gerant';
--
-- Doit retourner au moins 1 ligne (le gérant test).
--
-- Pour rollback :
--
--   DROP POLICY "Bailleurs lisent tous les profils" ON public.profils;
--   DROP FUNCTION public.get_my_role();
--
-- ============================================================================