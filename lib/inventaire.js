// lib/inventaire.js
// Helpers Supabase pour le module Inventaire (dépôt)
//
// Architecture:
// - inventaire_items : catalogue (CRUD bailleur uniquement)
// - inventaire_mouvements : entrées (bailleur) et sorties (bailleur OR gérant)
// - inventaire_stock_actuel : vue calculée avec stock en temps réel
//
// Tous les helpers retournent { data, error } pour usage uniforme dans les pages.

import { supabase } from './supabase'

// ============================================================
// CATALOGUE - LECTURE
// ============================================================

/**
 * Liste les items du catalogue avec leur stock actuel.
 * Utilise la vue inventaire_stock_actuel pour avoir le stock calculé.
 *
 * @param {object} options
 * @param {boolean} options.inclureInactifs - inclure les items désactivés (default false)
 * @param {string} options.categorie - filtrer par catégorie (optionnel)
 * @param {string} options.recherche - recherche texte sur nom/description (optionnel)
 */
export async function listerStockActuel({ inclureInactifs = false, categorie = null, recherche = null } = {}) {
  let query = supabase
    .from('inventaire_stock_actuel')
    .select('*')
    .order('nom', { ascending: true })

  if (!inclureInactifs) {
    query = query.eq('actif', true)
  }
  if (categorie) {
    query = query.eq('categorie', categorie)
  }
  if (recherche && recherche.trim()) {
    const motif = `%${recherche.trim()}%`
    query = query.or(`nom.ilike.${motif},description.ilike.${motif}`)
  }

  const { data, error } = await query
  return { data: data || [], error }
}

/**
 * Charge un item du catalogue (sans calcul de stock).
 * Pour le stock actuel, utiliser chargerItemAvecStock.
 */
export async function chargerItem(id) {
  const { data, error } = await supabase
    .from('inventaire_items')
    .select('*, cree_par_profil:profils!cree_par(nom_complet, role)')
    .eq('id', id)
    .single()
  return { data, error }
}

/**
 * Charge un item avec son stock actuel (depuis la vue).
 */
export async function chargerItemAvecStock(id) {
  const { data, error } = await supabase
    .from('inventaire_stock_actuel')
    .select('*')
    .eq('id', id)
    .single()
  return { data, error }
}

/**
 * Retourne la liste des items avec stock bas (stock_actuel <= seuil_alerte).
 * Utile pour le tableau de bord du bailleur.
 */
export async function getStockBas() {
  const { data, error } = await supabase
    .from('inventaire_stock_actuel')
    .select('*')
    .eq('actif', true)
    .not('seuil_alerte', 'is', null)

  if (error) return { data: [], error }

  // Filtrer côté JS (Supabase ne supporte pas la comparaison entre 2 colonnes)
  const stockBas = (data || []).filter(item => Number(item.stock_actuel) <= Number(item.seuil_alerte))
  return { data: stockBas, error: null }
}

// ============================================================
// CATALOGUE - ÉCRITURE
// ============================================================

/**
 * Crée un nouvel item dans le catalogue.
 * Seul le bailleur peut créer un item (RLS).
 *
 * @param {object} item
 * @param {string} item.nom (obligatoire)
 * @param {string} item.categorie - 'outil' | 'consommable' | 'bien_appartement' | 'autre'
 * @param {string} item.unite (default 'pièce')
 * @param {number} item.quantite_initiale (default 0)
 * @param {string} item.description
 * @param {number} item.prix_unitaire_usd
 * @param {number} item.seuil_alerte
 * @param {string} item.photo_url
 */
export async function creerItem(item) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  const { data, error } = await supabase
    .from('inventaire_items')
    .insert({
      nom: item.nom,
      description: item.description || null,
      categorie: item.categorie,
      unite: item.unite || 'pièce',
      quantite_initiale: Number(item.quantite_initiale) || 0,
      prix_unitaire_usd: item.prix_unitaire_usd ? Number(item.prix_unitaire_usd) : null,
      seuil_alerte: item.seuil_alerte ? Number(item.seuil_alerte) : null,
      photo_url: item.photo_url || null,
      actif: true,
      cree_par: user.id,
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Modifie un item existant.
 * Seul le bailleur peut modifier (RLS).
 */
export async function modifierItem(id, updates) {
  // Nettoyer les champs qui peuvent venir avec un type incorrect
  const payload = { ...updates }
  if (payload.quantite_initiale !== undefined) payload.quantite_initiale = Number(payload.quantite_initiale)
  if (payload.prix_unitaire_usd !== undefined && payload.prix_unitaire_usd !== null && payload.prix_unitaire_usd !== '') {
    payload.prix_unitaire_usd = Number(payload.prix_unitaire_usd)
  } else if (payload.prix_unitaire_usd === '') {
    payload.prix_unitaire_usd = null
  }
  if (payload.seuil_alerte !== undefined && payload.seuil_alerte !== null && payload.seuil_alerte !== '') {
    payload.seuil_alerte = Number(payload.seuil_alerte)
  } else if (payload.seuil_alerte === '') {
    payload.seuil_alerte = null
  }

  const { data, error } = await supabase
    .from('inventaire_items')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

/**
 * Désactive un item (soft-delete). On ne supprime jamais physiquement
 * pour préserver l'historique des mouvements.
 */
export async function desactiverItem(id) {
  const { data, error } = await supabase
    .from('inventaire_items')
    .update({ actif: false })
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

/**
 * Réactive un item désactivé.
 */
export async function reactiverItem(id) {
  const { data, error } = await supabase
    .from('inventaire_items')
    .update({ actif: true })
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

// ============================================================
// MOUVEMENTS - LECTURE
// ============================================================

/**
 * Liste les mouvements avec filtres.
 *
 * @param {object} filtres
 * @param {string} filtres.itemId - filtrer par item
 * @param {string} filtres.type - 'entree' | 'sortie'
 * @param {string} filtres.dateDebut - ISO date
 * @param {string} filtres.dateFin - ISO date
 * @param {string} filtres.appartementId - filtrer par appartement (sorties)
 * @param {string} filtres.effectuePar - filtrer par profil
 * @param {number} filtres.limite - limite résultats (default 100)
 */
export async function listerMouvements(filtres = {}) {
  let query = supabase
    .from('inventaire_mouvements')
    .select(`
      *,
      item:inventaire_items(id, nom, unite, categorie),
      appartement:appartements(id, nom),
      effectue_par_profil:profils!effectue_par(id, nom_complet, role)
    `)
    .order('cree_le', { ascending: false })

  if (filtres.itemId) query = query.eq('item_id', filtres.itemId)
  if (filtres.type) query = query.eq('type', filtres.type)
  if (filtres.appartementId) query = query.eq('appartement_id', filtres.appartementId)
  if (filtres.effectuePar) query = query.eq('effectue_par', filtres.effectuePar)
  if (filtres.dateDebut) query = query.gte('cree_le', filtres.dateDebut)
  if (filtres.dateFin) query = query.lte('cree_le', filtres.dateFin)

  if (filtres.limite) query = query.limit(filtres.limite)

  const { data, error } = await query
  return { data: data || [], error }
}

/**
 * Charge un mouvement spécifique avec toutes ses relations.
 */
export async function chargerMouvement(id) {
  const { data, error } = await supabase
    .from('inventaire_mouvements')
    .select(`
      *,
      item:inventaire_items(*),
      appartement:appartements(id, nom),
      effectue_par_profil:profils!effectue_par(id, nom_complet, role)
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

// ============================================================
// MOUVEMENTS - ÉCRITURE
// ============================================================

/**
 * Enregistre une ENTRÉE de stock (réapprovisionnement / achat).
 * Seul le bailleur peut faire une entrée (RLS).
 *
 * @param {object} entree
 * @param {string} entree.itemId (obligatoire)
 * @param {number} entree.quantite (obligatoire, > 0)
 * @param {string} entree.motif (recommandé : "Achat chez X" ou "Don")
 * @param {string} entree.depenseId (optionnel, lien vers dépense)
 * @param {string} entree.notes
 */
export async function enregistrerEntree({ itemId, quantite, motif = null, depenseId = null, notes = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  if (!itemId) return { data: null, error: { message: 'itemId requis' } }
  if (!quantite || Number(quantite) <= 0) {
    return { data: null, error: { message: 'Quantité doit être > 0' } }
  }

  const { data, error } = await supabase
    .from('inventaire_mouvements')
    .insert({
      item_id: itemId,
      type: 'entree',
      quantite: Number(quantite),
      motif,
      depense_id: depenseId,
      effectue_par: user.id,
      notes,
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Enregistre une SORTIE de stock.
 * Bailleur ou gérant peut faire une sortie (RLS).
 * Motif obligatoire. Appartement concerné fortement recommandé pour traçabilité.
 *
 * @param {object} sortie
 * @param {string} sortie.itemId (obligatoire)
 * @param {number} sortie.quantite (obligatoire, > 0)
 * @param {string} sortie.motif (OBLIGATOIRE pour les sorties)
 * @param {string} sortie.appartementId (optionnel, mais recommandé)
 * @param {string} sortie.notes
 */
export async function enregistrerSortie({ itemId, quantite, motif, appartementId = null, notes = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  if (!itemId) return { data: null, error: { message: 'itemId requis' } }
  if (!quantite || Number(quantite) <= 0) {
    return { data: null, error: { message: 'Quantité doit être > 0' } }
  }
  if (!motif || !motif.trim()) {
    return { data: null, error: { message: 'Motif obligatoire pour une sortie' } }
  }

  // Vérification de stock suffisant (sécurité applicative en plus de la DB)
  const { data: stock, error: errStock } = await chargerItemAvecStock(itemId)
  if (errStock) return { data: null, error: errStock }
  if (Number(stock.stock_actuel) < Number(quantite)) {
    return {
      data: null,
      error: { message: `Stock insuffisant. Disponible : ${stock.stock_actuel} ${stock.unite}` }
    }
  }

  const { data, error } = await supabase
    .from('inventaire_mouvements')
    .insert({
      item_id: itemId,
      type: 'sortie',
      quantite: Number(quantite),
      motif: motif.trim(),
      appartement_id: appartementId,
      effectue_par: user.id,
      notes,
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Supprime un mouvement (bailleur uniquement, correction d'erreurs).
 * À utiliser avec prudence : casse la traçabilité.
 */
export async function supprimerMouvement(id) {
  const { error } = await supabase
    .from('inventaire_mouvements')
    .delete()
    .eq('id', id)
  return { data: null, error }
}

// ============================================================
// HELPERS DIVERS
// ============================================================

/**
 * Liste des catégories disponibles (statique pour l'instant).
 */
export const CATEGORIES_INVENTAIRE = [
  { value: 'outil', label: 'Outil', icone: '🔨' },
  { value: 'consommable', label: 'Consommable', icone: '🧴' },
  { value: 'bien_appartement', label: 'Bien d\'appartement', icone: '🪑' },
  { value: 'autre', label: 'Autre', icone: '📦' },
]

/**
 * Liste des unités courantes (suggestions).
 */
export const UNITES_INVENTAIRE = [
  'pièce', 'sac', 'mètre', 'litre', 'kg', 'boîte', 'rouleau', 'paquet'
]

/**
 * Retourne le label/icone d'une catégorie.
 */
export function getInfoCategorie(value) {
  return CATEGORIES_INVENTAIRE.find(c => c.value === value) || { value, label: value, icone: '📦' }
}

// ============================================================
// PHOTOS (Storage)
// ============================================================

const BUCKET_PHOTOS = 'inventaire-photos'

/**
 * Upload une photo d'item dans le bucket Supabase Storage.
 * Retourne l'URL publique en cas de succès.
 *
 * @param {File} file - fichier image (max 5MB, image/*)
 * @param {string} itemId - id de l'item (utilisé pour nommer le fichier)
 * @returns {{ data: { url: string, chemin: string } | null, error: any }}
 */
export async function uploaderPhotoItem(file, itemId) {
  if (!file) return { data: null, error: { message: 'Fichier manquant' } }
  if (!itemId) return { data: null, error: { message: 'itemId requis' } }

  if (!file.type.startsWith('image/')) {
    return { data: null, error: { message: 'Format invalide (image uniquement)' } }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { data: null, error: { message: 'Fichier trop volumineux (max 5 MB)' } }
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const chemin = `${itemId}/${Date.now()}.${ext}`

  const { error: errUpload } = await supabase.storage
    .from(BUCKET_PHOTOS)
    .upload(chemin, file, { cacheControl: '3600', upsert: false })

  if (errUpload) return { data: null, error: errUpload }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_PHOTOS)
    .getPublicUrl(chemin)

  return { data: { url: publicUrl, chemin }, error: null }
}

/**
 * Supprime une photo du bucket à partir de son chemin ou URL publique.
 */
export async function supprimerPhotoItem(cheminOuUrl) {
  if (!cheminOuUrl) return { data: null, error: null }

  let chemin = cheminOuUrl
  const marqueur = `/${BUCKET_PHOTOS}/`
  if (cheminOuUrl.includes(marqueur)) {
    chemin = cheminOuUrl.split(marqueur)[1]
  }

  const { error } = await supabase.storage
    .from(BUCKET_PHOTOS)
    .remove([chemin])

  return { data: null, error }
}