// pages/etats-lieux/[contratId]/[type]/apercu.js
// Page d'aperçu et de validation d'un état des lieux signé
// - Bailleur uniquement (les gérants n'ont pas le pouvoir de valider)
// - Affiche tout: 5 pièces avec états/remarques/photos + signatures
// - Bouton "Valider" appelle validerParBailleur() -> statut passe à 'valide_bailleur'
// - Si déjà validé: indication de la date de validation, pas de bouton
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'
import LayoutGerant from '../../../../components/LayoutGerant'
import RouteGuard from '../../../../components/RouteGuard'
import { supabase, getProfilUtilisateur } from '../../../../lib/supabase'
import {
  chargerEtatLieuxParContrat,
  validerParBailleur,
} from '../../../../lib/etatsLieux'
import { formatDateFR, formatDateHeureFR } from '../../../../lib/dateUtils'
import { genererEtatLieuxPDF } from '../../../../lib/genererEtatLieuxPDF'

export default function PageApercuEtatLieux() {
  return (
    <RouteGuard rolesAutorises={['bailleur', 'gerant']}>
      <Contenu />
    </RouteGuard>
  )
}

function Contenu() {
  const router = useRouter()
  const { contratId, type } = router.query

  const [profil, setProfil] = useState(null)
  const [contrat, setContrat] = useState(null)
  const [etatLieux, setEtatLieux] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')
  const [validation, setValidation] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [parametres, setParametres] = useState(null)
  const [telechargement, setTelechargement] = useState(false)

  const typeValide = type === 'entree' || type === 'sortie'

  useEffect(() => {
    if (!router.isReady) return
    if (!contratId || !typeValide) {
      setErreur('URL invalide')
      setLoading(false)
      return
    }
    chargerDonnees()
  }, [router.isReady, contratId, type])

  async function chargerDonnees() {
    setLoading(true)
    const { profil: p } = await getProfilUtilisateur()
    if (!p) {
      setErreur('Profil introuvable')
      setLoading(false)
      return
    }
    setProfil(p)

    const { data: ctr } = await supabase
      .from('contrats')
      .select('*, locataire:locataires(*), appartement:appartements(*)')
      .eq('id', contratId)
      .single()
    setContrat(ctr)

    const { data: el } = await chargerEtatLieuxParContrat(contratId, type)
    if (!el) {
      setErreur('Aucun état des lieux trouvé pour ce contrat')
      setLoading(false)
      return
    }
    setEtatLieux(el)

    // Charger les paramètres bailleur (pour le PDF)
    const { data: params } = await supabase
      .from('parametres')
      .select('*')
      .limit(1)
      .maybeSingle()
    setParametres(params || {})

    setLoading(false)
  }

  async function handleTelechargerPDF() {
    setTelechargement(true)
    try {
      const doc = await genererEtatLieuxPDF({ contrat, etatLieux, parametres })
      const nomFichier = `etat-lieux-${type}-${contrat.appartement?.nom || 'contrat'}-${etatLieux.date_realisation}.pdf`
      doc.save(nomFichier)
    } catch (err) {
      alert('Erreur lors de la génération du PDF : ' + (err?.message || 'inconnue'))
      console.error(err)
    } finally {
      setTelechargement(false)
    }
  }

  async function handleValider() {
    if (!confirm('Valider définitivement cet état des lieux ?\n\nUne fois validé, il ne pourra plus être modifié.')) return
    setValidation(true)
    const { error } = await validerParBailleur(etatLieux.id)
    if (error) {
      alert('Erreur : ' + error.message)
      setValidation(false)
      return
    }
    setConfirmation(true)
    // Recharger les données mises à jour
    await chargerDonnees()
    setValidation(false)
  }

  // ============================================================
  // RENDER
  // ============================================================

  const LayoutComponent = profil?.role === 'gerant' ? LayoutGerant : Layout

  if (loading) {
    return (
      <LayoutComponent>
        <div className="p-4 text-center"><p className="text-gray-500">Chargement...</p></div>
      </LayoutComponent>
    )
  }

  if (erreur) {
    return (
      <LayoutComponent>
        <div className="p-4">
          <div className="bg-red-100 border border-red-300 text-red-800 rounded-xl p-4">❌ {erreur}</div>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">← Retour</button>
        </div>
      </LayoutComponent>
    )
  }

  const titreEmoji = type === 'entree' ? '📥' : '📤'
  const titreType = type === 'entree' ? "État des lieux d'entrée" : 'État des lieux de sortie'
  const couleurAccent = type === 'entree' ? 'emerald' : 'orange'

  const couleursEtat = {
    bon: { txt: '🟢 Bon', cls: 'bg-green-100 text-green-800 border-green-300' },
    moyen: { txt: '🟡 Moyen', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    mauvais: { txt: '🔴 Mauvais', cls: 'bg-red-100 text-red-800 border-red-300' },
  }

  const dejaValide = etatLieux.statut === 'valide_bailleur'
  const peutValider = etatLieux.statut === 'signe_locataire' && profil?.role === 'bailleur'

  return (
    <LayoutComponent>
      <div className="max-w-3xl mx-auto p-4">
        {/* Header */}
        <div className={`bg-${couleurAccent}-50 border border-${couleurAccent}-200 rounded-2xl p-4 mb-4`}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            {titreEmoji} {titreType}
          </h1>
          {contrat && (
            <p className="text-sm text-gray-600 mt-1">
              🏢 <strong>{contrat.appartement?.nom}</strong> — {contrat.locataire?.noms_complet}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            📅 Réalisé le <strong>{formatDateFR(etatLieux.date_realisation)}</strong>
          </p>

          {/* Indicateur de statut */}
          <div className="mt-3">
            {dejaValide && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-sm font-semibold">
                ✅ Validé le {formatDateHeureFR(etatLieux.date_validation_bailleur)}
              </span>
            )}
            {etatLieux.statut === 'signe_locataire' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-sm font-semibold">
                ⏳ Signé par le locataire — En attente de validation du bailleur
              </span>
            )}
            {etatLieux.statut === 'brouillon' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-full text-sm font-semibold">
                📝 Brouillon — Pas encore signé
              </span>
            )}
          </div>
        </div>

        {/* Confirmation après validation */}
        {confirmation && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 mb-4">
            <p className="text-emerald-800 font-semibold text-center">
              ✅ État des lieux validé avec succès !
            </p>
          </div>
        )}

        {/* Pièces */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">🏠 État par pièce</h2>
          <div className="space-y-3">
            {etatLieux.pieces?.sort((a, b) => a.ordre - b.ordre).map(piece => {
              const cfg = couleursEtat[piece.etat] || { txt: piece.etat, cls: 'bg-gray-100' }
              return (
                <div key={piece.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800">{piece.nom_piece}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                      {cfg.txt}
                    </span>
                  </div>
                  {piece.remarque && (
                    <p className="text-sm text-gray-600 italic mb-2">"{piece.remarque}"</p>
                  )}
                  {piece.photo_url && (
                    <img
                      src={piece.photo_url}
                      alt={`Photo ${piece.nom_piece}`}
                      className="w-full max-h-64 object-cover rounded mt-2"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Remarques générales */}
        {etatLieux.remarques_generales && (
          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <h2 className="text-lg font-bold text-gray-800 mb-2">📝 Remarques générales</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{etatLieux.remarques_generales}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">✍️ Signatures</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Réalisateur</p>
              {etatLieux.signature_realisateur ? (
                <>
                  <img
                    src={etatLieux.signature_realisateur}
                    alt="Signature réalisateur"
                    className="bg-white border border-gray-300 rounded p-2 w-full"
                    style={{ maxHeight: '120px', objectFit: 'contain' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {etatLieux.realise_par_profil?.nom_complet}
                    {' • '}{formatDateHeureFR(etatLieux.date_signature_realisateur)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Non signé</p>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Locataire</p>
              {etatLieux.signature_locataire ? (
                <>
                  <img
                    src={etatLieux.signature_locataire}
                    alt="Signature locataire"
                    className="bg-white border border-gray-300 rounded p-2 w-full"
                    style={{ maxHeight: '120px', objectFit: 'contain' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {contrat?.locataire?.noms_complet}
                    {' • '}{formatDateHeureFR(etatLieux.date_signature_locataire)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Non signé</p>
              )}
            </div>
          </div>

          {dejaValide && etatLieux.valide_par_profil && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700">Validation bailleur</p>
              <p className="text-xs text-gray-500 mt-1">
                {etatLieux.valide_par_profil.nom_complet}
                {' • '}{formatDateHeureFR(etatLieux.date_validation_bailleur)}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.back()}
            className="flex-1 min-w-[120px] px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold"
          >
            ← Retour
          </button>
          {/* Bouton PDF visible dès que l'état est signé (par le locataire ou validé) */}
          {(etatLieux.statut === 'signe_locataire' || etatLieux.statut === 'valide_bailleur') && (
            <button
              onClick={handleTelechargerPDF}
              disabled={telechargement}
              className="flex-1 min-w-[150px] px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-50"
            >
              {telechargement ? '⏳ Génération...' : '📄 Télécharger PDF'}
            </button>
          )}
          {peutValider && (
            <button
              onClick={handleValider}
              disabled={validation}
              className={`flex-1 min-w-[180px] px-4 py-3 bg-${couleurAccent}-600 hover:bg-${couleurAccent}-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-50`}
            >
              {validation ? '⏳ Validation...' : '✅ Valider l\'état des lieux'}
            </button>
          )}
        </div>

        {profil?.role === 'gerant' && etatLieux.statut === 'signe_locataire' && (
          <p className="text-xs text-gray-500 text-center mt-2 italic">
            ℹ️ Seul le bailleur peut valider définitivement l'état des lieux.
          </p>
        )}
      </div>
    </LayoutComponent>
  )
}