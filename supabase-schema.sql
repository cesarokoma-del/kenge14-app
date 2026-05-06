-- KENGE14 Database Schema
-- À exécuter dans Supabase SQL Editor

-- Table: Appartements
CREATE TABLE appartements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom VARCHAR(50) UNIQUE NOT NULL,
  chambres INTEGER NOT NULL,
  salons INTEGER NOT NULL,
  salles_bain INTEGER NOT NULL,
  autres_elements TEXT,
  loyer_base DECIMAL(10,2) NOT NULL,
  statut VARCHAR(20) DEFAULT 'vacant',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: Locataires
CREATE TABLE locataires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  noms_complet VARCHAR(255) NOT NULL,
  adresse TEXT,
  telephone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: Contrats
CREATE TABLE contrats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appartement_id UUID REFERENCES appartements(id) ON DELETE CASCADE,
  locataire_id UUID REFERENCES locataires(id) ON DELETE CASCADE,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  duree_mois INTEGER NOT NULL,
  loyer DECIMAL(10,2) NOT NULL,
  garantie DECIMAL(10,2) NOT NULL,
  occupants INTEGER NOT NULL,
  clauses_speciales TEXT,
  statut VARCHAR(20) DEFAULT 'actif',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: Paiements
CREATE TABLE paiements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrat_id UUID REFERENCES contrats(id) ON DELETE CASCADE,
  montant DECIMAL(10,2) NOT NULL,
  date_paiement DATE NOT NULL,
  mois_concerne VARCHAR(20) NOT NULL,
  methode VARCHAR(50) DEFAULT 'depot_bancaire',
  bordereau_url TEXT,
  statut VARCHAR(20) DEFAULT 'recu',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: Dépenses
CREATE TABLE depenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appartement_id UUID REFERENCES appartements(id) ON DELETE SET NULL,
  categorie VARCHAR(100) NOT NULL,
  montant DECIMAL(10,2) NOT NULL,
  date_depense DATE NOT NULL,
  description TEXT,
  facture_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: Renouvellements
CREATE TABLE renouvellements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrat_id UUID REFERENCES contrats(id) ON DELETE CASCADE,
  lien_signature VARCHAR(500) UNIQUE NOT NULL,
  date_demande TIMESTAMP DEFAULT NOW(),
  statut VARCHAR(20) DEFAULT 'en_attente',
  date_signature TIMESTAMP,
  signature_data TEXT,
  nom_signataire VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX idx_contrats_appartement ON contrats(appartement_id);
CREATE INDEX idx_contrats_locataire ON contrats(locataire_id);
CREATE INDEX idx_contrats_dates ON contrats(date_debut, date_fin);
CREATE INDEX idx_paiements_contrat ON paiements(contrat_id);
CREATE INDEX idx_renouvellements_lien ON renouvellements(lien_signature);

-- Données initiales: Appartements KENGE 14
INSERT INTO appartements (nom, chambres, salons, salles_bain, autres_elements, loyer_base, statut) VALUES
('APT-3RZ', 3, 1, 2, 'une salle à manger, une cuisine, un magasin', 400.00, 'loue'),
('APT-1CAV', 1, 1, 0, 'une cuisine, douche-toilette externe', 150.00, 'loue'),
('APT-2A', 2, 1, 2, 'une cuisine', 300.00, 'loue'),
('APT-2B', 2, 1, 2, 'une cuisine', 300.00, 'loue'),
('APT-1ER', 0, 1, 0, 'Studio + douche-toilette externe', 100.00, 'vacant');

-- Row Level Security (RLS)
ALTER TABLE appartements ENABLE ROW LEVEL SECURITY;
ALTER TABLE locataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE renouvellements ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (à ajuster selon vos besoins d'authentification)
-- Pour l'instant: accès public en lecture/écriture pour développement
CREATE POLICY "Enable read access for all users" ON appartements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON appartements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON appartements FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON locataires FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON locataires FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON contrats FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON contrats FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON contrats FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON paiements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON paiements FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON depenses FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON depenses FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON renouvellements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON renouvellements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON renouvellements FOR UPDATE USING (true);
