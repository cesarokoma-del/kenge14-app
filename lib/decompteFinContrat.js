// lib/decompteFinContrat.js
// Helper pour le calcul du décompte de fin de contrat (KENGE 14)
//
// Règles métier (RDC) :
// 1. "Consume then pay" : un loyer est dû pour le mois consommé
// 2. Prorata mois en cours : loyer ÷ 30 (toujours, même février/juillet)
// 3. Jour de fin exclu : si fin = 15 juillet, le 15 n'est pas consommé (14 jours)
// 4. Reliquat = garantie - loyers_impayés - dégâts + surplus
//    - positif → bailleur restitue au locataire
//    - négatif → locataire doit au bailleur
//    - zéro    → balance neutre

import { supabase } from './supabase'

// ============================================================
// Constantes & utilitaires de conversion mois texte → nombre
// ============================================================

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/**
 * Convertit "Avril 2026" → { mois: 4, annee: 2026, absolu: 24316 }
 * "absolu" = année × 12 + mois, pour comparer 2 mois rapidement
 * @param {string} texte ex: "Avril 2026"
 * @returns {{ mois: number, annee: number, absolu: number } | null}
 */
export function parseMoisConcerne(texte) {
  if (!texte || typeof texte !== 'string') return null
  const parts = texte.trim().toLowerCase().split(/\s+/)
  if (parts.length !== 2) return null

  const moisIdx = MOIS_FR.indexOf(parts[0])
  if (moisIdx === -1) return null

  const annee = parseInt(parts[1], 10)
  if (isNaN(annee)) return null

  const mois = moisIdx + 1
  return { mois, annee, absolu: annee * 12 + mois }
}

/**
 * Convertit { mois, annee } → "Avril 2026" (capitalisé)
 */
export function formatMoisConcerne(mois, annee) {
  const nom = MOIS_FR[mois - 1]
  return nom.charAt(0).toUpperCase() + nom.slice(1) + ' ' + annee
}

/**
 * Renvoie l'absolu (an×12+mois) à partir d'un objet Date
 */
function dateToAbsolu(date) {
  return date.getFullYear() * 12 + (date.getMonth() + 1)
}

// ============================================================
// Calcul des loyers impayés avec prorata
// ============================================================

/**
 * Calcule les loyers impayés pour un contrat à une date de fin donnée.
 *
 * @param {Object} contrat       { id, date_debut, loyer, ... }
 * @param {string} dateFinISO    ex: "2026-07-15" (YYYY-MM-DD)
 * @param {Array}  paiements     Liste des paiements du contrat (statut='recu')
 *
 * @returns {{
 *   totalImpaye: number,         // USD impayé (positif)
 *   surplus: number,             // USD payé en surplus (positif)
 *   moisDus: Array,              // Détail par mois : [{ mois, montantDu, montantPaye, ... }]
 *   prorataJours: number,        // Nb de jours consommés du mois de fin
 *   prorataMontant: number       // USD à payer pour le mois de fin (prorata)
 * }}
 */
export function calculerLoyersImpayes(contrat, dateFinISO, paiements) {
  const loyer = parseFloat(contrat.loyer) || 0
  if (loyer === 0) {
    return {
      totalImpaye: 0,
      surplus: 0,
      moisDus: [],
      prorataJours: 0,
      prorataMontant: 0,
    }
  }

  const dateDebut = new Date(contrat.date_debut)
  const dateFin = new Date(dateFinISO)

  // Bornes en "absolu" (an*12+mois)
  const absoluDebut = dateToAbsolu(dateDebut)
  const absoluFin = dateToAbsolu(dateFin)

  // ── Prorata du mois de fin (jour de fin EXCLU) ──
  // ex: fin = 15 juillet → 14 jours consommés
  const jourFin = dateFin.getDate()
  const prorataJours = Math.max(0, jourFin - 1)
  const prorataMontant = Math.round((loyer / 30) * prorataJours * 100) / 100

  // ── Liste des mois dus ──
  // Tous les mois pleins du début de contrat au mois précédant le mois de fin
  // + le mois de fin avec prorata
  const moisDus = []
  for (let abs = absoluDebut; abs < absoluFin; abs++) {
    const annee = Math.floor((abs - 1) / 12)
    const mois = ((abs - 1) % 12) + 1
    moisDus.push({
      absolu: abs,
      mois,
      annee,
      libelle: formatMoisConcerne(mois, annee),
      montantDu: loyer,
      montantPaye: 0,
      statut: 'impaye', // mis à jour ci-dessous
    })
  }

  // Mois de fin avec prorata (seulement si > 0)
  if (prorataJours > 0) {
    const annee = Math.floor((absoluFin - 1) / 12)
    const mois = ((absoluFin - 1) % 12) + 1
    moisDus.push({
      absolu: absoluFin,
      mois,
      annee,
      libelle: formatMoisConcerne(mois, annee) + ` (${prorataJours} jours)`,
      montantDu: prorataMontant,
      montantPaye: 0,
      statut: 'impaye',
      estProrata: true,
    })
  }

  // ── Mapper les paiements reçus aux mois dus ──
  let surplus = 0
  for (const paiement of paiements) {
    const parsed = parseMoisConcerne(paiement.mois_concerne)
    if (!parsed) continue
    const montant = parseFloat(paiement.montant) || 0

    // Chercher le mois correspondant dans moisDus
    const moisCible = moisDus.find((m) => m.absolu === parsed.absolu)
    if (moisCible) {
      moisCible.montantPaye += montant
    } else {
      // Paiement pour un mois POSTÉRIEUR à la fin → surplus
      if (parsed.absolu > absoluFin || (parsed.absolu === absoluFin && prorataJours === 0)) {
        surplus += montant
      }
      // Sinon : paiement pour un mois ANTÉRIEUR au début du contrat (cas étrange) → ignoré
    }
  }

  // ── Calculer impayé par mois et statut ──
  let totalImpaye = 0
  for (const m of moisDus) {
    const reste = m.montantDu - m.montantPaye
    if (reste > 0.005) {
      m.statut = m.montantPaye > 0 ? 'partiel' : 'impaye'
      totalImpaye += reste
    } else if (reste < -0.005) {
      m.statut = 'trop_paye'
      surplus += -reste // surplus partiel sur ce mois
    } else {
      m.statut = 'paye'
    }
  }

  return {
    totalImpaye: Math.round(totalImpaye * 100) / 100,
    surplus: Math.round(surplus * 100) / 100,
    moisDus,
    prorataJours,
    prorataMontant,
  }
}

// ============================================================
// Calcul du reliquat final de garantie
// ============================================================

/**
 * Calcule le reliquat de garantie à restituer (ou à recouvrer).
 *
 * Formule : reliquat = garantie - loyers_impayés - dégâts + surplus
 *
 * @param {Object} params
 * @param {number} params.garantie         Montant garantie versée par le locataire (USD)
 * @param {number} params.loyersImpayes    Total des loyers impayés (USD)
 * @param {number} params.degats           Dégâts constatés (USD)
 * @param {number} params.surplus          Surplus payé par le locataire (USD)
 *
 * @returns {{
 *   reliquat: number,        // Résultat signé : >0 = à restituer, <0 = à recouvrer
 *   sens: 'restituer' | 'recouvrer' | 'neutre',
 *   montantAbsolu: number,   // |reliquat|
 *   detail: { garantie, loyersImpayes, degats, surplus }
 * }}
 */
export function calculerReliquatGarantie({
  garantie = 0,
  loyersImpayes = 0,
  degats = 0,
  surplus = 0,
}) {
  const g = parseFloat(garantie) || 0
  const li = parseFloat(loyersImpayes) || 0
  const d = parseFloat(degats) || 0
  const s = parseFloat(surplus) || 0

  const reliquat = Math.round((g - li - d + s) * 100) / 100

  let sens = 'neutre'
  if (reliquat > 0.005) sens = 'restituer'
  else if (reliquat < -0.005) sens = 'recouvrer'

  return {
    reliquat,
    sens,
    montantAbsolu: Math.abs(reliquat),
    detail: { garantie: g, loyersImpayes: li, degats: d, surplus: s },
  }
}

// ============================================================
// Fonction "tout-en-un" — récupère paiements et calcule
// ============================================================

/**
 * Charge les paiements d'un contrat depuis Supabase et calcule le décompte complet.
 * Utilisé dans la modale "Terminer le contrat" pour affichage live.
 *
 * @param {Object} contrat        Contrat complet avec garantie, loyer, date_debut, id
 * @param {string} dateFinISO     Date de fin effective YYYY-MM-DD
 * @param {number} degats         Dégâts constatés saisis par le bailleur
 *
 * @returns Promise<{
 *   loyersImpayes: { totalImpaye, surplus, moisDus, prorataJours, prorataMontant },
 *   reliquat: { reliquat, sens, montantAbsolu, detail },
 *   erreur: string | null
 * }>
 */
export async function calculerDecompteComplet(contrat, dateFinISO, degats = 0) {
  if (!contrat?.id) {
    return { loyersImpayes: null, reliquat: null, erreur: 'Contrat invalide' }
  }

  // Charger les paiements reçus du contrat
  const { data: paiements, error } = await supabase
    .from('paiements')
    .select('mois_concerne, montant, date_paiement, statut')
    .eq('contrat_id', contrat.id)
    .eq('statut', 'recu')

  if (error) {
    return { loyersImpayes: null, reliquat: null, erreur: error.message }
  }

  const loyersImpayes = calculerLoyersImpayes(contrat, dateFinISO, paiements || [])
  const reliquat = calculerReliquatGarantie({
    garantie: contrat.garantie,
    loyersImpayes: loyersImpayes.totalImpaye,
    degats: parseFloat(degats) || 0,
    surplus: loyersImpayes.surplus,
  })

  return { loyersImpayes, reliquat, erreur: null }
}