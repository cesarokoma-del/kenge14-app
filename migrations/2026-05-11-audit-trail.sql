-- ============================================================
-- KENGE 14 — Phase 5 : Audit Trail automatique via triggers
-- Date : 11/05/2026
-- Auteur : Cesar Okoma
-- ============================================================

-- 1. Table audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              BIGSERIAL PRIMARY KEY,
  table_name      TEXT        NOT NULL,
  operation       TEXT        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id       TEXT,
  user_id         UUID        REFERENCES public.profils(id) ON DELETE SET NULL,
  user_role       TEXT,
  user_email      TEXT,
  old_data        JSONB,
  new_data        JSONB,
  changed_fields  TEXT[],
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_audit_log_table   ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date    ON public.audit_log(cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record  ON public.audit_log(table_name, record_id);

-- 3. RLS : seuls les bailleurs peuvent lire l'audit
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_bailleurs ON public.audit_log;
CREATE POLICY audit_log_select_bailleurs ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'bailleur');

-- Pas de policy INSERT/UPDATE/DELETE : seuls les triggers SECURITY DEFINER écrivent,
-- personne ne peut modifier ou supprimer l'historique d'audit.

-- 4. Fonction trigger générique (réutilisable sur toutes les tables)
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_user_role      TEXT;
  v_user_email     TEXT;
  v_record_id      TEXT;
  v_changed_fields TEXT[];
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT role, email INTO v_user_role, v_user_email
    FROM public.profils
    WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_record_id := (OLD.id)::TEXT;
  ELSE
    v_record_id := (NEW.id)::TEXT;
  END IF;

  -- Pour UPDATE : liste des colonnes effectivement modifiées
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key) INTO v_changed_fields
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value;
  END IF;

  INSERT INTO public.audit_log (
    table_name, operation, record_id,
    user_id, user_role, user_email,
    old_data, new_data, changed_fields
  ) VALUES (
    TG_TABLE_NAME, TG_OP, v_record_id,
    v_user_id, v_user_role, v_user_email,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Triggers sur les 7 tables sensibles
DROP TRIGGER IF EXISTS audit_paiements          ON public.paiements;
DROP TRIGGER IF EXISTS audit_depenses           ON public.depenses;
DROP TRIGGER IF EXISTS audit_demandes_location  ON public.demandes_location;
DROP TRIGGER IF EXISTS audit_contrats           ON public.contrats;
DROP TRIGGER IF EXISTS audit_locataires         ON public.locataires;
DROP TRIGGER IF EXISTS audit_renouvellements    ON public.renouvellements;
DROP TRIGGER IF EXISTS audit_parametres         ON public.parametres;

CREATE TRIGGER audit_paiements
  AFTER INSERT OR UPDATE OR DELETE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_depenses
  AFTER INSERT OR UPDATE OR DELETE ON public.depenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_demandes_location
  AFTER INSERT OR UPDATE OR DELETE ON public.demandes_location
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_contrats
  AFTER INSERT OR UPDATE OR DELETE ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_locataires
  AFTER INSERT OR UPDATE OR DELETE ON public.locataires
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_renouvellements
  AFTER INSERT OR UPDATE OR DELETE ON public.renouvellements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_parametres
  AFTER INSERT OR UPDATE OR DELETE ON public.parametres
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();