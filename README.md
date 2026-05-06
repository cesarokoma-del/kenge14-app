# 🏢 KENGE14 - Gestion Locative Professionnelle

Application web moderne pour la gestion de propriétés locatives au Congo.

## ✨ Fonctionnalités

### ✅ Gestion Complète
- 📊 **Dashboard** avec statistiques en temps réel
- 🏢 **Gestion des appartements** (5 unités KENGE 14)
- 👥 **Suivi des locataires**
- 💰 **Paiements et revenus**
- 📉 **Dépenses et charges**
- 📄 **Contrats de bail**

### 🔄 Système de Renouvellement Automatique
- Alertes 90 jours avant échéance
- Génération de liens de signature uniques
- **Signature électronique sur mobile**
- Stockage sécurisé en base de données
- Suivi des statuts (En attente / Signé)

---

## 🚀 Installation Rapide

```bash
# Cloner le projet
git clone https://github.com/cesarokoma-del/kenge14-app.git
cd kenge14-app

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env.local
# Éditez .env.local avec vos clés Supabase

# Lancer en développement
npm run dev
```

Ouvrez http://localhost:3000

---

## 📦 Configuration Supabase

### 1. Créer un projet
- Allez sur https://supabase.com
- Créez un projet "kenge14"

### 2. Exécuter le schéma SQL
- SQL Editor → New Query
- Copiez le contenu de `supabase-schema.sql`
- Run

### 3. Récupérer les clés
- Settings → API
- Copiez Project URL et anon key
- Mettez-les dans `.env.local`

---

## 🎯 Utilisation - Renouvellements

1. **Onglet Renouvellements** → Voir contrats à échéance
2. **Cliquer** "Envoyer proposition"
3. **Lien copié** → Envoyer sur WhatsApp
4. **Locataire signe** depuis son téléphone
5. **Statut mis à jour** automatiquement

---

## 📞 Contact

Cesar OKOMA - KENGE 14, Kinshasa 🇨🇩
