// ============================================================================
// lib/comptesGerants.js
//
// Helpers pour gérer les comptes individuels des gérants.
//
// ARCHITECTURE COMPTE GÉRANT
// ----------------------------------------------------------------------------
// Le bailleur peut "approvisionner" le compte d'un gérant en créant une dépense
// de catégorie 'approvisionnement_gerant'. Le gérant peut ensuite engager des
// dépenses (réparations, déplacements, etc.) qui consomment ce solde.
//
//   Solde Net = Σ approvisionnements_reçus − Σ dépenses_engagées
//
// Pour C2, on travaille avec un seul gérant à la fois (cf. décision YAGNI
// en session C1). La signature accepte un gerantId pour préparer le futur.
// ============================================================================

import { supabase } from './supabase'

/**
 * Calcule le solde net d'un gérant donné.
 *
 * @param {string} gerantId - UUID du profil gérant
 * @returns {Promise<{
 *   gerantId: string,
 *   totalApprovisionne: number,
 *   totalDepense: number,
 *   soldeNet: number,
 *   nombreApprovisionnements: number,
 *   nombreDepenses: number,
 *   derniereOperation: string | null,
 *   error: Error | null
 * }>}
 */
export async function getSoldeGerant(gerantId) {
  // Garde-fou : pas de gerantId → on retourne un objet vide cohérent
  if (!gerantId) {
    return {
      gerantId: null,
      totalApprovisionne: 0,
      totalDepense: 0,
      soldeNet: 0,
      nombreApprovisionnements: 0,
      nombreDepenses: 0,
      derniereOperation: null,
      error: new Error('gerantId requis')
    }
  }

  try {
    // 1. Approvisionnements REÇUS par ce gérant
    //    = dépenses catégorie 'approvisionnement_gerant' enregistrées par le bailleur
    //    Note: pour C2, on prend TOUS les approvisionnements (un seul gérant).
    //    En multi-gérants futur, il faudra ajouter une colonne gerant_id sur depenses.
    const { data: approvisionnements, error: errApp } = await supabase
      .from('depenses')
      .select('montant, date_depense')
      .eq('categorie', 'approvisionnement_gerant')

    if (errApp) throw errApp

    // 2. Dépenses ENGAGÉES par ce gérant
    //    = dépenses où enregistre_par === gerantId
    const { data: depensesGerant, error: errDep } = await supabase
      .from('depenses')
      .select('montant, date_depense')
      .eq('enregistre_par', gerantId)

    if (errDep) throw errDep

    // 3. Calculs
    const totalApprovisionne = (approvisionnements || []).reduce(
      (sum, d) => sum + parseFloat(d.montant || 0),
      0
    )

    const totalDepense = (depensesGerant || []).reduce(
      (sum, d) => sum + parseFloat(d.montant || 0),
      0
    )

    const soldeNet = totalApprovisionne - totalDepense

    // 4. Date de la dernière opération (toutes catégories confondues)
    const toutesDates = [
      ...(approvisionnements || []).map(d => d.date_depense),
      ...(depensesGerant || []).map(d => d.date_depense)
    ].filter(Boolean)

    const derniereOperation = toutesDates.length > 0
      ? toutesDates.sort().reverse()[0]
      : null

    return {
      gerantId,
      totalApprovisionne,
      totalDepense,
      soldeNet,
      nombreApprovisionnements: (approvisionnements || []).length,
      nombreDepenses: (depensesGerant || []).length,
      derniereOperation,
      error: null
    }
  } catch (error) {
    console.error('Erreur getSoldeGerant:', error)
    return {
      gerantId,
      totalApprovisionne: 0,
      totalDepense: 0,
      soldeNet: 0,
      nombreApprovisionnements: 0,
      nombreDepenses: 0,
      derniereOperation: null,
      error
    }
  }
}

/**
 * Récupère l'ID du premier gérant actif (helper pratique pour version mono-gérant).
 *
 * @returns {Promise<string|null>} UUID du gérant ou null si aucun
 */
export async function getPremierGerantId() {
  const { data, error } = await supabase
    .from('profils')
    .select('id')
    .eq('role', 'gerant')
    .eq('actif', true)
    .limit(1)
    .single()

  if (error || !data) {
    console.warn('Aucun gérant actif trouvé')
    return null
  }

  return data.id
}