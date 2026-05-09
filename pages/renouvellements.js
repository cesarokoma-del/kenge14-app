import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { getRenouvellements, creerRenouvellement, validerRenouvellement, basculerContratsFuturs } from '../lib/supabase'
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
    await basculerContratsFuturs()
    const { data } = await getRenouvellements()
    setContrats(data || [])
    setLoading(false)
  }

  async function genererLien(contrat) {
    // 🛡️ PROTECTION DOUBLE-CLIC : si renouvellement déjà en cours, on demande confirmation
    if (contrat.dernier_renouvellement && contrat.ui_statut === 'en_attente') {
      const reenvoyer = confirm(
        `⚠️ Un lien a déjà été envoyé à ${contrat.locataire?.noms_complet} le ${new Date(contrat.dernier_renouvellement.date_demande).toLocaleDateString('fr-FR')}.\n\n` +
        `Le locataire ne l'a pas encore signé.\n\n` +
        `Voulez-vous RENVOYER le MÊME lien (recommandé) ?\n\n` +
        `✅ OK = Copier à nouveau le lien existant\n` +
        `❌ Annuler = Ne rien faire`
      )
      if (!reenvoyer) return

      // Recopier le lien existant sans créer de nouveau renouvellement
      const lienExistant = contrat.dernier_renouvellement.lien_signature
      try {
        await navigator.clipboard.writeText(lienExistant)
        alert(`✅ Lien existant recopié !\n\n${lienExistant}\n\nRenvoyez-le à ${contrat.locataire?.noms_complet} sur WhatsApp.`)
      } catch (e) {
        prompt(`Copiez ce lien :`, lienExistant)
      }
      return
    }

    setGenerating(contrat.id)
    
    const { data, error, lien } = await creerRenouvellement(contrat.id)
    
    if (error) {
      alert('❌ Erreur lors de la génération du lien')
      setGenerating(null)
      return
    }

    try {
      await navigator.clipboard.writeText(lien)
      alert(`✅ Lien copié dans le presse-papiers!\n\n${lien}\n\nEnvoyez ce lien à ${contrat.locataire?.noms_complet} sur WhatsApp.\n\nIl/elle pourra signer directement depuis son téléphone.`)
    } catch (e) {
      prompt(`Copiez ce lien et envoyez-le à ${contrat.locataire?.noms_complet} sur WhatsApp:`, lien)
    }
    
    setGenerating(null)
    chargerRenouvellements()
  }

  async function validerSignature(contrat) {
    const renouvellement = contrat.dernier_renouvellement
    if (!renouvellement) return

    const dateFinAncien = new Date(contrat.date_fin)
    const dateDebutNouveau = new Date(dateFinAncien)
    dateDebutNouveau.setDate(dateDebutNouveau.getDate() + 1)
    const dateFinNouveau = new Date(dateDebutNouveau)
    dateFinNouveau.setFullYear(dateFinNouveau.getFullYear() + 1)
    dateFinNouveau.setDate(dateFinNouveau.getDate() - 1)

    const formatDateFr = (d) => d.toLocaleDateString('fr-FR')

    const confirmation = confirm(
      `🔄 Activer le renouvellement de ${contrat.locataire?.noms_complet} ?\n\n` +
      `📅 Ancien contrat : se terminera le ${formatDateFr(dateFinAncien)}\n` +
      `📅 Nouveau contrat : du ${formatDateFr(dateDebutNouveau)} au ${formatDateFr(dateFinNouveau)}\n` +
      `💰 Loyer : ${contrat.loyer} USD/mois\n` +
      `🛡️ Garantie : ${contrat.garantie} USD (conservée)\n\n` +
      `Le nouveau contrat sera créé avec le statut "Futur" et deviendra actif automatiquement le ${formatDateFr(dateDebutNouveau)}.\n\n` +
      `Confirmer ?`
    )

    if (!confirmation) return

    setGenerating(contrat.id)
    const { data, error } = await validerRenouvellement(renouvellement.id)
    setGenerating(null)

    if (error) {
      alert('❌ Erreur : ' + (error.message || 'Inconnue'))
      return
    }

    alert(`✅ Renouvellement validé !\n\nLe nouveau contrat est créé avec statut "Futur".\nIl deviendra actif le ${formatDateFr(dateDebutNouveau)}.`)
    chargerRenouvellements()
  }

  function telechargerContratPDF(contrat) {
    const renouvellement = contrat.dernier_renouvellement
    if (!renouvellement || renouvellement.statut !== 'active') {
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

  // 📊 Compteurs pour le résumé
  const nombreRenouvellements = contrats.length
  const nbAEnvoyer = contrats.filter(c => c.ui_statut === 'a_envoyer').length
  const nbEnAttente = contrats.filter(c => c.ui_statut === 'en_attente').length
  const nbSignes = contrats.filter(c => c.ui_statut === 'signe').length

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

      {/* 📊 Résumé compteurs */}
      {nombreRenouvellements > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-red-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{nbAEnvoyer}</div>
            <div className="text-sm text-gray-600">📨 À envoyer</div>
          </div>
          <div className="bg-white border-2 border-yellow-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{nbEnAttente}</div>
            <div className="text-sm text-gray-600">⏳ En attente</div>
          </div>
          <div className="bg-white border-2 border-emerald-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{nbSignes}</div>
            <div className="text-sm text-gray-600">✅ Signés (à valider)</div>
          </div>
        </div>
      )}

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
            const renouvellement = contrat.dernier_renouvellement
            const uiStatut = contrat.ui_statut

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

            // 🎨 Override visuel selon le statut UI
            const cardBg = uiStatut === 'signe' ? 'bg-emerald-50 border-emerald-300'
                        : uiStatut === 'en_attente' ? 'bg-yellow-50 border-yellow-300'
                        : bgColors[color]

            return (
              <div
                key={contrat.id}
                className={`${cardBg} border-2 rounded-lg p-4`}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-[300px]">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-2xl">{icon}</span>
                      
                      {/* 🏷️ Badge dynamique selon statut UI */}
                      {uiStatut === 'signe' && (
                        <span className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold rounded">
                          ✅ SIGNÉ - À VALIDER
                        </span>
                      )}
                      {uiStatut === 'en_attente' && (
                        <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded">
                          ⏳ EN ATTENTE DE SIGNATURE
                        </span>
                      )}
                      {uiStatut === 'a_envoyer' && message && (
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
                    
                    {/* 📩 Info renouvellement existant */}
                    {renouvellement && uiStatut === 'en_attente' && (
                      <p className="text-sm text-yellow-800 mt-2 bg-yellow-100 p-2 rounded">
                        📩 Lien envoyé le{' '}
                        {new Date(renouvellement.date_demande).toLocaleDateString('fr-FR')} - 
                        En attente de signature du locataire
                      </p>
                    )}
                    {renouvellement && uiStatut === 'signe' && (
                      <p className="text-sm text-emerald-800 mt-2 bg-emerald-100 p-2 rounded">
                        ✅ Signé le{' '}
                        {renouvellement.date_signature 
                          ? new Date(renouvellement.date_signature).toLocaleDateString('fr-FR')
                          : new Date(renouvellement.created_at).toLocaleDateString('fr-FR')}
                        {renouvellement.nom_signataire && ` par ${renouvellement.nom_signataire}`}
                      </p>
                    )}
                  </div>

                  {/* 🎛️ Boutons contextuels selon ui_statut */}
                  <div className="flex flex-col gap-2 min-w-[220px]">
                    
                    {/* CAS 1 : À envoyer (aucun renouvellement créé) */}
                    {uiStatut === 'a_envoyer' && (
                      <button
                        onClick={() => genererLien(contrat)}
                        disabled={generating === contrat.id}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating === contrat.id ? '⏳' : '📨'} Envoyer proposition
                      </button>
                    )}

                    {/* CAS 2 : En attente (lien envoyé, pas signé) */}
                    {uiStatut === 'en_attente' && (
                      <>
                        <button
                          disabled
                          className="px-4 py-2 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed opacity-70"
                          title="Le lien a déjà été envoyé"
                        >
                          📩 Lien déjà envoyé
                        </button>
                        <button
                          onClick={() => genererLien(contrat)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                        >
                          🔄 Renvoyer le lien
                        </button>
                      </>
                    )}

                    {/* CAS 3 : Signé (à valider) */}
                    {uiStatut === 'signe' && (
                      <>
                        <button
                          onClick={() => validerSignature(contrat)}
                          disabled={generating === contrat.id}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generating === contrat.id ? '⏳' : '✅'} Valider le renouvellement
                        </button>
                        <button
                          onClick={() => telechargerContratPDF(contrat)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                        >
                          📥 Télécharger PDF signé
                        </button>
                      </>
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
          <li><strong>📨 À envoyer</strong> : Cliquez sur "Envoyer proposition" → le lien est copié → envoyez-le sur WhatsApp</li>
          <li><strong>⏳ En attente</strong> : Le locataire n'a pas encore signé. Vous pouvez "Renvoyer le lien" pour relancer</li>
          <li><strong>✅ Signé</strong> : Le locataire a signé ! Cliquez sur "Valider le renouvellement" pour créer le nouveau contrat</li>
        </ol>
      </div>
    </Layout>
  )
}