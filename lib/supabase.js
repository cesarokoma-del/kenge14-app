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

// Renouvellements à venir (90 jours) - priorité signé > en_attente, ignore traités
export const getRenouvellements = async () => {
  const dateLimit = new Date()
  dateLimit.setDate(dateLimit.getDate() + 90)

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

  // 🔑 PRIORITÉ MÉTIER : signé > en_attente > rien (ignore les 'traite')
  const enrichedData = data.map(contrat => {
    // 🚫 Ignore les renouvellements déjà traités (validés par le bailleur)
    const renouvs = (contrat.renouvellements || []).filter(r => r.statut !== 'traite')
    
    // 🏆 RÈGLE D'OR : une signature obtenue est SACRÉE
    const signe = renouvs.find(r => r.statut === 'active')
    
    let dernier = null
    if (signe) {
      dernier = signe  // Priorité absolue au signé
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://kenge14-app.vercel.app')
  const lienComplet = `${baseUrl}/signature/${lienId}`
  
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
    .eq('lien_signature', lienComplet)
    .single()
  
  return { data, error }
}

// Sauvegarder une signature
export const sauvegarderSignature = async (renouvellementId, nomSignataire, signatureData) => {
  const { data, error } = await supabase
    .from('renouvellements')
    .update({
      statut: 'signe',
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