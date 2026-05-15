-- ============================================================
-- Migration 2026-05-14 : Inventaire du dépôt KENGE 14
--
-- Permet au bailleur de gérer un catalogue d'items (outils,
-- consommables, biens d'appartement) avec traçabilité des entrées
-- (achats par le bailleur) et des sorties (utilisations par le
-- gérant, justifiées par motif + appartement concerné).
-- ============================================================

-- ============================================================
-- 1. Table catalogue : inventaire_items
-- ============================================================
CREATE TABLE public.inventaire_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  nom TEXT NOT NULL,
  description TEXT,

  -- Catégorisation
  categorie TEXT NOT NULL CHECK (
    categorie IN ('outil', 'consommable', 'bien_appartement', 'autre')
  ),
  unite TEXT NOT NULL DEFAULT 'pièce',
  -- Exemples d'unité : 'pièce', 'sac', 'mètre', 'litre', 'kg', 'boîte'

  -- Stock initial (au moment où l'item est créé dans le catalogue)
  -- Les entrées/sorties ultérieures sont gérées via inventaire_mouvements
  quantite_initiale NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- Métadonnées optionnelles
  prix_unitaire_usd NUMERIC(10, 2),
  seuil_alerte NUMERIC(10, 2), -- alerter si stock <= seuil
  photo_url TEXT,

  -- État
  actif BOOLEAN NOT NULL DEFAULT true,
  -- Permet de masquer un item sans casser l'historique

  -- Audit
  cree_par UUID NOT NULL REFERENCES public.profils(id),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventaire_items IS 'Catalogue des items du dépôt (outils, consommables, biens)';
COMMENT ON COLUMN public.inventaire_items.quantite_initiale IS 'Stock initial. Les changements ultérieurs passent par inventaire_mouvements';
COMMENT ON COLUMN public.inventaire_items.seuil_alerte IS 'Alerte si stock actuel <= seuil_alerte';

-- Index pour recherche
CREATE INDEX idx_inventaire_items_categorie ON public.inventaire_items(categorie);
CREATE INDEX idx_inventaire_items_actif ON public.inventaire_items(actif);


-- ============================================================
-- 2. Table mouvements : entrées et sorties
-- ============================================================
CREATE TABLE public.inventaire_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventaire_items(id) ON DELETE CASCADE,

  -- Type de mouvement
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),

  -- Quantité (toujours positive ; le sens est donné par 'type')
  quantite NUMERIC(10, 2) NOT NULL CHECK (quantite > 0),

  -- Motif obligatoire pour les sorties, libre pour les entrées
  motif TEXT,

  -- Pour les sorties : appartement concerné (optionnel)
  -- Ex: ampoules sorties pour réparation APT-2A
  appartement_id UUID REFERENCES public.appartements(id),

  -- Lien optionnel vers une dépense (Bloc G futur)
  -- Quand une entrée est créée depuis une dépense d'achat
  depense_id UUID REFERENCES public.depenses(id),

  -- Qui a fait le mouvement
  effectue_par UUID NOT NULL REFERENCES public.profils(id),

  -- Notes additionnelles
  notes TEXT,

  -- Audit
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventaire_mouvements IS 'Historique des entrées et sorties pour chaque item';
COMMENT ON COLUMN public.inventaire_mouvements.quantite IS 'Toujours positif. Le sens (+/-) est dans type';

-- Index pour requêtes
CREATE INDEX idx_inventaire_mouvements_item_id ON public.inventaire_mouvements(item_id);
CREATE INDEX idx_inventaire_mouvements_type ON public.inventaire_mouvements(type);
CREATE INDEX idx_inventaire_mouvements_appartement_id ON public.inventaire_mouvements(appartement_id);
CREATE INDEX idx_inventaire_mouvements_effectue_par ON public.inventaire_mouvements(effectue_par);
CREATE INDEX idx_inventaire_mouvements_cree_le ON public.inventaire_mouvements(cree_le);


-- ============================================================
-- 3. Vue calculée : stock actuel par item
-- ============================================================
CREATE OR REPLACE VIEW public.inventaire_stock_actuel AS
SELECT
  i.id,
  i.nom,
  i.description,
  i.categorie,
  i.unite,
  i.quantite_initiale,
  i.prix_unitaire_usd,
  i.seuil_alerte,
  i.photo_url,
  i.actif,
  i.cree_par,
  i.cree_le,
  i.modifie_le,
  -- Calcul du stock actuel
  i.quantite_initiale
    + COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0)
    AS stock_actuel,
  -- Stats par item
  COUNT(CASE WHEN m.type = 'entree' THEN 1 END) AS nb_entrees,
  COUNT(CASE WHEN m.type = 'sortie' THEN 1 END) AS nb_sorties,
  MAX(m.cree_le) AS derniere_operation
FROM public.inventaire_items i
LEFT JOIN public.inventaire_mouvements m ON m.item_id = i.id
GROUP BY i.id;

COMMENT ON VIEW public.inventaire_stock_actuel IS 'Vue : items du catalogue avec stock actuel calculé en temps réel';


-- ============================================================
-- 4. Trigger : auto-update modifie_le sur inventaire_items
-- ============================================================
CREATE OR REPLACE FUNCTION public.inventaire_items_touch_modifie_le()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modifie_le = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventaire_items_touch_modifie_le_trigger
  BEFORE UPDATE ON public.inventaire_items
  FOR EACH ROW
  EXECUTE FUNCTION public.inventaire_items_touch_modifie_le();


-- ============================================================
-- 5. RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.inventaire_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaire_mouvements ENABLE ROW LEVEL SECURITY;

-- ─── inventaire_items ────────────────────────────────────────

-- SELECT : bailleur + gérant actif
CREATE POLICY "inventaire_items_select"
  ON public.inventaire_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- INSERT : bailleur uniquement
CREATE POLICY "inventaire_items_insert_bailleur"
  ON public.inventaire_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role = 'bailleur'
    )
  );

-- UPDATE : bailleur uniquement
CREATE POLICY "inventaire_items_update_bailleur"
  ON public.inventaire_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role = 'bailleur'
    )
  );

-- DELETE : bailleur uniquement
CREATE POLICY "inventaire_items_delete_bailleur"
  ON public.inventaire_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role = 'bailleur'
    )
  );

-- ─── inventaire_mouvements ───────────────────────────────────

-- SELECT : bailleur + gérant actif
CREATE POLICY "inventaire_mouvements_select"
  ON public.inventaire_mouvements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role IN ('bailleur', 'gerant')
    )
  );

-- INSERT : bailleur (tout) OU gérant actif (sortie uniquement)
CREATE POLICY "inventaire_mouvements_insert"
  ON public.inventaire_mouvements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profils p
      WHERE p.id = auth.uid()
        AND p.actif = true
        AND (
          p.role = 'bailleur'
          OR (p.role = 'gerant' AND inventaire_mouvements.type = 'sortie')
        )
    )
  );

-- UPDATE : bailleur uniquement (les mouvements sont immutables pour le gérant)
CREATE POLICY "inventaire_mouvements_update_bailleur"
  ON public.inventaire_mouvements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role = 'bailleur'
    )
  );

-- DELETE : bailleur uniquement (correction d'erreurs)
CREATE POLICY "inventaire_mouvements_delete_bailleur"
  ON public.inventaire_mouvements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid()
        AND actif = true
        AND role = 'bailleur'
    )
  );


-- ============================================================
-- 6. Fin de migration
-- ============================================================
-- Pour vérifier après exécution, lance ces requêtes :
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name LIKE 'inventaire%'
-- ORDER BY table_name, ordinal_position;
--
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename LIKE 'inventaire%'
-- ORDER BY tablename, cmd;