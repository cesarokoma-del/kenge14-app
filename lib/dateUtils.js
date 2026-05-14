// ============================================================
// lib/dateUtils.js
//
// Helpers centralisés pour la manipulation et l'affichage des dates.
//
// PROBLÈME RÉSOLU
// ----------------------------------------------------------------------------
// JavaScript interprète les chaînes ISO 'YYYY-MM-DD' (sans heure) en UTC.
// Donc new Date('2025-10-01') = 1er octobre 00:00 UTC.
// Dans un fuseau positif (Kinshasa UTC+1), ce moment est encore le
// 30 septembre 23:00 EN HEURE LOCALE.
// → getDate(), toLocaleDateString() renvoient alors le mauvais jour.
//
// SOLUTION
// ----------------------------------------------------------------------------
// parseDateLocale() construit directement la Date avec new Date(year, month, day)
// ce qui garantit minuit en heure locale, sans aucun décalage UTC.
// ============================================================

/**
 * Parse une date ISO 'YYYY-MM-DD' (ou un timestamp) en Date locale à minuit.
 * Pour les TIMESTAMP complets avec heure, comportement identique à new Date().
 *
 * @param {string|Date|null|undefined} input
 * @returns {Date|null} Date locale, ou null si input invalide
 */
export function parseDateLocale(input) {
  if (!input) return null
  if (input instanceof Date) return input
  if (typeof input !== 'string') return new Date(input)
  // Match strict YYYY-MM-DD (avec ou sans heure derrière)
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return new Date(input)
  // Si la chaîne contient une heure (T ou espace), on délègue à new Date()
  // car le timestamp est explicite et sans ambiguïté fuseau
  if (input.includes('T') || input.includes(' ')) return new Date(input)
  // Sinon, format date pure → construction locale
  const [, y, m, d] = match
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
}

/**
 * Formate une date en français court : '01/10/2025'
 * @param {string|Date|null|undefined} input
 * @returns {string} Date formatée ou '—' si null
 */
export function formatDateFR(input) {
  const d = parseDateLocale(input)
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formate une date en français long : '1 octobre 2025'
 * @param {string|Date|null|undefined} input
 * @returns {string} Date formatée ou '—' si null
 */
export function formatDateFRLong(input) {
  const d = parseDateLocale(input)
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formate une date en français avec heure : '01/10/2025 à 14:30'
 * Pour TIMESTAMP uniquement.
 * @param {string|Date|null|undefined} input
 * @returns {string} Date+heure formatée ou '—' si null
 */
export function formatDateHeureFR(input) {
  const d = parseDateLocale(input)
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}