import { jsPDF } from 'jspdf'

/**
 * Génère un PDF professionnel d'un avenant de renouvellement de bail
 * Conforme au contrat de bail original KENGE 14
 */
export function genererContratRenouvellementPDF(renouvellement) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Configuration pour supporter les accents français
  doc.setLanguage('fr')

  // Données du contrat
  const contrat = renouvellement.contrat || {}
  const locataire = contrat.locataire || {}
  const appartement = contrat.appartement || {}

  const nomLocataire = renouvellement.nom_signataire || locataire.noms_complet || 'N/A'
  const telephoneLocataire = locataire.telephone || 'N/A'
  const nomAppartement = appartement.nom || 'N/A'
  const loyer = contrat.loyer_base || contrat.loyer || 0
  const numeroContrat = `KENGE14-RNV-${renouvellement.id?.toString().slice(-8) || 'XXXX'}`

  // Calcul des dates
  const dateDebut = contrat.date_fin ? new Date(contrat.date_fin) : new Date()
  const dateFin = new Date(dateDebut)
  dateFin.setFullYear(dateFin.getFullYear() + 1)

  const formatDate = (date) =>
    date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  const dateSignature = renouvellement.date_signature
    ? new Date(renouvellement.date_signature)
    : new Date()

  // Helper pour écrire avec encodage correct
  const ecrire = (texte, x, y, options) => {
    doc.text(texte, x, y, options)
  }

  // ═══════════════════════════════════════════════
  // PAGE 1 : EN-TÊTE ET ARTICLES PRINCIPAUX
  // ═══════════════════════════════════════════════

  // En-tête vert KENGE 14
  doc.setFillColor(5, 122, 85)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  ecrire('KENGE 14 GESTION LOCATIVE', 105, 15, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  ecrire('Kinshasa, République Démocratique du Congo', 105, 24, { align: 'center' })

  // Titre du document
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  ecrire('AVENANT DE RENOUVELLEMENT DE BAIL', 105, 50, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  ecrire(`N° ${numeroContrat}`, 105, 57, { align: 'center' })
  ecrire(`Émis le ${formatDate(dateSignature)}`, 105, 63, { align: 'center' })

  // Ligne séparatrice
  doc.setDrawColor(5, 122, 85)
  doc.setLineWidth(0.5)
  doc.line(20, 70, 190, 70)

  // Section "ENTRE LES SOUSSIGNÉS"
  let y = 80
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  ecrire('ENTRE LES SOUSSIGNÉS :', 20, y)

  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  ecrire('LE BAILLEUR', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  ecrire('M. Cesar OKOMA', 20, y)
  y += 5
  ecrire('KENGE 14 Gestion Locative', 20, y)

  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  ecrire('LE PRENEUR', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  ecrire(`Nom : ${nomLocataire}`, 20, y)
  y += 5
  ecrire(`Téléphone : ${telephoneLocataire}`, 20, y)
  y += 5
  ecrire(`Appartement loué : ${nomAppartement} - KENGE 14`, 20, y)

  // Ligne séparatrice
  y += 8
  doc.setDrawColor(200, 200, 200)
  doc.line(20, y, 190, y)
  y += 8

  // Préambule
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  const preambule = "Il a été convenu et arrêté ce qui suit dans le cadre du renouvellement du bail à usage d'habitation initialement signé entre les parties :"
  const preambuleLines = doc.splitTextToSize(preambule, 170)
  doc.text(preambuleLines, 20, y)
  y += preambuleLines.length * 5 + 6

  // ARTICLE 1 - OBJET
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 1 - OBJET DU RENOUVELLEMENT', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article1 = `Le présent avenant a pour objet le renouvellement du bail relatif à l'appartement ${nomAppartement} situé dans l'immeuble KENGE 14 à Kinshasa, dans les mêmes conditions que le contrat initial.`
  const article1Lines = doc.splitTextToSize(article1, 170)
  doc.text(article1Lines, 20, y)
  y += article1Lines.length * 5 + 4

  // ARTICLE 2 - DURÉE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 2 - DURÉE', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  ecrire(`Le renouvellement est conclu pour une durée d'une (1) année,`, 20, y)
  y += 5
  ecrire(`prenant effet le ${formatDate(dateDebut)} et se terminant le ${formatDate(dateFin)}.`, 20, y)
  y += 5
  ecrire("Renouvelable par tacite reconduction sauf dénonciation par l'une des parties.", 20, y)
  y += 8

  // ARTICLE 3 - LOYER
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 3 - LOYER', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  ecrire(`Loyer mensuel inchangé : ${loyer} USD (dollars américains),`, 20, y)
  y += 5
  ecrire('payable à la fin de chaque mois consommé.', 20, y)
  y += 5
  ecrire("Une période de grâce de cinq (5) jours peut être exceptionnellement accordée", 20, y)
  y += 5
  ecrire("sur demande écrite et préalable du Preneur.", 20, y)
  y += 8

  // ARTICLE 4 - MODALITÉS DE PAIEMENT (texte officiel)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 4 - MODALITÉS DE PAIEMENT', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const article4Texte = "Le paiement du loyer s'effectuera par dépôt sur le compte bancaire Equity-BCDC n° 233200011755382. En cas d'impossibilité pour le Preneur d'effectuer lui-même le dépôt, le gérant pourra s'en charger moyennant une indemnité forfaitaire de cinq dollars américains (USD 5,00) pour frais de transport et de service. Le Preneur devra transmettre le bordereau du dépôt au Bailleur via WhatsApp au numéro +1 817 353 8862, en précisant son nom ainsi que le mois concerné. Le non-respect de cette procédure ou le défaut de paiement à l'échéance constituera un cas d'insolvabilité du Preneur."
  const article4Lines = doc.splitTextToSize(article4Texte, 170)
  doc.text(article4Lines, 20, y)
  y += article4Lines.length * 5 + 4

  // ═══════════════════════════════════════════════
  // PAGE 2 : SUITE DES ARTICLES + SIGNATURE
  // ═══════════════════════════════════════════════
  doc.addPage()

  // En-tête vert (page 2)
  doc.setFillColor(5, 122, 85)
  doc.rect(0, 0, 210, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  ecrire('KENGE 14 GESTION LOCATIVE - Avenant de Renouvellement', 105, 13, {
    align: 'center',
  })

  doc.setTextColor(0, 0, 0)
  y = 35

  // ARTICLE 5 - CHARGES LOCATIVES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 5 - CHARGES LOCATIVES', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article5 = "Les charges locatives, notamment celles relatives à la consommation d'eau (Regideso) et d'électricité (SNEL), demeurent à la charge exclusive du Preneur, conformément au contrat initial."
  const article5Lines = doc.splitTextToSize(article5, 170)
  doc.text(article5Lines, 20, y)
  y += article5Lines.length * 5 + 4

  // ARTICLE 6 - GARANTIE LOCATIVE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 6 - GARANTIE LOCATIVE', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article6 = "La garantie locative versée à la signature du contrat initial reste acquise au Bailleur pendant toute la durée du présent renouvellement et sera restituée selon les modalités prévues au contrat initial."
  const article6Lines = doc.splitTextToSize(article6, 170)
  doc.text(article6Lines, 20, y)
  y += article6Lines.length * 5 + 4

  // ARTICLE 7 - RÉSILIATION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 7 - RÉSILIATION', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article7 = "Chacune des parties pourra résilier le présent contrat à tout moment, sans motif particulier, moyennant un préavis de quatre-vingt-dix (90) jours, notifié par écrit à l'autre partie avec accusé de réception. Le délai court à compter de la date de réception de la notification."
  const article7Lines = doc.splitTextToSize(article7, 170)
  doc.text(article7Lines, 20, y)
  y += article7Lines.length * 5 + 4

  // ARTICLE 8 - RÈGLEMENT DES LITIGES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 8 - RÈGLEMENT DES LITIGES', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article8 = "Tout différend relatif à l'interprétation ou à l'exécution du présent avenant sera, dans un premier temps, réglé à l'amiable entre les parties. En cas d'échec, le litige sera soumis à la compétence des juridictions de la République Démocratique du Congo."
  const article8Lines = doc.splitTextToSize(article8, 170)
  doc.text(article8Lines, 20, y)
  y += article8Lines.length * 5 + 4

  // ARTICLE 9 - MAINTIEN DES AUTRES CLAUSES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ecrire('ARTICLE 9 - MAINTIEN DES AUTRES CLAUSES', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article9 = "Toutes les autres clauses et conditions du contrat de bail initial non modifiées par le présent avenant restent intégralement en vigueur."
  const article9Lines = doc.splitTextToSize(article9, 170)
  doc.text(article9Lines, 20, y)
  y += article9Lines.length * 5 + 10

  // Section signature
  doc.setDrawColor(5, 122, 85)
  doc.setLineWidth(0.5)
  doc.line(20, y, 190, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  ecrire('SIGNATURE DU PRENEUR', 20, y)
  y += 8

  // Image de la signature
  if (renouvellement.signature_data) {
    try {
      doc.addImage(renouvellement.signature_data, 'PNG', 20, y, 80, 30)
      y += 32
    } catch (err) {
      console.error('Erreur ajout signature:', err)
      y += 5
    }
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  ecrire(nomLocataire, 20, y)
  y += 5
  ecrire(`Fait à Kinshasa, le ${formatDate(dateSignature)}`, 20, y)

  // Pied de page
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  ecrire(
    'Document généré électroniquement par KENGE 14 Gestion Locative',
    105,
    285,
    { align: 'center' }
  )
  ecrire(`ID: ${renouvellement.id || 'N/A'}`, 105, 290, { align: 'center' })

  return doc
}