import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions pour les opérations courantes

// Appartements
export const getAppartements = async () => {
  const { data, error } = await supabase
    .from('appartements')
    .select('*')
    .order('nom')
  return { data, error }
}

// Contrats avec relations
export const getContratsAvecDetails = async () => {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*),
      locataire:locataires(*)
    `)
    .order('date_fin', { ascending: true })
  return { data, error }
}

// Renouvellements à venir (90 jours) - exclut ceux qui ont déjà un contrat futur
export const getRenouvellements = async () => {
  const dateLimit = new Date()
  dateLimit.setDate(dateLimit.getDate() + 90)

  // 1. Récupérer les contrats actifs qui finissent dans 90j
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*),
      locataire:locataires(*),
      renouvellements(*)
    `)
    .gte('date_fin', new Date().toISOString().split('T')[0])
    .lte('date_fin', dateLimit.toISOString().split('T')[0])
    .eq('statut', 'actif')
    .order('date_fin', { ascending: true })

  if (error) return { data, error }

  // 2. Récupérer la liste des appartements qui ont DÉJÀ un contrat futur
  const { data: contratsFuturs } = await supabase
    .from('contrats')
    .select('appartement_id, locataire_id')
    .eq('statut', 'futur')

  // Créer une clé unique "appartementId_locataireId" pour identifier les "couples" déjà renouvelés
  const couplesAvecFutur = new Set(
    (contratsFuturs || []).map(c => `${c.appartement_id}_${c.locataire_id}`)
  )

  // 3. Filtrer : exclure les contrats actifs qui ont déjà un futur lié
  const contratsAFiltrer = data.filter(contrat => {
    const cle = `${contrat.appartement_id}_${contrat.locataire_id}`
    return !couplesAvecFutur.has(cle)
  })

  // 4. Enrichissement (priorité signé > en_attente > rien, ignore traités)
  const enrichedData = contratsAFiltrer.map(contrat => {
    const renouvs = (contrat.renouvellements || []).filter(r => r.statut !== 'traite')
    
    // 🏆 RÈGLE D'OR : signature obtenue est SACRÉE
    const signe = renouvs.find(r => r.statut === 'active')
    
    let dernier = null
    if (signe) {
      dernier = signe
    } else {
      const sorted = [...renouvs].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )
      dernier = sorted[0] || null
    }
    
    return {
      ...contrat,
      dernier_renouvellement: dernier,
      deja_signe: !!signe,
      ui_statut: !dernier ? 'a_envoyer' 
                : signe ? 'signe'
                : dernier.statut === 'en_attente' ? 'en_attente'
                : 'a_envoyer'
    }
  })

  return { data: enrichedData, error }
}

// Créer un renouvellement
export const creerRenouvellement = async (contratId) => {
  const lienId = `renouvellement-${Date.now()}`
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://kenge14-app.vercel.app')
  const lienSignature = `${baseUrl}/signature/${lienId}`
  
  const { data, error } = await supabase
    .from('renouvellements')
    .insert({
      contrat_id: contratId,
      lien_signature: lienSignature,
      statut: 'en_attente'
    })
    .select()
    .single()
  
  return { data, error, lien: lienSignature }
}

// Récupérer un renouvellement par lien
export const getRenouvellementParLien = async (lienId) => {
  const { data, error } = await supabase
    .from('renouvellements')
    .select(`
      *,
      contrat:contrats(
        *,
        appartement:appartements(*),
        locataire:locataires(*)
      )
    `)
    .like('lien_signature', `%/signature/${lienId}`)
    .single()

  return { data, error }
}
// Sauvegarder une signature
export const sauvegarderSignature = async (renouvellementId, nomSignataire, signatureData) => {
  const { data, error } = await supabase
    .from('renouvellements')
    .update({
      statut: 'active',
      date_signature: new Date().toISOString(),
      nom_signataire: nomSignataire,
      signature_data: signatureData
    })
    .eq('id', renouvellementId)
    .select()
    .single()
  
  return { data, error }
}

// Statistiques Dashboard
export const getStatistiquesDashboard = async () => {
  // Appartements totaux et loués
  const { data: appts } = await supabase
    .from('appartements')
    .select('statut')
  
  const totalAppts = appts?.length || 0
  const apptsLoues = appts?.filter(a => a.statut === 'loue').length || 0
  
  // Revenu mensuel
  const { data: contratsActifs } = await supabase
    .from('contrats')
    .select('loyer')
    .eq('statut', 'actif')
  
  const revenuMensuel = contratsActifs?.reduce((sum, c) => sum + parseFloat(c.loyer), 0) || 0
  
  // Paiements du mois
  const debutMois = new Date()
  debutMois.setDate(1)
  
  const { data: paiementsMois } = await supabase
    .from('paiements')
    .select('montant')
    .gte('date_paiement', debutMois.toISOString().split('T')[0])
  
  const revenuActuel = paiementsMois?.reduce((sum, p) => sum + parseFloat(p.montant), 0) || 0
  
  // Loyers en retard
  const aujourdhui = new Date()
  const jour = aujourdhui.getDate()
  const loyersRetard = jour > 5 ? apptsLoues - (paiementsMois?.length || 0) : 0
  
  return {
    totalAppartements: totalAppts,
    appartementsLoues: apptsLoues,
    revenuMensuel,
    revenuActuel,
    loyersEnRetard: Math.max(0, loyersRetard)
  }
}
// ============================================================
// PARAMÈTRES (signature bailleur, etc.)
// ============================================================

// Récupérer la signature du bailleur
export const getSignatureBailleur = async () => {
  const { data, error } = await supabase
    .from('parametres')
    .select('valeur')
    .eq('cle', 'signature_bailleur')
    .single()
  
  return { signature: data?.valeur || null, error }
}

// Sauvegarder la signature du bailleur
export const setSignatureBailleur = async (signatureData) => {
  const { data, error } = await supabase
    .from('parametres')
    .update({
      valeur: signatureData,
      updated_at: new Date().toISOString()
    })
    .eq('cle', 'signature_bailleur')
    .select()
    .single()
  
  return { data, error }
}
// ============================================================
// SIGNATURE DU CONTRAT DE BAIL INITIAL (multi-parties)
// ============================================================

// Le bailleur signe le contrat (utilise sa signature stockée)
export const signerContratCommeBailleur = async (contratId) => {
  // 1. Récupérer la signature stockée du bailleur
  const { signature: signatureStockee, error: errSig } = await getSignatureBailleur()
  
  if (errSig || !signatureStockee) {
    return { 
      data: null, 
      error: { message: 'Aucune signature bailleur enregistrée. Veuillez d\'abord créer votre signature dans Paramètres.' } 
    }
  }
  
  // 2. Apposer la signature sur le contrat
  const { data, error } = await supabase
    .from('contrats')
    .update({
      signature_bailleur: signatureStockee,
      date_signature_bailleur: new Date().toISOString(),
      statut_signature: 'bailleur_signe'
    })
    .eq('id', contratId)
    .select()
    .single()
  
  return { data, error }
}

// Créer un lien de signature pour le locataire
export const creerLienSignatureBail = async (contratId) => {
  const lienId = `bail-${Date.now()}`
  
  const { data, error } = await supabase
    .from('contrats')
    .update({
      lien_signature_initial: lienId
    })
    .eq('id', contratId)
    .select()
    .single()
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://kenge14-app.vercel.app')
  const lienComplet = `${baseUrl}/signature-bail/${lienId}`
  
  return { data, error, lien: lienComplet }
}

// Récupérer un contrat par son lien de signature
export const getContratParLienSignature = async (lienId) => {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*),
      locataire:locataires(*)
    `)
    .eq('lien_signature_initial', lienId)
    .single()
  
  return { data, error }
}

// Le locataire signe le contrat
export const signerContratCommeLocataire = async (contratId, signatureLocataire) => {
  // Récupérer le statut actuel
  const { data: contrat } = await supabase
    .from('contrats')
    .select('statut_signature')
    .eq('id', contratId)
    .single()
  
  // Déterminer le nouveau statut
  const nouveauStatut = contrat?.statut_signature === 'bailleur_signe' 
    ? 'tous_signes' 
    : 'locataire_signe'
  
  const { data, error } = await supabase
    .from('contrats')
    .update({
      signature_locataire: signatureLocataire,
      date_signature_locataire: new Date().toISOString(),
      statut_signature: nouveauStatut
    })
    .eq('id', contratId)
    .select()
    .single()
  
  return { data, error }
}

// Connaître l'état de signature d'un contrat
export const getStatutSignatureContrat = async (contratId) => {
  const { data, error } = await supabase
    .from('contrats')
    .select('statut_signature, signature_bailleur, signature_locataire, date_signature_bailleur, date_signature_locataire, lien_signature_initial')
    .eq('id', contratId)
    .single()
  
  return { data, error }
}

// ════════════════════════════════════════════════════════════
// 💰 GESTION DU SOLDE BANCAIRE
// ════════════════════════════════════════════════════════════

// Récupère le solde initial le plus récent
export const getSoldeInitial = async () => {
  const { data, error } = await supabase
    .from('solde_initial')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { data, error }
}

// Enregistre un nouveau solde initial
export const enregistrerSoldeInitial = async (montant, dateReference, notes = '') => {
  const { data, error } = await supabase
    .from('solde_initial')
    .insert([{ 
      montant: parseFloat(montant), 
      date_reference: dateReference,
      notes 
    }])
    .select()
    .single()
  return { data, error }
}

// Met à jour un solde initial existant
export const modifierSoldeInitial = async (id, montant, dateReference, notes = '') => {
  const { data, error } = await supabase
    .from('solde_initial')
    .update({ 
      montant: parseFloat(montant), 
      date_reference: dateReference,
      notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// Calcule le solde bancaire complet (brut, garanties, net)
export const calculerSoldeBancaire = async () => {
  // 1. Récupérer le solde initial
  const { data: solde } = await getSoldeInitial()
  const initial = solde?.montant ? parseFloat(solde.montant) : 0
  const dateRef = solde?.date_reference || '1970-01-01'

  // 2. Total des paiements après la date de référence
  const { data: paiements } = await supabase
    .from('paiements')
    .select('montant, date_paiement')    
  
  const totalPaiements = paiements?.reduce(
    (sum, p) => sum + parseFloat(p.montant || 0), 0
  ) || 0

  // 3. Total des dépenses après la date de référence
  const { data: depenses } = await supabase
    .from('depenses')
    .select('montant, date_depense')
      
  const totalDepenses = depenses?.reduce(
    (sum, d) => sum + parseFloat(d.montant || 0), 0
  ) || 0

  // 4. Total des garanties (contrats actifs)
  const { data: contrats } = await supabase
    .from('contrats')
    .select('garantie, statut')
    .eq('statut', 'actif')
  
  const totalGaranties = contrats?.reduce(
    (sum, c) => sum + parseFloat(c.garantie || 0), 0
  ) || 0

  // 5. Calculs finaux selon la formule mathématique
  // 🧮 Solde Net  = (entrées + paiements) - dépenses
  // 🧮 Solde Brut = Solde Net + garanties (en tout temps)
  const soldeNet = (initial + totalPaiements) - totalDepenses
  const soldeBrut = soldeNet + totalGaranties

  return {
    soldeInitial: initial,
    dateReference: dateRef,
    totalPaiements,
    totalDepenses,
    totalGaranties,
    soldeBrut,
    soldeNet,
    hasSoldeInitial: !!solde
  }
}

// 🔄 Valider un renouvellement signé : crée le nouveau contrat 'futur' et marque le renouvellement comme actif
export const validerRenouvellement = async (renouvellementId) => {
  try {
    // 1. Récupérer le renouvellement avec le contrat actuel
    const { data: renouv, error: errRenouv } = await supabase
      .from('renouvellements')
      .select('*, contrat:contrat_id(*)')
      .eq('id', renouvellementId)
      .single()

    if (errRenouv || !renouv) {
      return { error: { message: 'Renouvellement introuvable' } }
    }

    if (renouv.statut !== 'active') {
      return { error: { message: 'Le renouvellement n\'est pas encore signé' } }
    }

    const ancienContrat = renouv.contrat
    if (!ancienContrat) {
      return { error: { message: 'Contrat actuel introuvable' } }
    }

    // 2. Calculer les dates du nouveau contrat
    // Date début nouveau = lendemain de date_fin de l'ancien
    const dateFinAncien = new Date(ancienContrat.date_fin)
    const dateDebutNouveau = new Date(dateFinAncien)
    dateDebutNouveau.setDate(dateDebutNouveau.getDate() + 1)

    // Date fin nouveau = date début + 12 mois
    const dateFinNouveau = new Date(dateDebutNouveau)
    dateFinNouveau.setFullYear(dateFinNouveau.getFullYear() + 1)
    dateFinNouveau.setDate(dateFinNouveau.getDate() - 1)

    const formatDate = (d) => d.toISOString().split('T')[0]

    // 3. Créer le nouveau contrat avec statut 'futur'
    const { data: nouveauContrat, error: errInsert } = await supabase
      .from('contrats')
      .insert({
        appartement_id: ancienContrat.appartement_id,
        locataire_id: ancienContrat.locataire_id,
        date_debut: formatDate(dateDebutNouveau),
        date_fin: formatDate(dateFinNouveau),
        duree_mois: 12,
        loyer: ancienContrat.loyer,
        garantie: ancienContrat.garantie,
        occupants: ancienContrat.occupants,
        clauses_speciales: ancienContrat.clauses_speciales,
        statut: 'futur'
      })
      .select()
      .single()

    if (errInsert) {
      return { error: errInsert }
    }

    // 4. Marquer le renouvellement comme 'active' pour qu'il disparaisse de la liste
    const { error: errUpdate } = await supabase
      .from('renouvellements')
      .update({ statut: 'traite' })  // au lieu de 'active'
      .eq('id', renouvellementId)

    if (errUpdate) {
      return { error: errUpdate }
    }

    return { data: nouveauContrat, error: null }
  } catch (e) {
    return { error: { message: e.message } }
  }
}

// 🔄 Bascule automatique : transforme les contrats 'futur' en 'actif' si la date de début est arrivée
// + termine les anciens contrats correspondants
export const basculerContratsFuturs = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. Trouver tous les contrats 'futur' dont date_debut <= aujourd'hui
    const { data: contratsFuturs, error: errFuturs } = await supabase
      .from('contrats')
      .select('*')
      .eq('statut', 'futur')
      .lte('date_debut', today)

    if (errFuturs || !contratsFuturs || contratsFuturs.length === 0) {
      return { data: [], error: null }
    }

    let basculesEffectuees = 0

    for (const contratFutur of contratsFuturs) {
      // 2. Trouver l'ancien contrat 'actif' du même locataire/appartement
      const { data: anciensContrats } = await supabase
        .from('contrats')
        .select('id')
        .eq('locataire_id', contratFutur.locataire_id)
        .eq('appartement_id', contratFutur.appartement_id)
        .eq('statut', 'actif')

      // 3. Terminer le(s) ancien(s) contrat(s)
      if (anciensContrats && anciensContrats.length > 0) {
        for (const ancien of anciensContrats) {
          await supabase
            .from('contrats')
            .update({ statut: 'termine' })
            .eq('id', ancien.id)
        }
      }

      // 4. Activer le contrat futur
      await supabase
        .from('contrats')
        .update({ statut: 'actif' })
        .eq('id', contratFutur.id)

      basculesEffectuees++
    }

    return { data: { basculesEffectuees }, error: null }
  } catch (e) {
    return { error: { message: e.message } }
  }
}

// ═══════════════════════════════════════════════════════════
// ESPACE LOCATAIRE
// ═══════════════════════════════════════════════════════════

// Récupérer toutes les infos du locataire via son token
export const getEspaceLocataire = async (token) => {
  // 1. Trouver le locataire par token (et vérifier qu'il est actif)
  const { data: locataire, error: errLocataire } = await supabase
    .from('locataires')
    .select('*')
    .eq('acces_token', token)
    .eq('acces_actif', true)
    .single()

  if (errLocataire || !locataire) {
    return { data: null, error: { message: 'Lien invalide ou révoqué' } }
  }

  // 2. Récupérer son contrat actif
  const { data: contrat } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*)
    `)
    .eq('locataire_id', locataire.id)
    .eq('statut', 'actif')
    .single()

  // 3 & 4. Récupérer les paiements (uniquement si contrat existe)
    let paiementsRecents = []
    let paiementsTous = []

    if (contrat?.id) {
      const { data: pRecents } = await supabase
        .from('paiements')
        .select('*')
        .eq('contrat_id', contrat.id)
        .order('date_paiement', { ascending: false })
        .limit(12)

      const { data: pTous } = await supabase
        .from('paiements')
        .select('*')
        .eq('contrat_id', contrat.id)
        .order('date_paiement', { ascending: false })

      paiementsRecents = pRecents || []
      paiementsTous = pTous || []
    }

  return {
    data: {
      locataire,
      contrat,
      paiementsRecents: paiementsRecents || [],
      paiementsTous: paiementsTous || []
    },
    error: null
  }
}

// Régénérer le token d'un locataire (révoque l'ancien)
export const regenererTokenLocataire = async (locataireId) => {
  const { data, error } = await supabase
    .from('locataires')
    .update({ 
      acces_token: crypto.randomUUID(),
      acces_actif: true 
    })
    .eq('id', locataireId)
    .select()
    .single()
  
  return { data, error }
}

// Désactiver l'accès d'un locataire (lien devient invalide)
export const revoquerAccesLocataire = async (locataireId) => {
  const { data, error } = await supabase
    .from('locataires')
    .update({ acces_actif: false })
    .eq('id', locataireId)
    .select()
    .single()
  
  return { data, error }
}

// ============================================
// AUTHENTIFICATION ADMIN
// ============================================

// Connexion par email/mot de passe
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

// Déconnexion
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Récupérer la session courante (null si pas connecté)
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  return { session: data?.session || null, error }
}

// S'abonner aux changements d'état d'auth (login/logout)
export const onAuthChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session)
  })
}

// Récupérer le profil complet de l'utilisateur connecté
// Retourne { user, profil, role, error } - jamais d'exception
// Sert de "porte d'entrée" pour toutes les pages protégées
export const getProfilUtilisateur = async () => {
  // 1. Récupérer l'utilisateur Auth connecté
  const { data: { user }, error: errUser } = await supabase.auth.getUser()
  
  if (errUser || !user) {
    return { user: null, profil: null, role: null, error: errUser }
  }
  
  // 2. Récupérer son profil métier dans la table profils
  const { data: profil, error: errProfil } = await supabase
    .from('profils')
    .select('*')
    .eq('id', user.id)
    .single()
  
  if (errProfil || !profil) {
    return { 
      user, 
      profil: null, 
      role: null, 
      error: { message: 'Profil non trouvé pour cet utilisateur' } 
    }
  }
  
  // 3. 🛡️ SÉCURITÉ : vérifier que le compte est actif
  // Permet le blocage en 1 clic : il suffit de mettre actif=false dans la BDD
  if (!profil.actif) {
    return { 
      user, 
      profil, 
      role: null, 
      error: { message: 'Compte désactivé' } 
    }
  }
  
  // 4. ✅ Tout est OK : on retourne les infos complètes
  return { 
    user,
    profil,
    role: profil.role,
    error: null 
  }
}

// ============================================================
// VÉRIFICATION D'ACCÈS PAR RÔLE (Phase 2 - Garde-fou)
// ============================================================

// Vérifie si l'utilisateur connecté a un des rôles autorisés
// 
// Usage : const acces = await verifierAcces(['bailleur'])
//         if (!acces.autorise) router.push(acces.redirection)
//
// Retourne TOUJOURS un objet structuré (jamais d'exception) :
//   { autorise: true,  profil, role }                   → accès OK
//   { autorise: false, raison: 'non_connecte', redirection: '/login' }
//   { autorise: false, raison: 'profil_manquant', redirection: '/login' }
//   { autorise: false, raison: 'compte_desactive', redirection: '/login' }
//   { autorise: false, raison: 'role_insuffisant', redirection: '/acces-refuse', role }
export const verifierAcces = async (rolesAutorises = []) => {
  // 1. Récupérer le profil via le helper de la Phase 1
  const { user, profil, role, error } = await getProfilUtilisateur()
  
  // 2. Pas connecté → vers /login
  if (!user) {
    return { 
      autorise: false, 
      raison: 'non_connecte', 
      redirection: '/login' 
    }
  }
  
  // 3. Connecté mais pas de profil → vers /login (compte mal configuré)
  if (!profil) {
    return { 
      autorise: false, 
      raison: 'profil_manquant', 
      redirection: '/login',
      message: error?.message || 'Profil introuvable'
    }
  }
  
  // 4. Profil existe mais désactivé (blocage 1 clic) → vers /login
  if (!profil.actif) {
    return { 
      autorise: false, 
      raison: 'compte_desactive', 
      redirection: '/login',
      message: 'Votre compte a été désactivé'
    }
  }
  
  // 5. Profil OK mais rôle insuffisant → vers /acces-refuse
  if (rolesAutorises.length > 0 && !rolesAutorises.includes(role)) {
    return { 
      autorise: false, 
      raison: 'role_insuffisant', 
      redirection: '/acces-refuse',
      role,        // Pour pouvoir afficher "Vous êtes gérant" dans la page d'erreur
      profil       // Au cas où la page /acces-refuse veut afficher le nom
    }
  }
  
  // 6. ✅ Tout est OK
  return { 
    autorise: true, 
    profil, 
    role 
  }
}
// ============================================================
// ESPACE GÉRANT - Données dédiées (Phase 3)
// ============================================================

// Récupère la liste des locataires en retard de paiement.
//
// 🇨🇩 LOGIQUE RDC ÉPROUVÉE : "consommer puis payer"
// Calcul basé sur la différence entre le mois courant et le DERNIER mois payé.
// Tolérance : 1 mois (le locataire a jusqu'à fin du mois suivant pour payer).
//
// Algorithme : utilise la même logique que pages/paiements.js
// pour garantir la cohérence dans toute l'app.
//
// IMPORTANT : volontairement, cette fonction NE retourne PAS les montants.
// Le gérant n'a pas besoin de connaître les loyers (cahier des charges).
export const getLocatairesEnRetard = async () => {
  // 1. Helpers de conversion mois ↔ nombre absolu
  const moisFrToNumber = (moisStr) => {
    if (!moisStr) return null
    const moisMap = {
      'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3,
      'Mai': 4, 'Juin': 5, 'Juillet': 6, 'Août': 7,
      'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11
    }
    const parts = moisStr.trim().split(' ')
    if (parts.length !== 2) return null
    const mois = moisMap[parts[0]]
    const annee = parseInt(parts[1])
    if (mois === undefined || isNaN(annee)) return null
    return annee * 12 + mois
  }

  const numberToMoisFr = (n) => {
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const annee = Math.floor(n / 12)
    const mois = n % 12
    return `${moisNoms[mois]} ${annee}`
  }

  // 2. Récupérer les contrats ACTIFS (pour calculer le retard)
  const { data: contratsActifs, error: errContrats } = await supabase
    .from('contrats')
    .select(`
      id,
      locataire_id,
      appartement_id,
      locataire:locataires(id, noms_complet, telephone),
      appartement:appartements(nom)
    `)
    .eq('statut', 'actif')

  if (errContrats || !contratsActifs) {
    return { data: [], error: errContrats }
  }

  // 3. Récupérer TOUS les contrats (actifs + termines + résiliés + futurs)
  // pour pouvoir agréger les paiements par couple locataire-appartement.
  // On exclut seulement les contrats `futur` car ils ne contribuent pas
  // à l'historique de paiement (le bail n'a pas encore commencé).
  const { data: tousContrats } = await supabase
    .from('contrats')
    .select('id, locataire_id, appartement_id, statut')
    .neq('statut', 'futur')

  // 4. Récupérer TOUS les paiements
  const { data: paiements } = await supabase
    .from('paiements')
    .select('contrat_id, mois_concerne, statut')

  // 5. Le mois courant en nombre absolu
  const aujourdhui = new Date()
  const moisCourant = aujourdhui.getFullYear() * 12 + aujourdhui.getMonth()

  // 6. Pour chaque contrat actif, calculer le retard en agrégeant
  // les paiements de TOUS les contrats du couple locataire-appartement.
  const enRetard = contratsActifs
    .map(contrat => {
      // Trouver TOUS les contrats du couple locataire-appartement
      // (incluant les anciens contrats du même locataire sur le même appartement)
      const contratsDuCouple = (tousContrats || []).filter(c =>
        c.locataire_id === contrat.locataire_id &&
        c.appartement_id === contrat.appartement_id
      )
      const idsContratsDuCouple = contratsDuCouple.map(c => c.id)

      // Agréger les paiements de tous ces contrats
      const paiementsDuCouple = (paiements || []).filter(p =>
        idsContratsDuCouple.includes(p.contrat_id)
      )

      // Convertir les mois_concerne en nombres absolus
      const moisPayes = paiementsDuCouple
        .map(p => moisFrToNumber(p.mois_concerne))
        .filter(m => m !== null)

      // Pas de paiement enregistré sur l'historique du couple
      // → vraie nouvelle location, on ne compte pas comme retard
      if (moisPayes.length === 0) {
        return null
      }

      // Trouver le dernier mois payé
      const dernierMoisPaye = Math.max(...moisPayes)
      const moisDeRetard = moisCourant - dernierMoisPaye

      // Tolérance 1 mois (logique RDC "consommer puis payer")
      if (moisDeRetard <= 1) return null

      // Construire l'objet retour (SANS le montant !)
      return {
        contrat_id: contrat.id,
        locataire_id: contrat.locataire?.id,
        noms_complet: contrat.locataire?.noms_complet || 'Locataire inconnu',
        telephone: contrat.locataire?.telephone || '',
        appartement: contrat.appartement?.nom || '—',
        dernier_mois_paye: numberToMoisFr(dernierMoisPaye),
        mois_de_retard: moisDeRetard - 1  // -1 car tolérance 1 mois
      }
    })
    .filter(item => item !== null)

  return { data: enRetard, error: null }
}

// Récupère le nombre de demandes locatives non encore approuvées
// (donc à traiter par le gérant)
export const getDemandesEnAttente = async () => {
  const { count, error } = await supabase
    .from('demandes_location')
    .select('*', { count: 'exact', head: true })
    .neq('statut', 'approuvee')

  return { count: count || 0, error }
}

// Récupère le nombre d'appartements vacants
export const getAppartementsVacants = async () => {
  const { count, error } = await supabase
    .from('appartements')
    .select('*', { count: 'exact', head: true })
    .eq('statut', 'vacant')

  return { count: count || 0, error }
}

// =====================================================================
// 💰 SIGNATURES DU DÉCOMPTE DE FIN DE CONTRAT
// =====================================================================
// Workflow:
//   1. Bailleur termine le contrat → signe → creerLienSignatureDecompte()
//      → statut: 'signe_bailleur', lien WhatsApp généré
//   2. Locataire ouvre /signature-decompte/[lienId]
//      → getContratParLienDecompte(lienId) charge le contrat + signature bailleur
//   3. Locataire signe → signerDecompteCommeLocataire(contratId, signature)
//      → statut: 'signe_complet'
//   4. Bailleur retrouve le décompte signé et télécharge le PDF final

// Bailleur signe d'abord et génère le lien public pour le locataire
export const creerLienSignatureDecompte = async (contratId, signatureBailleur) => {
  // Génère un identifiant unique pour le lien public
  const lienId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'lien-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)

  const { data, error } = await supabase
    .from('contrats')
    .update({
      signature_decompte_bailleur: signatureBailleur,
      date_signature_decompte_bailleur: new Date().toISOString(),
      lien_signature_decompte: lienId,
      statut_signature_decompte: 'signe_bailleur',
    })
    .eq('id', contratId)
    .select()
    .single()

  // Construit l'URL complète à envoyer via WhatsApp
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://kenge14-app.vercel.app'
  const lienComplet = `${baseUrl}/signature-decompte/${lienId}`

  return { data, error, lien: lienComplet }
}

// Récupérer un contrat par son lien de signature du décompte
export const getContratParLienDecompte = async (lienId) => {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*),
      locataire:locataires(*)
    `)
    .eq('lien_signature_decompte', lienId)
    .single()

  return { data, error }
}

// Le locataire signe le décompte
export const signerDecompteCommeLocataire = async (contratId, signatureLocataire) => {
  // Récupérer le statut actuel
  const { data: contrat } = await supabase
    .from('contrats')
    .select('statut_signature_decompte')
    .eq('id', contratId)
    .single()

  // Déterminer le nouveau statut (sécurité: si bailleur pas encore signé, on reste prudent)
  const nouveauStatut = contrat?.statut_signature_decompte === 'signe_bailleur'
    ? 'signe_complet'
    : 'signe_complet' // Le locataire a signé, donc considéré comme complet

  const { data, error } = await supabase
    .from('contrats')
    .update({
      signature_decompte_locataire: signatureLocataire,
      date_signature_decompte_locataire: new Date().toISOString(),
      statut_signature_decompte: nouveauStatut,
    })
    .eq('id', contratId)
    .select()
    .single()

  return { data, error }
}

// Connaître l'état de signature du décompte d'un contrat
export const getStatutDecompteContrat = async (contratId) => {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      statut_signature_decompte,
      signature_decompte_bailleur,
      signature_decompte_locataire,
      date_signature_decompte_bailleur,
      date_signature_decompte_locataire,
      lien_signature_decompte
    `)
    .eq('id', contratId)
    .single()

  return { data, error }
}
// =====================================================
// HELPERS — Workflow signatures Accord de Résiliation Amiable
// (parallèle au décompte, mais signature bailleur prise depuis paramètres)
// =====================================================

/**
 * Crée le lien public de signature pour l'accord de résiliation.
 * - Sauvegarde date + heure du RDV état des lieux (saisis par bailleur)
 * - Enregistre la date de signature bailleur (signature elle-même = paramètres)
 * - Génère un UUID v4 pour la page publique locataire
 *
 * NB: pas de colonne signature_resiliation_bailleur car on réutilise
 * la signature scannée des paramètres (parametres.valeur où cle='signature_bailleur')
 *
 * @param {string} contratId UUID du contrat
 * @param {string} dateEtatLieux Format ISO YYYY-MM-DD
 * @param {string} heureEtatLieux Format HH:MM
 * @returns {Promise<{data, error, lien}>}
 */
export const creerLienSignatureResiliation = async (
  contratId,
  dateEtatLieux,
  heureEtatLieux
) => {
  const lienId = crypto.randomUUID()

  const { data, error } = await supabase
    .from('contrats')
    .update({
      date_etat_lieux_sortie: dateEtatLieux,
      heure_etat_lieux_sortie: heureEtatLieux,
      date_signature_resiliation_bailleur: new Date().toISOString(),
      lien_signature_resiliation: lienId,
      statut_signature_resiliation: 'signe_bailleur',
    })
    .eq('id', contratId)
    .select()
    .single()

  return { data, error, lien: lienId }
}

/**
 * Récupère un contrat à partir de son lien public de signature résiliation.
 * Utilisé par la page publique /signature-resiliation/[lienId]
 *
 * @param {string} lienId UUID v4 issu de creerLienSignatureResiliation
 * @returns {Promise<{data, error}>}
 */
export const getContratParLienResiliation = async (lienId) => {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      locataire:locataires(*),
      appartement:appartements(*)
    `)
    .eq('lien_signature_resiliation', lienId)
    .single()

  return { data, error }
}

/**
 * Enregistre la signature locataire de l'accord de résiliation
 * et passe le statut à 'signe_complet'.
 *
 * @param {string} contratId UUID du contrat
 * @param {string} signatureLocataire PNG base64 (data:image/png;base64,...)
 * @returns {Promise<{data, error}>}
 */
export const signerResiliationCommeLocataire = async (contratId, signatureLocataire) => {
  const { data, error } = await supabase
    .from('contrats')
    .update({
      signature_resiliation_locataire: signatureLocataire,
      date_signature_resiliation_locataire: new Date().toISOString(),
      statut_signature_resiliation: 'signe_complet',
    })
    .eq('id', contratId)
    .select()
    .single()

  return { data, error }
}

/**
 * Récupère uniquement le statut de signature résiliation d'un contrat.
 * Utilisé pour afficher le badge sur la carte (E.1 du Bloc F).
 *
 * @param {string} contratId UUID du contrat
 * @returns {Promise<{statut, error}>}
 */
export const getStatutResiliationContrat = async (contratId) => {
  const { data, error } = await supabase
    .from('contrats')
    .select('statut_signature_resiliation')
    .eq('id', contratId)
    .single()

  return {
    statut: data?.statut_signature_resiliation || null,
    error,
  }
}