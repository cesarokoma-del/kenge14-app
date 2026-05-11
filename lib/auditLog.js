// lib/auditLog.js
// Helper de lecture du journal d'audit (table audit_log)
// Réservé aux bailleurs : la RLS Supabase filtre automatiquement

import { supabase } from './supabase'

/**
 * Mapping table → libellé humain (français)
 * Utilisé pour l'affichage UI dans le sous-onglet Paramètres > Journal d'audit
 */
export const LIBELLES_TABLES = {
  paiements: 'Paiement',
  depenses: 'Dépense',
  demandes_location: 'Demande de location',
  contrats: 'Contrat',
  locataires: 'Locataire',
  renouvellements: 'Renouvellement',
  parametres: 'Paramètre',
}

/**
 * Mapping operation → libellé humain
 */
export const LIBELLES_OPERATIONS = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
}

/**
 * Couleurs Tailwind par opération (pour les badges UI)
 */
export const COULEURS_OPERATIONS = {
  INSERT: 'bg-green-100 text-green-800 border-green-300',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-300',
  DELETE: 'bg-red-100 text-red-800 border-red-300',
}

/**
 * Récupère les événements d'audit avec filtres optionnels
 *
 * @param {Object} filtres
 * @param {string}  filtres.table          - Nom de table SQL (ex: 'paiements') ou null pour toutes
 * @param {string}  filtres.operation      - 'INSERT' | 'UPDATE' | 'DELETE' ou null pour toutes
 * @param {string}  filtres.userEmail      - Email exact ou null pour tous
 * @param {string}  filtres.dateDebut      - ISO date string (ex: '2026-05-01') ou null
 * @param {string}  filtres.dateFin        - ISO date string ou null
 * @param {number}  filtres.limite         - Nombre max de lignes (défaut 100)
 *
 * @returns {Promise<{ data: Array, error: Error|null }>}
 */
export async function getEvenementsAudit(filtres = {}) {
  const {
    table = null,
    operation = null,
    userEmail = null,
    dateDebut = null,
    dateFin = null,
    limite = 100,
  } = filtres

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('cree_le', { ascending: false })
    .limit(limite)

  if (table) query = query.eq('table_name', table)
  if (operation) query = query.eq('operation', operation)
  if (userEmail) query = query.eq('user_email', userEmail)
  if (dateDebut) query = query.gte('cree_le', dateDebut)
  if (dateFin) {
    // Inclure toute la journée du dateFin : on ajoute 23:59:59
    const finJournee = new Date(dateFin)
    finJournee.setHours(23, 59, 59, 999)
    query = query.lte('cree_le', finJournee.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[auditLog] Erreur récupération événements :', error)
    return { data: [], error }
  }

  return { data: data || [], error: null }
}

/**
 * Récupère la liste distincte des utilisateurs ayant fait au moins une action
 * Utile pour peupler le filtre "Utilisateur" du UI
 */
export async function getUtilisateursAudit() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('user_email, user_role')
    .not('user_email', 'is', null)

  if (error || !data) return []

  // Déduplication côté JS
  const map = new Map()
  data.forEach((row) => {
    if (!map.has(row.user_email)) {
      map.set(row.user_email, { email: row.user_email, role: row.user_role })
    }
  })
  return Array.from(map.values())
}

/**
 * Génère un résumé textuel court de l'événement pour l'UI
 * Ex: "Création d'un paiement", "Modification d'un contrat (statut)"
 */
export function resumerEvenement(evt) {
  const libelleTable = LIBELLES_TABLES[evt.table_name] || evt.table_name
  const libelleOp = LIBELLES_OPERATIONS[evt.operation] || evt.operation

  // Article correct selon table (m/f)
  const articles = {
    paiements: "d'un",
    depenses: "d'une",
    demandes_location: "d'une",
    contrats: "d'un",
    locataires: "d'un",
    renouvellements: "d'un",
    parametres: "d'un",
  }
  const article = articles[evt.table_name] || "d'un"

  let resume = `${libelleOp} ${article} ${libelleTable.toLowerCase()}`

  // Pour les UPDATE, ajouter les champs modifiés
  if (evt.operation === 'UPDATE' && evt.changed_fields?.length) {
    const champs = evt.changed_fields
      .filter((c) => c !== 'modifie_le' && c !== 'updated_at')
      .join(', ')
    if (champs) resume += ` (${champs})`
  }

  return resume
}

/**
 * Convertit les événements en CSV pour export
 * @returns {string} contenu CSV prêt à télécharger
 */
export function exporterCSV(evenements) {
  const entetes = [
    'Date',
    'Heure',
    'Utilisateur',
    'Rôle',
    'Action',
    'Table',
    'ID enregistrement',
    'Champs modifiés',
  ]

  const lignes = evenements.map((evt) => {
    const date = new Date(evt.cree_le)
    return [
      date.toLocaleDateString('fr-FR'),
      date.toLocaleTimeString('fr-FR'),
      evt.user_email || 'Système',
      evt.user_role || '—',
      LIBELLES_OPERATIONS[evt.operation] || evt.operation,
      LIBELLES_TABLES[evt.table_name] || evt.table_name,
      evt.record_id || '—',
      (evt.changed_fields || []).join(' | '),
    ]
  })

  // Échappement CSV : guillemets doubles
  const echapper = (val) => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  return [
    entetes.map(echapper).join(','),
    ...lignes.map((l) => l.map(echapper).join(',')),
  ].join('\n')
}

/**
 * Déclenche le téléchargement d'un fichier CSV dans le navigateur
 */
export function telechargerCSV(evenements, nomFichier = 'audit-kenge14.csv') {
  const csv = exporterCSV(evenements)

  // BOM UTF-8 pour qu'Excel reconnaisse l'encodage et affiche les accents
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  URL.revokeObjectURL(url)
}