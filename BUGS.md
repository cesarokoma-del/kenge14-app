# 📋 KENGE 14 — Journal de bord & suivi des bugs

> **Application** : `kenge14-app`
> **Repo** : [github.com/cesarokoma-del/kenge14-app](https://github.com/cesarokoma-del/kenge14-app)
> **URL prod** : [kenge14-app.vercel.app](https://kenge14-app.vercel.app)
> **Stack** : Next.js 14 · React 18 · Supabase · Vercel · jsPDF
> **Propriétaire** : M. Cesar OKOMA
> **Dernière MAJ** : 7 mai 2026

---

## 🎯 État du projet

✅ **Production stable** — Déployée et utilisable au quotidien
✅ **Signature électronique** — Fonctionnelle pour les renouvellements
✅ **Génération PDF** — 3 systèmes opérationnels
✅ **Multi-appareils** — Compatible desktop et mobile

---

## 🏆 Travaux réalisés — Session du 7 mai 2026

### 🐛 Bugs critiques résolus

#### Bug #1 — URL `localhost:3000` dans les liens de signature
- **Symptôme** : Les liens envoyés aux locataires pointaient vers `http://localhost:3000` au lieu de la prod
- **Cause** : `process.env.NEXT_PUBLIC_BASE_URL` mal configuré dans Vercel (valeur localhost) + fallback non défensif dans `lib/supabase.js`
- **Solution** :
  - Suppression de la variable Vercel `NEXT_PUBLIC_BASE_URL`
  - Modification de `lib/supabase.js` lignes 56 et 74 : fallback vers `window.location.origin` ou URL prod
- **Statut** : ✅ Résolu

#### Bug #2 — Signature React forwardRef
- **Symptôme** : Bouton "Envoi en cours..." figé pendant 8 heures à la signature
- **Console** : `TypeError: Cannot read properties of null (reading 'getSignatureData')`
- **Cause** : `components/SignatureCanvas.js` exposait `getSignatureData` via mutation directe DOM (non standard React). Le parent `pages/signature/[id].js` créait son propre ref qui restait null.
- **Solution** : Refactor complet avec `forwardRef` + `useImperativeHandle`
- **Statut** : ✅ Résolu

#### Bug #3 — Structure JSX (balises mal placées)
- **Symptôme** : Build Vercel échouant avec `Expected corresponding JSX closing tag for <div>`
- **Cause** : Lors de l'ajout du bouton "Télécharger PDF" sur la page Renouvellements, plusieurs `</div>`, `)}` et `</Layout>` ont été mal positionnés
- **Solution** : Réécriture complète du fichier `pages/renouvellements.js` avec structure propre
- **Statut** : ✅ Résolu

#### Bug #4 — Téléchargement PDF bloqué sur Chrome
- **Symptôme** : Le bouton 📥 ne déclenchait pas de téléchargement sur Chrome (pas de fichier dans `Téléchargements`)
- **Cause probable** : Comportement spécifique de Chrome avec les fichiers générés en JavaScript (jsPDF) — possiblement extension/cache
- **Solution** : Utiliser **Edge** pour les téléchargements (alternative simple). Bug à investiguer côté Chrome plus tard.
- **Statut** : 🟡 Contournement — fonctionne sur Edge

---

### ✨ Fonctionnalités ajoutées

#### Phase 1 — Génération PDF côté locataire
- **Fichier créé** : `lib/genererContratPDF.js`
- **Fonction** : `genererContratRenouvellementPDF(renouvellement)`
- **Pages** : 2 pages avec en-tête vert KENGE 14
- **Articles** : 9 articles conformes au contrat officiel (Equity-BCDC, WhatsApp, indemnité 5 USD, etc.)
- **Encodage** : Tous les accents français parfaitement affichés (`République`, `Démocratique`, `Modalités`, etc.)
- **Bouton ajouté** : Sur la page de succès de signature → "📥 Télécharger mon contrat PDF"
- **Statut** : ✅ Déployé et testé

#### Phase 2 — Génération PDF côté propriétaire (Renouvellements)
- **Fichier modifié** : `pages/renouvellements.js`
- **Fonction ajoutée** : `telechargerContratPDF(contrat)`
- **Bouton ajouté** : Bouton bleu "📥 Télécharger PDF" sur les renouvellements signés
- **Comportement conditionnel** : Apparaît uniquement si `statut === 'signe'`
- **Statut** : ✅ Déployé

#### Phase 3 — Bouton avenant sur page Contrats
- **Fichier modifié** : `pages/contrats.js`
- **Fonction ajoutée** : `telechargerAvenantPDF(contrat)` (requête Supabase pour récupérer le dernier renouvellement signé)
- **Bouton ajouté** : Icône 📥 discrète bleue dans la barre d'actions de chaque contrat
- **Statut** : ✅ Déployé

#### Phase 4 — Génération PDF du contrat de bail INITIAL complet
- **Fichier créé** : `lib/genererContratInitialPDF.js`
- **Fonction** : `genererContratInitialPDF(contrat)`
- **Pages** : 5 pages
  - Page 1 : En-tête + soussignés + articles 1-4
  - Page 2 : Articles 5-13 (modalités paiement, garantie, durée, résiliation, etc.)
  - Page 3 : Section signatures (Bailleur + Preneur, sans témoin)
  - Page 4 : Annexe État des lieux contradictoire (18 pièces)
- **Comportement** : Fonctionne avec contrat **rempli** OU **vierge** (champs vides remplacés par `_______`)
- **Bouton ajouté** : Icône 📜 verte sur chaque carte de contrat
- **Statut** : ✅ Déployé

#### Phase 5 — Description personnalisable par appartement
- **Migration SQL** : Nouvelle colonne `description_complete TEXT` dans la table `appartements`
- **Fichier modifié** : `pages/appartements.js`
  - Champ `formData` étendu
  - Fonctions `handleSubmit`, `handleEdit`, `resetForm` mises à jour
  - Nouveau textarea ajouté au formulaire avec aide visuelle
- **Fichier modifié** : `lib/genererContratInitialPDF.js`
  - L'Article 1 utilise désormais `appartement.description_complete`
  - Fallback générique si le champ est vide
- **Statut** : ✅ Déployé
- **Données saisies** :
  - APT-1ER : ✅ "studio composé d'une pièce principale et d'une douche-toilette externe"
  - APT-1CAV : ⏳ À saisir
  - APT-2A : ⏳ À saisir
  - APT-2B : ⏳ À saisir
  - APT-3RZ : ⏳ À saisir

---

## 📊 Données de production validées

### Table `renouvellements` (Supabase)
- **15 lignes** au total
- **4 renouvellements signés** avec signature_data complète :
  - Cesar Test3 — 7 mai 2026 15:08
  - Cesar Test2 — 7 mai 2026 14:26
  - Mr Cesar Test 4 — 7 mai 2026 15:29
  - Cesar Test 5 — 7 mai 2026 16:58
- 11 renouvellements en attente (anciens tests + récents)

### Table `appartements`
- **5 appartements** : APT-1CAV, APT-1ER, APT-2A, APT-2B, APT-3RZ
- 1 loué (APT-1ER), 4 vacants

### Table `contrats`
- **3 contrats au total** : 1 actif, 2 terminés, 0 résilié

---

## 🚧 À venir / Idées pour les prochaines sessions

### Priorité haute
- [ ] **Saisir les descriptions** des 4 appartements restants (APT-1CAV, APT-2A, APT-2B, APT-3RZ)
- [ ] **Tester sur mobile** : valider que les boutons sont accessibles au doigt
- [ ] **Investiguer le bug Chrome** : pourquoi le téléchargement PDF ne marche pas sur ce navigateur
- [ ] **Image signature dans le PDF avenant** : la signature est sauvegardée en base mais n'apparaît pas dans le PDF généré

### Priorité moyenne
- [ ] **Phase 6 : Signature électronique du contrat initial** (multi-parties bailleur + preneur)
- [ ] **Phase 7 : État des lieux numérique** avec photos par pièce
- [ ] **Notifications email/WhatsApp** automatiques quand un locataire signe
- [ ] **Tableau de bord enrichi** : graphiques de paiements, KPIs

### Priorité basse / Améliorations
- [ ] Domaine personnalisé (ex: `gestion.kenge14.com`)
- [ ] Export PDF des paiements mensuels
- [ ] Génération automatique des quittances de loyer
- [ ] Système de notifications de retards de paiement
- [ ] Page d'archives des anciens locataires
- [ ] Multi-langue (français + lingala ?)

---

## ⚠️ Points d'attention

### Sécurité
- ✅ Variables Supabase configurées dans Vercel (NEXT_PUBLIC_SUPABASE_URL, ANON_KEY)
- ⚠️ **À faire** : Vérifier que RLS (Row Level Security) est bien activé sur toutes les tables Supabase
- ⚠️ **À vérifier** : Les liens de signature publics — actuellement n'importe qui ayant le lien peut signer

### Compatibilité navigateurs
- ✅ Edge : fonctionne parfaitement
- ✅ Firefox : à tester
- 🟡 Chrome : téléchargement PDF parfois bloqué (à investiguer)
- ⏳ Safari : non testé

### Backup
- ✅ Code versionné sur GitHub (`cesarokoma-del/kenge14-app`)
- ⚠️ **À faire** : Mettre en place un backup régulier de la base Supabase

---

## 🔧 Workflow de développement

### Pour modifier l'application
1. Ouvrir VS Code dans `C:\Users\cesar\Projets\kenge14-app`
2. Modifier les fichiers nécessaires
3. **`Ctrl + S`** pour sauvegarder
4. Vérifier qu'il n'y a pas de **lignes rouges** (erreurs)
5. Dans Git Bash :
   ```bash
   git add <fichier-modifie>
   git commit -m "Message de commit en francais sans accents"
   git push
   ```
6. Surveiller le déploiement sur [vercel.com/cesarokoma-dels-projects/kenge14-app](https://vercel.com/cesarokoma-dels-projects/kenge14-app)
7. ⏳ Attendre 🟡 Building → 🟢 Ready (1-2 min)
8. Tester sur `https://kenge14-app.vercel.app` avec **`Ctrl + Shift + R`** (rafraîchissement forcé)

### En cas de bug
1. Lire les **Build Logs** sur Vercel (cliquer sur le déploiement en erreur)
2. Identifier le fichier et la ligne en erreur
3. Vérifier la **structure JSX** (balises ouvertes/fermées correctement)
4. Si nécessaire, ouvrir **F12** dans le navigateur pour voir les erreurs JavaScript
5. Corriger, sauvegarder, push, retester

---

## 🎓 Compétences acquises (Cesar)

Au cours de ce projet, vous avez maîtrisé :

- ✅ Lecture de **logs Vercel** et diagnostic d'erreurs de build
- ✅ Modification précise de fichiers avec **`Ctrl + F`** pour repérage
- ✅ Compréhension de la **structure JSX** (balises imbriquées)
- ✅ Utilisation de **Git** (add, commit, push)
- ✅ Manipulation de **Supabase** (Table Editor, SQL Editor, ALTER TABLE)
- ✅ Diagnostic par **isolation de variables** (Chrome vs Edge)
- ✅ Compréhension de patterns React avancés (`forwardRef`, `useImperativeHandle`)
- ✅ Tests **bout en bout** d'une fonctionnalité (saisie → base → PDF)

---

## 📞 Contacts importants

- **Bailleur** : M. Cesar OKOMA
  - Adresse : n° 15 Avenue de la Science, Commune de la Gombe, Kinshasa
  - WhatsApp : +1 817 353 8862
- **Adresse de l'immeuble** : 14 Avenue Kenge, Quartier Mama Yemo, Commune de Ngaliema, Kinshasa-RDC
- **Compte bancaire** : Equity-BCDC n° 233200011755382

---

## 📚 Liens utiles

- [Repo GitHub](https://github.com/cesarokoma-del/kenge14-app)
- [Dashboard Vercel](https://vercel.com/cesarokoma-dels-projects/kenge14-app)
- [Dashboard Supabase](https://supabase.com/dashboard)
- [URL Production](https://kenge14-app.vercel.app)

---

*Document généré et maintenu manuellement. À mettre à jour après chaque session de développement majeure.*
