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

  // Calculer le prochain loyer dû (mois courant si pas encore passé, sinon mois suivant)
  function getProchainLoyerDu() {
    if (!data?.contrat) return null
    
    const dateDebut = new Date(data.contrat.date_debut)
    const jourDuMois = dateDebut.getDate()
    const aujourdhui = new Date()
    
    // Helper : crée une date en clampant au dernier jour si le jour n'existe pas
    // (ex: 31 février → 28 ou 29 février, 31 juin → 30 juin)
    function dateAvecClamp(annee, mois, jour) {
      const dernierJour = new Date(annee, mois + 1, 0).getDate()
      return new Date(annee, mois, Math.min(jour, dernierJour))
    }
    
    // Loyer du mois courant
    const loyerCeMois = dateAvecClamp(
      aujourdhui.getFullYear(),
      aujourdhui.getMonth(),
      jourDuMois
    )
    
    // Si on n'a pas encore passé la date de ce mois → c'est ça le prochain
    if (aujourdhui <= loyerCeMois) {
      return loyerCeMois
    }
    
    // Sinon → mois prochain
    return dateAvecClamp(
      aujourdhui.getFullYear(),
      aujourdhui.getMonth() + 1,
      jourDuMois
    )
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
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">
                        {parseFloat(p.montant).toFixed(0)} USD
                      </p>
                      {p.mois_concerne && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                          Loyer {p.mois_concerne}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Payé le {new Date(p.date_paiement).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <span className="text-emerald-600 text-sm font-medium ml-2">✓ Reçu</span>
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

      {/* Bouton WhatsApp flottant */}
      <a
        href={`https://wa.me/18173538862?text=${encodeURIComponent(
          `Bonjour, je suis ${locataire.noms_complet}, locataire ${contrat?.appartement?.nom || ''}. `
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center gap-2 px-5 py-3 transition-all hover:scale-105 z-50"
        aria-label="Contacter le bailleur sur WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span className="font-medium text-sm">Contacter</span>
      </a>
    </div>
  )
}