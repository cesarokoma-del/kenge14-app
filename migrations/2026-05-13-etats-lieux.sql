-- ============================================================
-- Migration 2026-05-13 : États des lieux (entrée + sortie)
--
-- Permet au bailleur OU au gérant de saisir un état des lieux
-- contradictoire (1 entrée + 1 sortie maximum par contrat),
-- avec signature locataire + signataire-app + validation bailleur.
-- ============================================================

-- ============================================================
-- 1. Table principale : etats_lieux
-- ============================================================
CREATE TABLE public.etats_lieux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id UUID NOT NULL REFERENCES public.contrats(id) ON DELETE CASCADE,

  -- Type d'état : entrée (au début du bail) ou sortie (à la fin)
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),

  -- Date à laquelle l'état des lieux a physiquement été dressé
  date_realisation DATE NOT NULL,

  -- Qui a fait l'état (bailleur ou gérant)
  realise_par UUID NOT NULL REFERENCES public.profils(id),

  -- Workflow :
  --   'brouillon'         = en cours de saisie, pas encore signé
  --   'signe_locataire'   = locataire + signataire ont signé, en attente bailleur
  --   'valide_bailleur'   = bailleur a validé, état définitif
  statut TEXT NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'signe_locataire', 'valide_bailleur')),

  -- Signatures électroniques (PNG base64)
  signature_realisateur TEXT,
  signature_locataire TEXT,

  -- Timestamps de signature
  date_signature_realisateur TIMESTAMPTZ,
  date_signature_locataire TIMESTAMPTZ,

  -- Validation finale par le bailleur
  date_validation_bailleur TIMESTAMPTZ,
  valide_par UUID REFERENCES public.profils(id),

  -- Remarques générales (libres, en plus des remarques par pièce)
  remarques_generales TEXT,

  -- Audit timestamps
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Règle métier : 1 entrée + 1 sortie max par contrat
  UNIQUE (contrat_id, type)
);

COMMENT ON TABLE public.etats_lieux IS 'États des lieux contradictoires (entrée et sortie) signés électroniquement';
COMMENT ON COLUMN public.etats_lieux.realise_par IS 'Bailleur ou gérant qui a saisi l état';
COMMENT ON COLUMN public.etats_lieux.statut IS 'brouillon -> signe_locataire -> valide_bailleur';

-- Index pour performance
CREATE INDEX idx_etats_lieux_contrat_id ON public.etats_lieux(contrat_id);
CREATE INDEX idx_etats_lieux_statut ON public.etats_lieux(statut);


-- ============================================================
-- 2. Table détail : pièces inspectées (1 ligne par pièce)
-- ============================================================
CREATE TABLE public.etats_lieux_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etat_lieux_id UUID NOT NULL REFERENCES public.etats_lieux(id) ON DELETE CASCADE,

  -- Nom de la pièce (Salon, Chambre, Cuisine, Salle de bain, Toilettes)
  nom_piece TEXT NOT NULL,

  -- État de la pièce
  etat TEXT NOT NULL CHECK (etat IN ('bon', 'moyen', 'mauvais')),

  -- Remarque libre (optionnelle)
  remarque TEXT,

  -- URL de la photo dans Supabase Storage (optionnelle)
  photo_url TEXT,

  -- Ordre d'affichage dans le formulaire
  ordre INT NOT NULL DEFAULT 0,

  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_etats_lieux_pieces_etat_lieux_id ON public.etats_lieux_pieces(etat_lieux_id);


-- ============================================================
-- 3. Trigger : mettre à jour modifie_le automatiquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.etats_lieux_touch_modifie_le()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modifie_le = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER etats_lieux_touch_modifie_le_trigger
  BEFORE UPDATE ON public.etats_lieux
  FOR EACH ROW
  EXECUTE FUNCTION public.etats_lieux_touch_modifie_le();


-- ============================================================
-- 4. RLS (Row Level Security) policies
-- ============================================================
ALTER TABLE public.etats_lieux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etats_lieux_pieces ENABLE ROW LEVEL SECURITY;

-- ─── etats_lieux ─────────────────────────────────────────────

-- SELECT : bailleur (tout) + gérant actif (tout)
CREATE POLICY "etats_lieux_select_bailleur_gerant"
  ON public.etats_lieux FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- INSERT : bailleur OR gérant actif
CREATE POLICY "etats_lieux_insert_bailleur_gerant"
  ON public.etats_lieux FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- UPDATE : bailleur (tout) OR gérant actif (seulement brouillon, jamais après signature)
CREATE POLICY "etats_lieux_update_bailleur_gerant"
  ON public.etats_lieux FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profils p
      WHERE p.id = auth.uid()
        AND p.actif = true
        AND (
          p.role = 'bailleur'
          OR (p.role = 'gerant' AND statut = 'brouillon')
        )
    )
  );

-- DELETE : bailleur uniquement (sécurité - le gérant ne peut pas effacer)
CREATE POLICY "etats_lieux_delete_bailleur"
  ON public.etats_lieux FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role = 'bailleur'
    )
  );

-- ─── etats_lieux_pieces ──────────────────────────────────────

-- SELECT : même règle que parent
CREATE POLICY "etats_lieux_pieces_select"
  ON public.etats_lieux_pieces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- INSERT/UPDATE/DELETE : bailleur OR gérant actif si parent en brouillon
CREATE POLICY "etats_lieux_pieces_write"
  ON public.etats_lieux_pieces FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profils p, public.etats_lieux e
      WHERE p.id = auth.uid()
        AND p.actif = true
        AND e.id = etats_lieux_pieces.etat_lieux_id
        AND (
          p.role = 'bailleur'
          OR (p.role = 'gerant' AND e.statut = 'brouillon')
        )
    )
  );


-- ============================================================
-- 5. Vérifications post-installation
-- ============================================================
-- (Lance ces requêtes après pour confirmer)
-- SELECT * FROM public.etats_lieux LIMIT 0;
-- SELECT * FROM public.etats_lieux_pieces LIMIT 0;
-- SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'etats_lieux%';