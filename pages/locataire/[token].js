import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
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
    const jourDuMois = dateDebut.getDate()
    const aujourdhui = new Date()
    
    function dateAvecClamp(annee, mois, jour) {
      const dernierJour = new Date(annee, mois + 1, 0).getDate()
      return new Date(annee, mois, Math.min(jour, dernierJour))
    }
    
    const loyerCeMois = dateAvecClamp(
      aujourdhui.getFullYear(),
      aujourdhui.getMonth(),
      jourDuMois
    )
    
    if (aujourdhui <= loyerCeMois) {
      return loyerCeMois
    }
    
    return dateAvecClamp(
      aujourdhui.getFullYear(),
      aujourdhui.getMonth() + 1,
      jourDuMois
    )
  }

  // ============================================
  // GÉNÉRATION DU REÇU PDF
  // ============================================

  // Convertit un nombre en lettres françaises (jusqu'à 99 999)
  function nombreEnLettres(n) {
    const unites = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF']
    const dizaines10_19 = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF']
    const dizaines = ['', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT']

    if (n === 0) return 'ZERO'
    
    function moinsDe1000(num) {
      let resultat = ''
      const centaines = Math.floor(num / 100)
      const reste = num % 100
      
      if (centaines > 0) {
        resultat += (centaines === 1 ? 'CENT' : unites[centaines] + ' CENT')
        if (reste === 0 && centaines > 1) resultat += 'S'
        if (reste > 0) resultat += ' '
      }
      
      if (reste === 0) return resultat.trim()
      
      if (reste < 10) {
        resultat += unites[reste]
      } else if (reste < 20) {
        resultat += dizaines10_19[reste - 10]
      } else {
        const diz = Math.floor(reste / 10)
        const uni = reste % 10
        if (diz === 7 || diz === 9) {
          resultat += dizaines[diz] + '-' + dizaines10_19[uni]
        } else {
          resultat += dizaines[diz]
          if (uni === 1 && diz < 8) resultat += ' ET UN'
          else if (uni > 0) resultat += '-' + unites[uni]
          else if (diz === 8) resultat += 'S'
        }
      }
      
      return resultat.trim()
    }
    
    if (n < 1000) return moinsDe1000(n)
    
    const milliers = Math.floor(n / 1000)
    const reste = n % 1000
    let resultat = (milliers === 1 ? 'MILLE' : moinsDe1000(milliers) + ' MILLE')
    if (reste > 0) resultat += ' ' + moinsDe1000(reste)
    return resultat
  }

  // Génère le numéro de reçu : REC-NOMS-YYYY-MM
  function genererNumeroRecu(paiement, locataire) {
    const premierNom = (locataire.noms_complet || 'LOC').split(' ')[0].toUpperCase()
    
    const moisFr = ['janvier', 'fevrier', 'février', 'mars', 'avril', 'mai', 'juin', 
                    'juillet', 'aout', 'août', 'septembre', 'octobre', 'novembre', 'decembre', 'décembre']
    const moisNum = ['01', '02', '02', '03', '04', '05', '06', '07', '08', '08', '09', '10', '11', '12', '12']
    
    let anneeMois = 'XXXX-XX'
    if (paiement.mois_concerne) {
      const parts = paiement.mois_concerne.toLowerCase().split(' ')
      const moisIdx = moisFr.indexOf(parts[0])
      const annee = parts[1] || new Date(paiement.date_paiement).getFullYear()
      if (moisIdx >= 0) {
        anneeMois = `${annee}-${moisNum[moisIdx]}`
      }
    } else {
      const d = new Date(paiement.date_paiement)
      anneeMois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    
    return `REC-${premierNom}-${anneeMois}`
  }

  function genererRecuPDF(paiement) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let y = 25

    // === EN-TÊTE COLORÉ ===
    doc.setFillColor(5, 150, 105)
    doc.rect(0, 0, pageWidth, 35, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('KENGE 14', margin, 18)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Gestion Locative Professionnelle', margin, 26)
    doc.text('Kinshasa, RDC', margin, 31)
    
    y = 50

    // === TITRE ===
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('REÇU DE PAIEMENT DE LOYER', pageWidth / 2, y, { align: 'center' })
    y += 15

    // === N° de reçu et date d'émission ===
    const numeroRecu = genererNumeroRecu(paiement, data.locataire)
    const dateEmission = new Date().toLocaleDateString('fr-FR', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    })
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.text(`N° de reçu : ${numeroRecu}`, margin, y)
    doc.text(`Date d'émission : ${dateEmission}`, pageWidth - margin, y, { align: 'right' })
    y += 8
    
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 12

    // === LOCATAIRE ===
    doc.setTextColor(5, 150, 105)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('LOCATAIRE', margin, y)
    y += 7
    
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Nom : ${data.locataire.noms_complet || 'N/A'}`, margin, y)
    y += 6
    doc.text(`Appartement : ${data.contrat?.appartement?.nom || 'N/A'}`, margin, y)
    y += 12

    // === PAIEMENT ===
    doc.setTextColor(5, 150, 105)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DÉTAILS DU PAIEMENT', margin, y)
    y += 7
    
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    
    const montant = parseFloat(paiement.montant)
    doc.text(`Montant : ${montant.toFixed(0)} USD`, margin, y)
    y += 6
    doc.text(`Mois concerné : ${paiement.mois_concerne || 'N/A'}`, margin, y)
    y += 6
    doc.text(`Date de paiement : ${new Date(paiement.date_paiement).toLocaleDateString('fr-FR', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    })}`, margin, y)
    y += 6
    
    const methode = (paiement.methode || 'N/A').replace(/_/g, ' ')
    doc.text(`Méthode : ${methode.charAt(0).toUpperCase() + methode.slice(1)}`, margin, y)
    y += 6
    doc.text(`Statut : ${paiement.statut === 'recu' ? 'Reçu ✓' : paiement.statut}`, margin, y)
    y += 12

    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 12

    // === TEXTE OFFICIEL ===
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const montantLettres = nombreEnLettres(Math.floor(montant))
    const texteOfficiel = `Je soussigné, Cesar Okoma, bailleur de l'immeuble KENGE 14, ` +
      `confirme avoir reçu de ${data.locataire.noms_complet} la somme de ` +
      `${montantLettres} DOLLARS AMÉRICAINS (${montant.toFixed(0)} USD) ` +
      `au titre du loyer du mois de ${paiement.mois_concerne || 'N/A'} ` +
      `pour l'appartement ${data.contrat?.appartement?.nom || ''}.`
    
    const lignesTexte = doc.splitTextToSize(texteOfficiel, pageWidth - 2 * margin)
    doc.text(lignesTexte, margin, y)
    y += lignesTexte.length * 6 + 15

    // === SIGNATURE ===
    doc.text('Fait à Kinshasa,', pageWidth - margin - 50, y)
    y += 6
    doc.text(`le ${dateEmission}`, pageWidth - margin - 50, y)
    y += 18
    
    doc.setFont('helvetica', 'bold')
    doc.text('Cesar Okoma', pageWidth - margin - 50, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('Bailleur', pageWidth - margin - 50, y)

    // === FOOTER ===
    const footerY = doc.internal.pageSize.getHeight() - 15
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      'KENGE 14 • Gestion Locative Professionnelle • Document généré électroniquement',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    )

    // === TÉLÉCHARGEMENT ===
    const nomFichier = `Recu_KENGE14_${(data.locataire.noms_complet || 'Locataire').replace(/\s+/g, '-')}_${(paiement.mois_concerne || 'paiement').replace(/\s+/g, '-')}.pdf`
    doc.save(nomFichier)
  }

  // ============================================
  // RENDU
  // ============================================

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
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2"
                >
                  <div className="flex-1 min-w-0">
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
                  <button
                    onClick={() => genererRecuPDF(p)}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                    title="Télécharger le reçu PDF"
                  >
                    📥 Reçu
                  </button>
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