import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getEspaceLocataire } from '../../lib/supabase'

export default function EspaceLocataire() {
  const router = useRouter()
  const { token } = router.query

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vueHistorique, setVueHistorique] = useState(false)

  useEffect(() => {
    if (token) {
      chargerEspace()
    }
  }, [token])

  async function chargerEspace() {
    setLoading(true)
    const { data, error } = await getEspaceLocataire(token)
    
    if (error || !data) {
      setError(error?.message || 'Erreur de chargement')
      setLoading(false)
      return
    }
    
    setData(data)
    setLoading(false)
  }

  // Calcul du solde
  function calculerSolde() {
    if (!data?.contrat || !data?.paiementsTous) return null

    const dateDebut = new Date(data.contrat.date_debut)
    const aujourdhui = new Date()
    
    // Nombre de mois écoulés depuis le début du contrat
    const moisEcoules = Math.max(0, 
      (aujourdhui.getFullYear() - dateDebut.getFullYear()) * 12 +
      (aujourdhui.getMonth() - dateDebut.getMonth())
    )
    
    const loyerAttendu = moisEcoules * (data.contrat.loyer || 0)
    const totalPaye = data.paiementsTous.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0)
    const solde = totalPaye - loyerAttendu

    return {
      solde,
      totalPaye,
      loyerAttendu,
      moisEcoules,
      ajour: solde >= 0
    }
  }

  // Calculer le prochain loyer dû
  function getProchainLoyerDu() {
    if (!data?.contrat) return null
    const dateDebut = new Date(data.contrat.date_debut)
    const aujourdhui = new Date()
    const prochain = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, dateDebut.getDate())
    return prochain
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-emerald-600 text-xl">Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Accès refusé</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            Contactez votre bailleur pour obtenir un nouveau lien d'accès.
          </p>
        </div>
      </div>
    )
  }

  const { locataire, contrat, paiementsRecents, paiementsTous } = data
  const soldeInfo = calculerSolde()
  const prochainLoyer = getProchainLoyerDu()
  const paiementsAffiches = vueHistorique ? paiementsTous : paiementsRecents

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-emerald-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">KENGE 14</h1>
          <p className="text-emerald-100 text-sm">Mon espace locataire</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Carte Bienvenue */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Bienvenue,</p>
          <h2 className="text-xl font-bold text-gray-800">
            {locataire.noms_complet || 'Locataire'}
          </h2>
          {contrat?.appartement && (
            <p className="text-sm text-gray-600 mt-1">
              🏠 {contrat.appartement.nom} • {contrat.loyer} USD/mois
            </p>
          )}
        </div>

        {/* Section SOLDE */}
        {soldeInfo && (
          <div className={`rounded-xl shadow-sm p-5 border-2 ${
            soldeInfo.ajour 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{soldeInfo.ajour ? '✅' : '⚠️'}</span>
              <h3 className="font-bold text-gray-800">Mon solde</h3>
            </div>
            
            <div className="text-center py-3">
              <p className={`text-4xl font-bold ${
                soldeInfo.ajour ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {soldeInfo.ajour ? '+' : ''}{soldeInfo.solde.toFixed(0)} USD
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {soldeInfo.ajour ? 'À jour' : `Retard de ${Math.abs(soldeInfo.solde).toFixed(0)} USD`}
              </p>
            </div>

            {prochainLoyer && (
              <div className="text-center mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">Prochain loyer dû le</p>
                <p className="font-semibold text-gray-800">
                  {prochainLoyer.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Section CONTRAT */}
        {contrat && (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              📄 Mon contrat
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Appartement</span>
                <span className="font-semibold">{contrat.appartement?.nom || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loyer mensuel</span>
                <span className="font-semibold text-emerald-700">{contrat.loyer} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Garantie</span>
                <span className="font-semibold">{contrat.garantie || 0} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Début du contrat</span>
                <span className="font-semibold">
                  {new Date(contrat.date_debut).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fin du contrat</span>
                <span className="font-semibold">
                  {new Date(contrat.date_fin).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section PAIEMENTS */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              💰 Mes paiements
            </h3>
            <button
              onClick={() => setVueHistorique(!vueHistorique)}
              className="text-sm text-emerald-600 hover:underline font-medium"
            >
              {vueHistorique ? '↑ Voir les 12 derniers' : '↓ Voir tout l\'historique'}
            </button>
          </div>

          {paiementsAffiches.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-2">
              {paiementsAffiches.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      {parseFloat(p.montant).toFixed(0)} USD
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(p.date_paiement).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <span className="text-emerald-600 text-sm font-medium">✓ Reçu</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-gray-500 mt-4">
            Total : {paiementsTous.length} paiement{paiementsTous.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-500">
            KENGE 14 • Gestion Locative Professionnelle
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Lien personnel • Ne pas partager
          </p>
        </div>
      </div>
    </div>
  )
}