// ============================================================
// lib/etatsLieux.js
//
// Helpers Supabase pour gérer les états des lieux d'entrée et de sortie.
//
// WORKFLOW :
//   brouillon → signe_locataire → valide_bailleur
//
// QUI PEUT FAIRE QUOI :
//   - Bailleur OU gérant : créer brouillon, modifier pièces, signer côté réalisateur
//   - Locataire : signer (passe à signe_locataire) via lien magique
//   - Bailleur uniquement : valider (passe à valide_bailleur)
// ============================================================

import { supabase } from './supabase'

// Liste fixe des pièces inspectées (ordre = ordre d'affichage)
const PIECES_PAR_DEFAUT = [
  { nom_piece: 'Salon', ordre: 1 },
  { nom_piece: 'Chambre', ordre: 2 },
  { nom_piece: 'Cuisine', ordre: 3 },
  { nom_piece: 'Salle de bain', ordre: 4 },
  { nom_piece: 'Toilettes', ordre: 5 },
]

/**
 * Crée un état des lieux brouillon avec ses 5 pièces pré-remplies en état 'bon'.
 *
 * @param {string} contratId
 * @param {'entree'|'sortie'} type
 * @param {string} dateRealisationISO 'YYYY-MM-DD'
 * @returns {Promise<{data, error}>}
 */
export async function creerBrouillonEtatLieux(contratId, type, dateRealisationISO) {
  // 1. Récupérer l'utilisateur courant (bailleur ou gérant)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('Non authentifié') }

  // 2. Créer l'état des lieux
  const { data: etat, error: errEtat } = await supabase
    .from('etats_lieux')
    .insert({
      contrat_id: contratId,
      type,
      date_realisation: dateRealisationISO,
      realise_par: user.id,
      statut: 'brouillon',
    })
    .select()
    .single()

  if (errEtat) return { data: null, error: errEtat }

  // 3. Créer les 5 pièces avec état 'bon' par défaut
  const piecesAInserer = PIECES_PAR_DEFAUT.map(p => ({
    etat_lieux_id: etat.id,
    nom_piece: p.nom_piece,
    etat: 'bon',
    ordre: p.ordre,
  }))

  const { error: errPieces } = await supabase
    .from('etats_lieux_pieces')
    .insert(piecesAInserer)

  if (errPieces) {
    // Rollback : supprimer l'état créé
    await supabase.from('etats_lieux').delete().eq('id', etat.id)
    return { data: null, error: errPieces }
  }

  return { data: etat, error: null }
}

/**
 * Charge un état des lieux complet avec ses pièces.
 *
 * @param {string} etatLieuxId
 * @returns {Promise<{data, error}>}
 */
export async function chargerEtatLieux(etatLieuxId) {
  const { data, error } = await supabase
    .from('etats_lieux')
    .select(`
      *,
      pieces:etats_lieux_pieces(*),
      realise_par_profil:realise_par(nom_complet, role),
      valide_par_profil:valide_par(nom_complet, role)
    `)
    .eq('id', etatLieuxId)
    .single()

  if (data?.pieces) {
    data.pieces.sort((a, b) => a.ordre - b.ordre)
  }

  return { data, error }
}

/**
 * Trouve l'état des lieux d'un contrat pour un type donné (entrée ou sortie).
 * Retourne null si pas encore créé.
 *
 * @param {string} contratId
 * @param {'entree'|'sortie'} type
 * @returns {Promise<{data, error}>}
 */
export async function chargerEtatLieuxParContrat(contratId, type) {
  const { data, error } = await supabase
    .from('etats_lieux')
    .select(`
      *,
      pieces:etats_lieux_pieces(*)
    `)
    .eq('contrat_id', contratId)
    .eq('type', type)
    .maybeSingle() // pas .single() car peut ne pas exister

  if (data?.pieces) {
    data.pieces.sort((a, b) => a.ordre - b.ordre)
  }

  return { data, error }
}

/**
 * Met à jour une pièce (état, remarque, photo).
 *
 * @param {string} pieceId
 * @param {{ etat?: 'bon'|'moyen'|'mauvais', remarque?: string, photo_url?: string|null }} updates
 * @returns {Promise<{data, error}>}
 */
export async function mettreAJourPiece(pieceId, updates) {
  const { data, error } = await supabase
    .from('etats_lieux_pieces')
    .update(updates)
    .eq('id', pieceId)
    .select()
    .single()

  return { data, error }
}

/**
 * Met à jour les remarques générales d'un état.
 *
 * @param {string} etatLieuxId
 * @param {string} texte
 * @returns {Promise<{data, error}>}
 */
export async function mettreAJourRemarquesGenerales(etatLieuxId, texte) {
  const { data, error } = await supabase
    .from('etats_lieux')
    .update({ remarques_generales: texte })
    .eq('id', etatLieuxId)
    .select()
    .single()

  return { data, error }
}

/**
 * Enregistre la signature du réalisateur (gérant ou bailleur).
 * Reste en statut 'brouillon' tant que le locataire n'a pas signé.
 *
 * @param {string} etatLieuxId
 * @param {string} signaturePNG data:image/png;base64,...
 * @returns {Promise<{data, error}>}
 */
export async function signerEtatLieuxRealisateur(etatLieuxId, signaturePNG) {
  const { data, error } = await supabase
    .from('etats_lieux')
    .update({
      signature_realisateur: signaturePNG,
      date_signature_realisateur: new Date().toISOString(),
    })
    .eq('id', etatLieuxId)
    .select()
    .single()

  return { data, error }
}

/**
 * Enregistre la signature du locataire et passe le statut à 'signe_locataire'.
 *
 * @param {string} etatLieuxId
 * @param {string} signaturePNG
 * @returns {Promise<{data, error}>}
 */
export async function signerEtatLieuxLocataire(etatLieuxId, signaturePNG) {
  const { data, error } = await supabase
    .from('etats_lieux')
    .update({
      signature_locataire: signaturePNG,
      date_signature_locataire: new Date().toISOString(),
      statut: 'signe_locataire',
    })
    .eq('id', etatLieuxId)
    .select()
    .single()

  return { data, error }
}

/**
 * Validation finale par le bailleur. Passe le statut à 'valide_bailleur'.
 *
 * @param {string} etatLieuxId
 * @returns {Promise<{data, error}>}
 */
export async function validerParBailleur(etatLieuxId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('Non authentifié') }

  const { data, error } = await supabase
    .from('etats_lieux')
    .update({
      statut: 'valide_bailleur',
      date_validation_bailleur: new Date().toISOString(),
      valide_par: user.id,
    })
    .eq('id', etatLieuxId)
    .select()
    .single()

  return { data, error }
}

/**
 * Upload une photo dans Supabase Storage et retourne l'URL publique.
 * Bucket utilisé : 'etats-lieux-photos' (à créer côté Supabase Storage).
 *
 * @param {string} pieceId UUID de la pièce
 * @param {File} fileObject Fichier image (depuis input type=file)
 * @returns {Promise<{url: string|null, error: Error|null}>}
 */
export async function uploadPhotoPiece(pieceId, fileObject) {
  if (!fileObject) return { url: null, error: new Error('Aucun fichier') }

  // Nom unique : pieceId + timestamp + extension
  const extension = fileObject.name.split('.').pop().toLowerCase()
  const fileName = `${pieceId}-${Date.now()}.${extension}`

  // Upload dans le bucket 'etats-lieux-photos'
  const { data, error: errUpload } = await supabase.storage
    .from('etats-lieux-photos')
    .upload(fileName, fileObject, {
      cacheControl: '3600',
      upsert: false,
    })

  if (errUpload) return { url: null, error: errUpload }

  // Récupérer l'URL publique
  const { data: urlData } = supabase.storage
    .from('etats-lieux-photos')
    .getPublicUrl(fileName)

  return { url: urlData.publicUrl, error: null }
}

/**
 * Récupère les contrats actifs qui n'ont pas encore d'état des lieux d'entrée.
 * Utile pour afficher une alerte sur le dashboard ou la carte contrat.
 *
 * @returns {Promise<{data, error}>}
 */
export async function getContratsSansEtatEntree() {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      locataire:locataires(*),
      appartement:appartements(*),
      etats_lieux(id, type)
    `)
    .eq('statut', 'actif')

  if (error) return { data: null, error }

  // Filtrer ceux qui n'ont pas d'état 'entree'
  const sansEntree = (data || []).filter(c => {
    return !c.etats_lieux?.some(e => e.type === 'entree')
  })

  return { data: sansEntree, error: null }
}