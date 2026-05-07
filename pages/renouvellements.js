import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { getRenouvellements, creerRenouvellement } from '../lib/supabase'
import { genererContratRenouvellementPDF } from '../lib/genererContratPDF'

export default function Renouvellements() {
  const [contrats, setContrats] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)

  useEffect(() => {
    chargerRenouvellements()
  }, [])

  async function chargerRenouvellements() {
    setLoading(true)
    const { data } = await getRenouvellements()
    setContrats(data || [])
    setLoading(false)
  }

  async function genererLien(contrat) {
    setGenerating(contrat.id)
    
    const { data, error, lien } = await creerRenouvellement(contrat.id)
    
    if (error) {
      alert('❌ Erreur lors de la génération du lien')
      setGenerating(null)
      return
    }

    // Copier dans le presse-papiers
    try {
      await navigator.clipboard.writeText(lien)
      alert(`✅ Lien copié dans le presse-papiers!\n\n${lien}\n\nEnvoyez ce lien à ${contrat.locataire?.noms_complet} sur WhatsApp.\n\nIl/elle pourra signer directement depuis son téléphone.`)
    } catch (e) {
      prompt(`Copiez ce lien et envoyez-le à ${contrat.locataire?.noms_complet} sur WhatsApp:`, lien)
    }
    
    setGenerating(null)
    chargerRenouvellements()
  }

  function telechargerContratPDF(contrat) {
    const renouvellement = contrat.renouvellements?.[0]
    if (!renouvellement || renouvellement.statut !== 'signe') {
      alert('❌ Ce renouvellement n\'est pas encore signé')
      return
    }
    
    const renouvellementComplet = {
      ...renouvellement,
      contrat: {
        ...contrat,
        appartement: contrat.appartement,
        locataire: contrat.locataire,
      }
    }
    
    const doc = genererContratRenouvellementPDF(renouvellementComplet)
    const nomFichier = `Contrat-${contrat.appartement?.nom || 'KENGE14'}-${contrat.locataire?.noms_complet || 'Signe'}.pdf`
    doc.save(nomFichier)
  }

  function getJoursRestants(dateFin) {
    const today = new Date()
    const fin = new Date(dateFin)
    const diff = Math.floor((fin - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  function getAlertColor(jours) {
    if (jours <= 30) return 'red'
    if (jours <= 60) return 'orange'
    return 'yellow'
  }

  function getAlertIcon(jours) {
    if (jours <= 30) return '🚨'
    if (jours <= 60) return '⏰'
    return '⚠️'
  }

  function getAlertMessage(jours) {
    if (jours <= 30) return 'URGENT'
    if (jours <= 60) return 'Bientôt'
    return ''
  }

  if (loading) {
    return (
      <Layout activePage="renouvellements">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  const nombreRenouvellements = contrats.length

  return (
    <Layout activePage="renouvellements">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          🔄 Renouvellements de Bail
        </h1>
        {nombreRenouvellements > 0 && (
          <span className="px-4 py-2 bg-red-600 text-white rounded-full font-bold">
            {nombreRenouvellements}
          </span>
        )}
      </div>

      {/* Alertes Actives */}
      <div className="space-y-4 mb-6">
        {contrats.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-500">Aucun contrat à renouveler dans les 90 prochains jours</p>
          </div>
        ) : (
          contrats.map((contrat) => {
            const jours = getJoursRestants(contrat.date_fin)
            const color = getAlertColor(jours)
            const icon = getAlertIcon(jours)
            const message = getAlertMessage(jours)
            const renouvellement = contrat.renouvellements?.[0]

            const bgColors = {
              red: 'bg-red-50 border-red-200',
              orange: 'bg-orange-50 border-orange-200',
              yellow: 'bg-yellow-50 border-yellow-200',
            }

            const badgeColors = {
              red: 'bg-red-600',
              orange: 'bg-orange-600',
              yellow: 'bg-yellow-600',
            }

            return (
              <div
                key={contrat.id}
                className={`${bgColors[color]} border-2 rounded-lg p-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{icon}</span>
                      {message && (
                        <span className={`px-2 py-1 ${badgeColors[color]} text-white text-xs font-bold rounded`}>
                          {message}
                        </span>
                      )}
                      <span className="font-bold text-gray-800">
                        {contrat.locataire?.noms_complet} - {contrat.appartement?.nom}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      <strong>Échéance :</strong>{' '}
                      {new Date(contrat.date_fin).toLocaleDateString('fr-FR')} (
                      <strong>{jours} jours</strong>)
                    </p>
                    <p className="text-sm text-gray-600">Loyer : {contrat.loyer} USD/mois</p>
                    
                    {renouvellement && (
                      <p className="text-sm text-emerald-700 mt-2">
                        ✅ Lien envoyé le{' '}
                        {new Date(renouvellement.date_demande).toLocaleDateString('fr-FR')} -{' '}
                        Statut: {renouvellement.statut === 'signe' ? '✅ Signé' : '⏳ En attente'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => genererLien(contrat)}
                      disabled={generating === contrat.id}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generating === contrat.id ? '⏳' : '📨'} Envoyer proposition
                    </button>
                    
                    {renouvellement?.statut === 'signe' && (
                      <button
                        onClick={() => telechargerContratPDF(contrat)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        📥 Télécharger PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-2">📋 Comment ça marche ?</h3>
        <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
          <li>Cliquez sur "📨 Envoyer proposition"</li>
          <li>Le lien est copié automatiquement</li>
          <li>Envoyez-le au locataire sur WhatsApp</li>
          <li>Le locataire clique et signe depuis son téléphone</li>
          <li>Vous recevez une notification quand c'est signé</li>
        </ol>
      </div>
    </Layout>
  )
}